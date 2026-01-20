# 🚀 Infrastructure AWS Automatisée - Yukpomnang

Ce répertoire contient toute l'infrastructure Terraform pour déployer automatiquement Yukpomnang sur AWS.

## 📋 Prérequis

Avant de commencer, suivez le guide : [`docs/AWS_ACCOUNT_SETUP.md`](../../docs/AWS_ACCOUNT_SETUP.md)

### Résumé des prérequis :
- ✅ Compte AWS créé
- ✅ AWS CLI installé et configuré (`aws configure`)
- ✅ Terraform installé
- ✅ Docker installé
- ✅ Credentials AWS sauvegardés

## 🎯 Déploiement Rapide

### Étape 1 : Configuration

1. **Copier le fichier de configuration** :
   ```powershell
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Éditer `terraform.tfvars`** avec vos valeurs :
   ```hcl
   aws_region = "eu-west-1"
   project_name = "yukpomnang"
   rds_password = "VOTRE_MOT_DE_PASSE_FORT"
   jwt_secret = "VOTRE_SECRET_JWT"
   ```

### Étape 2 : Déploiement Automatique

Depuis la racine du projet :

```powershell
.\scripts\deploy-aws.ps1
```

Le script va :
1. ✅ Vérifier les prérequis
2. ✅ Initialiser Terraform
3. ✅ Créer toute l'infrastructure AWS
4. ✅ Build et push l'image Docker vers ECR
5. ✅ Déployer le service ECS
6. ✅ Afficher les URLs et commandes utiles

## 📁 Structure des Fichiers

```
infra/aws/
├── main.tf              # Infrastructure principale (VPC, RDS, ECS, ALB, etc.)
├── variables.tf          # Variables Terraform
├── outputs.tf            # Outputs (URLs, endpoints, etc.)
├── terraform.tfvars.example  # Exemple de configuration
└── README.md             # Ce fichier
```

## 🔧 Configuration Détaillée

### Variables Principales

| Variable | Description | Défaut |
|----------|-------------|--------|
| `aws_region` | Région AWS | `eu-west-1` |
| `project_name` | Nom du projet | `yukpomnang` |
| `environment` | Environnement (dev/staging/production) | `production` |
| `rds_instance_class` | Type d'instance RDS | `db.t3.medium` |
| `rds_password` | Mot de passe RDS | **À définir** |
| `jwt_secret` | Secret JWT | **À définir** |
| `ecs_cpu` | CPU pour ECS (1024 = 1 vCPU) | `1024` |
| `ecs_memory` | Mémoire ECS en MB | `2048` |
| `ecs_desired_count` | Nombre de tâches ECS | `2` |

### Exemple de Configuration Complète

```hcl
# infra/aws/terraform.tfvars

aws_region  = "eu-west-1"
project_name = "yukpomnang"
environment  = "production"

# RDS
rds_instance_class      = "db.t3.medium"
rds_password           = "MonMotDePasseSuperFort123!"
rds_database_name      = "yukpomnang"

# ECS
ecs_cpu          = 1024
ecs_memory       = 2048
ecs_desired_count = 2

# Application
jwt_secret = "mon-secret-jwt-tres-long-et-aleatoire"
```

## 🏗️ Infrastructure Créée

Le script Terraform crée automatiquement :

### Réseau
- ✅ VPC avec CIDR 10.0.0.0/16
- ✅ 2 Subnets publics (pour ALB)
- ✅ 2 Subnets privés (pour ECS)
- ✅ 2 Subnets pour RDS
- ✅ Internet Gateway
- ✅ NAT Gateway (optionnel)
- ✅ Route Tables

### Base de Données
- ✅ RDS PostgreSQL 15.4
- ✅ Instance db.t3.medium (2 vCPU, 4 GB RAM)
- ✅ Storage auto-scaling (20 GB → 100 GB)
- ✅ Backups automatiques (7 jours)
- ✅ Security Group configuré

### Cache
- ✅ ElastiCache Redis 7.0
- ✅ Instance cache.t3.small
- ✅ Encryption at rest et in transit

### Conteneurs
- ✅ ECR Repository pour l'image Docker
- ✅ ECS Cluster Fargate
- ✅ ECS Task Definition
- ✅ ECS Service avec Auto Scaling
- ✅ CloudWatch Logs

### Load Balancing
- ✅ Application Load Balancer (ALB)
- ✅ Target Group avec health checks
- ✅ Listener HTTP (redirige vers HTTPS)
- ✅ Listener HTTPS (si certificat ACM fourni)

### Sécurité
- ✅ Security Groups configurés
- ✅ Secrets Manager pour variables sensibles
- ✅ IAM Roles avec permissions minimales

## 🚀 Commandes Utiles

### Déploiement
```powershell
# Déploiement complet
.\scripts\deploy-aws.ps1

# Mise à jour uniquement (après nouveau build)
.\scripts\deploy-aws.ps1 -Action update

# Destruction de l'infrastructure
.\scripts\deploy-aws.ps1 -Action destroy
```

### Terraform Manuel
```powershell
cd infra/aws

# Initialiser
terraform init

# Voir le plan
terraform plan

# Appliquer
terraform apply

# Voir les outputs
terraform output

# Détruire
terraform destroy
```

### AWS CLI
```powershell
# Voir les logs ECS
aws logs tail /ecs/yukpomnang-backend --follow --region eu-west-1

# Statut du service ECS
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1

# Forcer un nouveau déploiement
aws ecs update-service `
  --cluster yukpomnang-cluster `
  --service yukpomnang-backend-service `
  --force-new-deployment `
  --region eu-west-1

# Lister les images ECR
aws ecr list-images `
  --repository-name yukpomnang-backend `
  --region eu-west-1
```

## 📦 Migration des Données depuis Render

Pour migrer vos données depuis Render vers AWS RDS :

```powershell
.\scripts\migrate-render-to-aws.ps1 `
  -RenderDbUrl "postgresql://user:pass@render-db-url:5432/db" `
  -AwsRdsUrl "postgresql://user:pass@rds-endpoint:5432/db"
```

Le script va :
1. ✅ Exporter les données depuis Render
2. ✅ Importer vers RDS
3. ✅ Installer les extensions (pgvector, imgsmlr)

## 🔐 Sécurité

### Secrets Manager

Les secrets sont stockés dans AWS Secrets Manager :
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

Pour mettre à jour un secret :
```powershell
aws secretsmanager update-secret `
  --secret-id yukpomnang/backend/secrets `
  --secret-string '{"DATABASE_URL":"nouvelle_url",...}' `
  --region eu-west-1
```

### Certificat SSL

Pour activer HTTPS :
1. Créer un certificat dans AWS Certificate Manager (ACM)
2. Ajouter l'ARN dans `terraform.tfvars` :
   ```hcl
   acm_certificate_arn = "arn:aws:acm:eu-west-1:123456789012:certificate/xxxxx"
   ```
3. Appliquer : `terraform apply`

## 💰 Coûts Estimés

| Service | Coût/mois (estimation) |
|---------|------------------------|
| RDS db.t3.medium | $60-80 |
| ElastiCache cache.t3.small | $15-20 |
| ECS Fargate (2 tasks) | $60-80 |
| ALB | $20-25 |
| NAT Gateway | $35-45 |
| CloudWatch Logs | $5-10 |
| **Total** | **~$195-260/mois** |

💡 **Astuce** : Utilisez le Free Tier AWS (12 mois) pour réduire les coûts initiaux.

## 🐛 Dépannage

### Erreur : "Credentials not found"
```powershell
aws configure
# Entrer Access Key ID, Secret Access Key, Region
```

### Erreur : "ECR repository not found"
Le repository est créé par Terraform. Vérifiez que `terraform apply` a réussi.

### Erreur : "Task failed to start"
Vérifiez les logs CloudWatch :
```powershell
aws logs tail /ecs/yukpomnang-backend --follow
```

### Erreur : "Health check failing"
Vérifiez que le endpoint `/health` répond correctement dans votre application.

### Erreur : "Cannot connect to RDS"
Vérifiez que le Security Group RDS autorise les connexions depuis le Security Group ECS.

## 📚 Documentation Complémentaire

- [Guide de création compte AWS](../../docs/AWS_ACCOUNT_SETUP.md)
- [Documentation Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Documentation AWS ECS](https://docs.aws.amazon.com/ecs/)

## ✅ Checklist Post-Déploiement

- [ ] Infrastructure créée avec succès
- [ ] Service ECS running (2+ tâches)
- [ ] Health checks OK sur ALB
- [ ] Logs CloudWatch visibles
- [ ] Connexion RDS fonctionnelle
- [ ] Connexion Redis fonctionnelle
- [ ] Données migrées depuis Render
- [ ] Extensions PostgreSQL installées (pgvector, imgsmlr)
- [ ] Certificat SSL configuré (optionnel)
- [ ] DNS configuré pointant vers ALB (optionnel)

## 🆘 Support

En cas de problème :
1. Vérifier les logs CloudWatch
2. Vérifier les Security Groups
3. Vérifier les outputs Terraform : `terraform output`
4. Consulter la documentation AWS

---

**🎉 Votre infrastructure AWS est maintenant prête !**






