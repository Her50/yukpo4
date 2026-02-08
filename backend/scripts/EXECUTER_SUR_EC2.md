# Guide : Exécuter les Scripts de Diagnostic/Correction sur AWS EC2

## 📋 Problème

La base de données AWS RDS est dans un **VPC privé** et n'est **pas accessible depuis votre machine locale**. Les scripts doivent être exécutés depuis une **instance EC2 dans le même VPC**.

## 🚀 Solution : Exécuter depuis une Instance EC2

### Option 1 : Via AWS Systems Manager Session Manager (Recommandé)

Cette méthode ne nécessite pas de clé SSH et fonctionne directement depuis votre machine :

```powershell
# 1. Trouver une instance EC2 dans le VPC
$instances = aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=*yukpomnang*" --query "Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress]" --output table

# 2. Se connecter via Session Manager (si SSM Agent est installé)
aws ssm start-session --target <instance-id> --region us-east-1

# 3. Dans la session SSM, cloner le repo et exécuter les scripts
git clone <repo-url>
cd yukpomnang2/backend/scripts
chmod +x execute_diagnostic_fix_aws_ec2.sh
./execute_diagnostic_fix_aws_ec2.sh
```

### Option 2 : Via SSH (si vous avez une clé SSH)

```powershell
# 1. Trouver une instance EC2
$instances = aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=*yukpomnang*" --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress]" --output table

# 2. Se connecter via SSH
ssh -i <key.pem> ec2-user@<public-ip>

# 3. Dans la session SSH, exécuter les scripts
cd /path/to/yukpomnang2/backend/scripts
chmod +x execute_diagnostic_fix_aws_ec2.sh
./execute_diagnostic_fix_aws_ec2.sh
```

### Option 3 : Via ECS Task (si vous avez un service ECS)

Créer une task ECS one-shot pour exécuter les scripts :

```powershell
# 1. Créer un script qui sera exécuté dans le conteneur
# Le conteneur ECS a déjà accès à la base de données via le VPC

# 2. Exécuter une task ECS
aws ecs run-task \
  --cluster yukpomnang-cluster \
  --task-definition yukpomnang-backend \
  --overrides '{
    "containerOverrides": [{
      "name": "backend",
      "command": ["/bin/bash", "-c", "cd /app/backend/scripts && ./execute_diagnostic_fix_aws_ec2.sh"]
    }]
  }' \
  --region us-east-1
```

## 📝 Prérequis sur l'Instance EC2

### 1. Installer PostgreSQL Client

```bash
# Amazon Linux 2
sudo yum install postgresql15 -y

# Ubuntu
sudo apt-get update
sudo apt-get install postgresql-client -y
```

### 2. Installer AWS CLI (si nécessaire)

```bash
# Amazon Linux 2
sudo yum install aws-cli -y

# Ubuntu
sudo apt-get install awscli -y
```

### 3. Installer jq (pour parser JSON)

```bash
# Amazon Linux 2
sudo yum install jq -y

# Ubuntu
sudo apt-get install jq -y
```

## 🔧 Configuration

### Récupérer DATABASE_URL depuis Secrets Manager

Le script essaie automatiquement de récupérer DATABASE_URL depuis AWS Secrets Manager. Si cela ne fonctionne pas, définissez-la manuellement :

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
```

### Auto-confirmation

Pour exécuter sans confirmation interactive :

```bash
export AUTO_CONFIRM=true
./execute_diagnostic_fix_aws_ec2.sh
```

## 🔍 Vérification de l'Accès

Avant d'exécuter les scripts, vérifiez que vous pouvez vous connecter à la base de données :

```bash
# Tester la connexion
psql "$DATABASE_URL" -c "SELECT version();"
```

## ⚠️ Notes Importantes

1. **VPC** : L'instance EC2 doit être dans le **même VPC** que la base de données RDS
2. **Security Groups** : Le Security Group de RDS doit autoriser les connexions depuis le Security Group de l'instance EC2
3. **Backup** : Faites un **backup** de la base de données avant d'exécuter les scripts de correction
4. **Permissions** : L'instance EC2 doit avoir les permissions IAM pour accéder à Secrets Manager (si utilisé)

## 🐛 Dépannage

### Erreur "Connection timed out"

**Cause** : L'instance EC2 n'est pas dans le même VPC ou le Security Group bloque la connexion

**Solution** :
1. Vérifier que l'instance EC2 est dans le même VPC que RDS
2. Vérifier que le Security Group de RDS autorise les connexions depuis le Security Group de l'instance EC2

### Erreur "psql: command not found"

**Solution** : Installer PostgreSQL client (voir section Prérequis)

### Erreur "AWS CLI not found"

**Solution** : Installer AWS CLI ou définir DATABASE_URL manuellement






