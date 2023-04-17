
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export const userDataCommands = (): ec2.UserData => {

  const userData = ec2.UserData.forLinux()

  userData.addCommands(

    "log=/var/log/deploy/cloud.log",
    "sudo mkdir -p /var/log/deploy",
    "echo 'initstudi' |& sudo tee $log",

    "sudo yum update -y |& sudo tee -a $log", 
    "sudo yum upgrade -y |& sudo tee -a $log", 

//    "sudo yum install -y amazon-efs-utils", 
//    "sudo yum install -y nfs-utils", 
//    "sudo yum install -y ruby aws-cli", 
/*    "file_system_id_1=" + fileSystem, 
    "efs_mount_point_1=/var/www/html", 
    "mkdir -p \"${efs_mount_point_1}\"", 
    "if grep -qs \"${efs_mount_point_1} \" /proc/mounts; then umount ${efs_mount_point_1}; fi",
    "mount -t nfs -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport ${file_system_id_1}.efs.eu-west-3.amazonaws.com:/ ${efs_mount_point_1} |& sudo tee -a $log",
    "mkdir -p \"/var/lib/mysql\"", 
    "if grep -qs \"/var/lib/mysql\" \" /proc/mounts; then umount /var/lib/mysql | sudo tee -a $log; fi",
    "mount -t nfs -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport ${file_system_id_1}.efs.eu-west-3.amazonaws.com:/mysql/ /var/lib/mysql |& sudo tee -a $log",
*/

    "echo '<=======================  certificates  ===========================>' | sudo tee -a $log",

    "sudo yum install mod_ssl -y |& sudo tee -a $log",

    "sudo yum install jq -y |& sudo tee -a $log",

    "sudo mkdir -p /etc/httpd/ssl |& sudo tee -a $log",
    "privatekey=$(aws secretsmanager get-secret-value --secret-id 'studi-private-tls' --query 'SecretString' --output text --region 'eu-west-3' | jq '.\"studi-private\"' | sed 's/\\\"//g')",
    "echo '' | sudo tee /etc/httpd/ssl/studi-private.key",
    "echo $privatekey | sudo tee -a /etc/httpd/ssl/studi-private.key",

/*    "sudo curl -LsS -O https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo tee -a /var/log/deploy/cloud.log",
    "sudo bash mariadb_repo_setup --os-type=rhel --os-version=7 --mariadb-server-version=10.6 | sudo tee -a /var/log/deploy/cloud.log",
    "sudo yum install MariaDB-server MariaDB-client -y | sudo tee -a /var/log/deploy/cloud.log",
    "sudo systemctl enable --now mariadb | sudo tee -a /var/log/deploy/cloud.log",

    "sudo mysql -sfu root <<EOS",
    "-- set root password",
//    "SET PASSWORD FOR 'root'@'localhost'=PASSWORD('password');",
    "UPDATE mysql.user SET Password=PASSWORD('password') WHERE User='root';",
    "-- delete anonymous users",
    "DELETE FROM mysql.user WHERE User='';",
    "-- delete remote root capabilities",
    "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');",
    "-- drop database 'test'",
    "DROP DATABASE IF EXISTS test;",
    "-- also make sure there are lingering permissions to it",
    "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';",
    "-- make changes immediately",
    "FLUSH PRIVILEGES;",
    "EOS",*/

    "echo '<=======================  dyn DNS  ===========================>' | sudo tee -a $log",

    "publicip=$(dig +short myip.opendns.com @resolver1.opendns.com)",
    `curl "https://dynamicdns.park-your-domain.com/update?host=@&domain=etupdt.com&password=80ec9e57879842f9957ae55863d1f7eb&ip=\${publicip}" \
    -H 'authority: dynamicdns.park-your-domain.com' \
    -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
    -H 'accept-language: fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' \
    -H 'sec-ch-ua: "Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"' \
    -H 'sec-ch-ua-mobile: ?0' \
    -H 'sec-ch-ua-platform: "Windows"' \
    -H 'sec-fetch-dest: document' \
    -H 'sec-fetch-mode: navigate' \
    -H 'sec-fetch-site: none' \
    -H 'sec-fetch-user: ?1' \
    -H 'upgrade-insecure-requests: 1' \
    -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36' \
    --compressed |& sudo tee -a $log`
  )

  return userData

}
