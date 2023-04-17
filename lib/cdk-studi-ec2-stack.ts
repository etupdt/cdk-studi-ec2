import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { systemAdministrator1 } from '../../cdk-studi-ec2/lib/SystemAdministrator';
import { systemAdministrator2 } from '../../cdk-studi-ec2/lib/SystemAdministrator';
import { systemAdministrator3 } from '../../cdk-studi-ec2/lib/SystemAdministrator';
import { systemAdministrator4 } from '../../cdk-studi-ec2/lib/SystemAdministrator';
import { systemAdministrator5 } from '../../cdk-studi-ec2/lib/SystemAdministrator';
import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeStarConnectionsSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { userDataCommands } from './initstudi';
import { RdsDataSource } from 'aws-cdk-lib/aws-appsync';

export class CdkStudiEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log('stack availabilityZones ====>', this.availabilityZones)

    const vpc = ec2.Vpc.fromLookup(this, 'studi-vpc', {
      isDefault: false,
      vpcName: 'CdkStudiRdsStack/studi-vpc'
    })

/*    const securityGroupEc2 = new ec2.SecurityGroup(this, 'studi-ec2-security-group-cdk', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'regles des container crees par cdk dans studi-vpc',
      securityGroupName: 'studi-ec2-security-group-cdk'
    });*/

    const securityGroupEc2 = ec2.SecurityGroup.fromLookupByName(this, 'studi-ec2-security-group-cdk', 'studi-ec2-security-group-cdk', vpc)
    const securityGroupEc2Rds = ec2.SecurityGroup.fromLookupByName(this, 'studi-ec2-rds-security-group-cdk', 'studi-ec2-rds-security-group-cdk', vpc)

    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'open for ssh')
    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'open for http')
    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'open for https')
    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(7443), 'open for https app1')
    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8443), 'open for https app1')
    securityGroupEc2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9443), 'open for https app2')

    const executionRole = new iam.Role(this, 
      'studi-role-execution-cdk', 
      {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"), 
        roleName: "studi-role-execution-cdk",
        description: 'role de la tache cdk dans studi-vpc',
      }
    )
    
    executionRole.addToPolicy(new iam.PolicyStatement(systemAdministrator1))
    executionRole.addToPolicy(new iam.PolicyStatement(systemAdministrator2))
    executionRole.addToPolicy(new iam.PolicyStatement(systemAdministrator3))
    executionRole.addToPolicy(new iam.PolicyStatement(systemAdministrator4))
    executionRole.addToPolicy(new iam.PolicyStatement(systemAdministrator5))
    
    executionRole.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "codedeploy-commands-secure:GetDeploymentSpecification",
          "codedeploy-commands-secure:PollHostCommand",
          "codedeploy-commands-secure:PutHostCommandAcknowledgement",
          "codedeploy-commands-secure:PutHostCommandComplete",
          "kms:*"
        ]
      })
    )
    
    executionRole.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        actions: [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ],
        resources: ["*"],
      })
    )
    
    executionRole.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "s3:GetEncryptionConfiguration",
          "kms:*"        
        ]
      })
    )

    executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')) // permet la lecture dans secret management (private key ssl)
    executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')) // permet l'installation de l'agent codedeploy par "association" ssm
    
    const userData = userDataCommands()

    const serveurEc2 = new ec2.Instance(this, 'studi-ec2-cdk', {
      instanceName: 'studi-ec2-cdk',
      vpc: vpc,
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpcSubnets: {
        subnets: [
          vpc.publicSubnets[0], 
        ]
      },
      availabilityZone: 'eu-west-3a',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      userData: userData,
      securityGroup: securityGroupEc2,
      role: executionRole
    })
    
    serveurEc2.addSecurityGroup(securityGroupEc2Rds)

    const cfnAssociation = new ssm.CfnAssociation(this, 'studi-association-cdk', {
      name: 'AWS-ConfigureAWSPackage',
      associationName: 'studi-association-cdk',
      targets: [{
        key: 'tag:Name',
        values: ['studi-ec2-cdk'],
      }],
    });

    cfnAssociation.parameters = {"name": ["AWSCodeDeployAgent"], "action": ["Install"]}


    const securityGroupBuild = new ec2.SecurityGroup(this, 'studi-build-security-group-symf-front-cdk', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'regles des container crees par cdk dans studi-vpc',
      securityGroupName: 'studi-build-security-group-cdk'
    })

    const buildProjectSymfFront = new PipelineProject(this, `cdk-studi-efs-create`, {
      buildSpec: BuildSpec.fromSourceFilename("./buildspec.yml"),
      vpc: vpc,
      environment: {
        computeType: ComputeType.SMALL,
        privileged: true,
        buildImage: LinuxBuildImage.STANDARD_6_0
      },
      securityGroups: [securityGroupBuild],
    });

    const cdkSourceOutputEval1 = new cdk.aws_codepipeline.Artifact();
    const cdkSourceOutputEval2 = new cdk.aws_codepipeline.Artifact();
    const cdkSourceOutputSymf = new cdk.aws_codepipeline.Artifact();
    const cdkSourceOutputSymfFront = new cdk.aws_codepipeline.Artifact();

    const cdkBuildOutputSymfFront = new cdk.aws_codepipeline.Artifact();

    const sourceActionEval1 = new CodeStarConnectionsSourceAction({
      actionName: 'studi-source-action-eval1-cdk',
      output: cdkSourceOutputEval1,
      repo: 'dtavernieravalweb',
      owner: 'etupdt',
      connectionArn: 'arn:aws:codestar-connections:eu-west-3:498746666064:connection/2e7b9860-ef53-443b-abaf-e950992a90e5',
      branch: 'main'
    })

    const sourceActionEval2 = new CodeStarConnectionsSourceAction({
      actionName: 'studi-source-action-eval2-cdk',
      output: cdkSourceOutputEval2,
      repo: 'dtavernierevaljavascript',
      owner: 'etupdt',
      connectionArn: 'arn:aws:codestar-connections:eu-west-3:498746666064:connection/2e7b9860-ef53-443b-abaf-e950992a90e5',
      branch: 'main'
    })

    const sourceActionSymf = new CodeStarConnectionsSourceAction({
      actionName: 'studi-source-action-symf-cdk',
      output: cdkSourceOutputSymf,
      repo: 'doc_back_symfony',
      owner: 'etupdt',
      connectionArn: 'arn:aws:codestar-connections:eu-west-3:498746666064:connection/2e7b9860-ef53-443b-abaf-e950992a90e5',
      branch: 'main'
    })

    const sourceActionSymfFront = new CodeStarConnectionsSourceAction({
      actionName: 'studi-source-action-symf-front-cdk',
      output: cdkSourceOutputSymfFront,
      repo: 'login-front-material',
      owner: 'etupdt',
      connectionArn: 'arn:aws:codestar-connections:eu-west-3:498746666064:connection/2e7b9860-ef53-443b-abaf-e950992a90e5',
      branch: 'main'
    })

    const applicationEval1 = new cdk.aws_codedeploy.ServerApplication(this, 'studi-application-eval1-cdk', {
      applicationName: 'studi-application-eval1-cdk'
    });

    const deploymentGroupEval1 = new cdk.aws_codedeploy.ServerDeploymentGroup(this, 'studi-deployment-group-eval1-cdk', {
      application: applicationEval1,
      ec2InstanceTags: new cdk.aws_codedeploy.InstanceTagSet(
        {
          'Name': ['studi-ec2-cdk'],
        },
      ),
    });

    const applicationEval2 = new cdk.aws_codedeploy.ServerApplication(this, 'studi-application-eval2-cdk', {
      applicationName: 'studi-application-eval2-cdk'
    });

    const deploymentGroupEval2 = new cdk.aws_codedeploy.ServerDeploymentGroup(this, 'studi-deployment-group-eval2-cdk', {
      application: applicationEval2,
      ec2InstanceTags: new cdk.aws_codedeploy.InstanceTagSet(
        {
          'Name': ['studi-ec2-cdk'],
        },
      ),
    });

    const applicationSynf = new cdk.aws_codedeploy.ServerApplication(this, 'studi-application-symf-cdk', {
      applicationName: 'studi-application-symf-cdk'
    });

    const deploymentGroupSynf = new cdk.aws_codedeploy.ServerDeploymentGroup(this, 'studi-deployment-group-synf-cdk', {
      application: applicationSynf,
      ec2InstanceTags: new cdk.aws_codedeploy.InstanceTagSet(
        {
          'Name': ['studi-ec2-cdk'],
        },
      ),
    });

    const applicationSynfFront = new cdk.aws_codedeploy.ServerApplication(this, 'studi-application-symf-front-cdk', {
      applicationName: 'studi-application-symf-front-cdk'
    });

    const deploymentGroupSynfFront = new cdk.aws_codedeploy.ServerDeploymentGroup(this, 'studi-deployment-group-synf-front-cdk', {
      application: applicationSynfFront,
      ec2InstanceTags: new cdk.aws_codedeploy.InstanceTagSet(
        {
          'Name': ['studi-ec2-cdk'],
        },
      ),
    });

    const buildActionSymfFront = new cdk.aws_codepipeline_actions.CodeBuildAction({
      actionName: 'studi-build-action-symf-front-cdk',
      project: buildProjectSymfFront,
      input: cdkSourceOutputSymfFront,
      outputs: [cdkBuildOutputSymfFront],
      runOrder: 2,
    })

    const deployActionEval1 = new cdk.aws_codepipeline_actions.CodeDeployServerDeployAction({
      actionName: 'studi-deploy-action-eval1-cdk',
      deploymentGroup: deploymentGroupEval1,
      input: cdkSourceOutputEval1,
    })

    const deployActionEval2 = new cdk.aws_codepipeline_actions.CodeDeployServerDeployAction({
      actionName: 'studi-deploy-action-eval2-cdk',
      deploymentGroup: deploymentGroupEval2,
      input: cdkSourceOutputEval2,
    })

    const deployActionSymf = new cdk.aws_codepipeline_actions.CodeDeployServerDeployAction({
      actionName: 'studi-deploy-action-symf-cdk',
      deploymentGroup: deploymentGroupSynf,
      input: cdkSourceOutputSymf,
    })

    const deployActionSymfFront = new cdk.aws_codepipeline_actions.CodeDeployServerDeployAction({
      actionName: 'studi-deploy-action-symf-front-cdk',
      deploymentGroup: deploymentGroupSynfFront,
      input: cdkBuildOutputSymfFront,
    })

    const pipelineEval1 = this.pipe('eval1', [sourceActionEval1, deployActionEval1])
    const pipelineEval2 = this.pipe('eval2', [sourceActionEval2, deployActionEval2])
    const pipeline1Symf = this.pipe('symf-back', [sourceActionSymf, deployActionSymf])
    const pipeline1SymfFront = this.pipe('symf-front', [sourceActionSymfFront, buildActionSymfFront, deployActionSymfFront])

  }    

  pipe (appli: string, actions: cdk.aws_codepipeline.IAction[]): Pipeline {

    let stages: cdk.aws_codepipeline.StageProps[] = []

    actions.forEach(action => {
      stages.push(        {
        stageName: action.actionProperties.actionName.replace('action', 'stage'),
        actions: [
          action
        ]
      })
    })

    return new Pipeline(this, 'studi-pipeline-' + appli + '-cdk', {
      pipelineName: 'studi-pipeline-' + appli + '-cdk',
      stages: stages
    })

  }

}
