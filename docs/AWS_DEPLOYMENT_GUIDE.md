# 🚀 Guide Complet de Déploiement AWS - Yukpomnang

Guide étape par étape pour migrer votre backend de Render vers AWS.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Création du Compte AWS](#création-du-compte-aws)
3. [Configuration Initiale](#configuration-initiale)
4. [Déploiement Automatique](#déploiement-automatique)
5. [Migration des Données](#migration-des-données)
6. [Post-Déploiement](#post-déploiement)
7. [Maintenance](#maintenance)

## 🔧 Prérequis

### 1. Compte AWS

Suivez le guide détaillé : [`AWS_ACCOUNT_SETUP.md`](./AWS_ACCOUNT_SETUP.md)

**Résumé rapide** :
- Créer un compte sur https://aws.amazon.com
- Créer un utilisateur IAM avec Access Key
- Configurer AWS CLI : `aws configure`

### 2. Outils à Installer

```powershell
# AWS CLI
winget install Amazon.AWSCLI

# Terraform
choco install terraform

# Docker Desktop
winget install Docker.DockerDesktop

# PostgreSQL Client (pour migration)
# Télécharger depuis : https://www.postgresql.org/download/windows/
```

### 3. Vérification

```powershell
# Vérifier AWS CLI
aws --version
aws sts get-caller-identity

# Vérifier Terraform
terraform version

# Vérifier Docker
docker --version
```

## 🎯 Déploiement Automatique

### Option 1 : Script Automatique (Recommandé)

```powershell
# Depuis la racine du projet
.\scripts\deploy-aws.ps1
```

Le script va :
1. ✅ Vérifier tous les prérequis
2. ✅ Charger la configuration
3. ✅ Créer l'infrastructure avec Terraform
4. ✅ Build et push l'image Docker
5. ✅ Déployer sur ECS
6. ✅ Afficher les URLs et commandes

### Option 2 : Terraform Manuel

```powershell
# 1. Configurer les variables
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars avec vos valeurs

# 2. Initialiser Terraform
terraform init

# 3. Voir le plan
terraform plan

# 4. Appliquer
terraform apply

# 5. Build et push Docker (voir section suivante)
```

## 🐳 Build et Push Docker

### Automatique (via script)

Le script `deploy-aws.ps1` fait cela automatiquement.

### Manuel

```powershell
# 1. Récupérer l'URL ECR depuis Terraform
cd infra/aws
$ecrUrl = terraform output -raw ecr_repository_url

# 2. Authentifier Docker
aws ecr get-login-password --region eu-west-1 | `
  docker login --username AWS --password-stdin $ecrUrl.Replace("/yukpomnang-backend", "")

# 3. Build l'image
cd ../../backend
docker build -t yukpomnang-backend:latest -f Dockerfile .

# 4. Tag pour ECR
docker tag yukpomnang-backend:latest "$ecrUrl:latest"

# 5. Push
docker push "$ecrUrl:latest"
```

## 📦 Migration des Données

### Depuis Render vers AWS RDS

```powershell
# Option 1 : Script automatique
.\scripts\migrate-render-to-aws.ps1 `
  -RenderDbUrl "postgresql://yukpo_db_user:password@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com:5432/yukpo_db" `
  -AwsRdsUrl "postgresql://yukpo_admin:password@yukpomnang-db.xxxxx.eu-west-1.rds.amazonaws.com:5432/yukpomnang"

# Option 2 : Manuel avec pg_dump
pg_dump "postgresql://user:pass@render-url:5432/db" -F c -f backup.dump
pg_restore -d "postgresql://user:pass@rds-url:5432/db" -F c backup.dump --no-owner --no-acl
```

### Installer les Extensions PostgreSQL

Après la migration, connectez-vous à RDS et installez les extensions :

```sql
-- Se connecter à RDS
psql "postgresql://yukpo_admin:password@rds-endpoint:5432/yukpomnang"

-- Installer les extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS imgsmlr;

-- Vérifier
\dx
```

## ✅ Post-Déploiement

### 1. Vérifier le Déploiement

```powershell
# Récupérer l'URL ALB
cd infra/aws
$albUrl = terraform output -raw alb_dns_name

# Tester le health check
curl "http://$albUrl/health"

# Voir les logs
aws logs tail /ecs/yukpomnang-backend --follow --region eu-west-1
```

### 2. Configurer le DNS (Optionnel)

Si vous avez un domaine :

1. **Créer un certificat ACM** :
   - Console AWS → Certificate Manager
   - Request certificate
   - Domain: `api.yukpomnang.com`
   - Validation DNS

2. **Ajouter l'ARN dans terraform.tfvars** :
   ```hcl
   acm_certificate_arn = "arn:aws:acm:eu-west-1:123456789012:certificate/xxxxx"
   ```

3. **Appliquer** :
   ```powershell
   cd infra/aws
   terraform apply
   ```

4. **Configurer Route 53** :
   - Créer un enregistrement A (alias)
   - Pointer vers l'ALB

### 3. Mettre à Jour les Variables d'Environnement

Pour ajouter/modifier des variables :

```powershell
# Mettre à jour le secret
aws secretsmanager update-secret `
  --secret-id yukpomnang/backend/secrets `
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "REDIS_URL": "redis://...",
    "JWT_SECRET": "...",
    "OPENAI_API_KEY": "..."
  }' `
  --region eu-west-1

# Redémarrer le service pour prendre en compte les changements
aws ecs update-service `
  --cluster yukpomnang-cluster `
  --service yukpomnang-backend-service `
  --force-new-deployment `
  --region eu-west-1
```

## 🔄 Maintenance

### Mettre à Jour l'Application

```powershell
# 1. Build et push nouvelle image
cd backend
docker build -t yukpomnang-backend:latest -f Dockerfile .
docker tag yukpomnang-backend:latest "123456789012.dkr.ecr.eu-west-1.amazonaws.com/yukpomnang-backend:latest"
docker push "123456789012.dkr.ecr.eu-west-1.amazonaws.com/yukpomnang-backend:latest"

# 2. Forcer le redéploiement
aws ecs update-service `
  --cluster yukpomnang-cluster `
  --service yukpomnang-backend-service `
  --force-new-deployment `
  --region eu-west-1
```

### Surveiller les Logs

```powershell
# Logs en temps réel
aws logs tail /ecs/yukpomnang-backend --follow --region eu-west-1

# Logs des 10 dernières minutes
aws logs tail /ecs/yukpomnang-backend --since 10m --region eu-west-1

# Rechercher des erreurs
aws logs filter-log-events `
  --log-group-name /ecs/yukpomnang-backend `
  --filter-pattern "ERROR" `
  --region eu-west-1
```

### Vérifier les Métriques

Console AWS → CloudWatch → Metrics :
- ECS : CPU, Memory, Task count
- RDS : CPU, Connections, Storage
- ALB : Request count, Response time

### Scaling

L'auto-scaling est configuré automatiquement :
- **Min** : 2 tâches
- **Max** : 10 tâches
- **CPU** : Scale à 70%
- **Memory** : Scale à 80%

Pour modifier :
```powershell
cd infra/aws
# Éditer variables.tf ou terraform.tfvars
terraform apply
```

## 🐛 Dépannage

### Service ECS ne démarre pas

1. **Vérifier les logs** :
   ```powershell
   aws logs tail /ecs/yukpomnang-backend --follow
   ```

2. **Vérifier les Security Groups** :
   - ECS doit pouvoir accéder à RDS (port 5432)
   - ECS doit pouvoir accéder à Redis (port 6379)
   - ALB doit pouvoir accéder à ECS (port 8080)

3. **Vérifier les Secrets** :
   ```powershell
   aws secretsmanager get-secret-value `
     --secret-id yukpomnang/backend/secrets `
     --region eu-west-1
   ```

### Health Check échoue

1. **Vérifier que l'endpoint `/health` existe** dans votre application
2. **Vérifier les logs** pour voir les erreurs
3. **Tester localement** : `curl http://localhost:8080/health`

### Connexion RDS échoue

1. **Vérifier le Security Group RDS** :
   - Doit autoriser le port 5432 depuis le Security Group ECS

2. **Vérifier l'URL de connexion** :
   ```powershell
   aws secretsmanager get-secret-value `
     --secret-id yukpomnang/backend/secrets `
     --query SecretString `
     --region eu-west-1 | ConvertFrom-Json | Select-Object DATABASE_URL
   ```

### Coûts trop élevés

1. **Réduire le nombre de tâches ECS** :
   ```hcl
   ecs_desired_count = 1
   ecs_min_count = 1
   ```

2. **Utiliser des instances plus petites** :
   ```hcl
   rds_instance_class = "db.t3.small"
   redis_node_type = "cache.t3.micro"
   ```

3. **Désactiver NAT Gateway** (si pas nécessaire) :
   ```hcl
   enable_nat_gateway = false
   ```

## 📊 Monitoring

### CloudWatch Dashboards

Créer un dashboard personnalisé :
1. Console AWS → CloudWatch → Dashboards
2. Ajouter des widgets pour :
   - ECS CPU/Memory
   - RDS Connections/CPU
   - ALB Request Count
   - Error Rate

### Alertes

Créer des alarmes pour :
- ECS : CPU > 80%
- RDS : Connections > 80%
- ALB : 5xx errors > 1%

## 🎉 Félicitations !

Votre backend est maintenant déployé sur AWS avec :
- ✅ Haute disponibilité (multi-AZ)
- ✅ Auto-scaling
- ✅ Load balancing
- ✅ Monitoring
- ✅ Backups automatiques
- ✅ Sécurité renforcée

---

**Besoin d'aide ?** Consultez la [documentation AWS](https://docs.aws.amazon.com/) ou les logs CloudWatch.






