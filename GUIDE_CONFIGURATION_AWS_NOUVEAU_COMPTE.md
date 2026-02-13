# 🚀 Guide de Configuration AWS - Nouveau Compte

## 📋 Vue d'ensemble

Ce guide vous permet de configurer automatiquement votre infrastructure AWS avec le nouveau compte, optimisé pour les utilisateurs en Afrique.

## 🎯 Objectifs

- ✅ Créer automatiquement toute l'infrastructure AWS (RDS, ElastiCache, ECS, ALB, CloudFront)
- ✅ Configurer les migrations automatiques vers AWS RDS
- ✅ Optimiser pour l'Afrique (région Cape Town - `af-south-1`)
- ✅ Configurer le build Docker et déploiement automatique
- ✅ Intégrer avec GitHub Actions

## 📦 Prérequis

1. **AWS CLI installé**
   ```bash
   # Windows (PowerShell)
   winget install Amazon.AWSCLI
   
   # Linux/Mac
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Terraform installé**
   ```bash
   # Windows (choco)
   choco install terraform
   
   # Linux/Mac
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **Credentials AWS du nouveau compte**
   - AWS Access Key ID
   - AWS Secret Access Key
   - AWS Account ID

## 🚀 Étape 1 : Configuration Automatique

### Option A : Script automatique (recommandé)

```bash
# Rendre le script exécutable
chmod +x scripts/setup-aws-new-account.sh

# Exécuter le script
./scripts/setup-aws-new-account.sh
```

Le script va :
1. ✅ Vérifier les prérequis
2. ✅ Configurer AWS CLI
3. ✅ Créer `terraform.tfvars` avec configuration optimisée
4. ✅ Initialiser Terraform
5. ✅ Créer l'infrastructure complète
6. ✅ Stocker DATABASE_URL dans SSM
7. ✅ Générer la configuration GitHub Actions

### Option B : Configuration manuelle

Si vous préférez configurer manuellement, suivez les étapes ci-dessous.

## 🔧 Étape 2 : Configuration AWS CLI

```bash
# Configurer AWS CLI avec vos nouvelles credentials
aws configure

# Entrer:
# AWS Access Key ID: [votre nouvelle clé]
# AWS Secret Access Key: [votre nouveau secret]
# Default region: af-south-1  # Cape Town pour l'Afrique
# Default output format: json
```

Vérifier la connexion :
```bash
aws sts get-caller-identity
```

## 🏗️ Étape 3 : Configuration Terraform

### 3.1 Créer terraform.tfvars

Copier `infra/aws/terraform.tfvars.example` vers `infra/aws/terraform.tfvars` :

```bash
cp infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
```

Modifier `terraform.tfvars` :

```hcl
# AWS Configuration - Optimisé pour Afrique
aws_region  = "af-south-1"  # Cape Town
project_name = "yukpomnang"
environment  = "production"

# RDS Configuration
rds_instance_class      = "db.t3.medium"
rds_engine_version      = "15.4"
rds_allocated_storage   = 20
rds_max_allocated_storage = 100
rds_database_name        = "yukpomnang"
rds_username            = "yukpo_admin"
rds_password            = "VOTRE_MOT_DE_PASSE_FORT_ICI"  # Générer avec: openssl rand -base64 32

# ElastiCache (Redis)
redis_engine_version = "7.0"
redis_node_type      = "cache.t3.small"
redis_num_nodes      = 1

# ECS Configuration
ecs_cpu          = 1024
ecs_memory       = 2048
ecs_desired_count = 2
ecs_min_count    = 2
ecs_max_count    = 10

# JWT Secret
jwt_secret      = "VOTRE_JWT_SECRET_ICI"  # Générer avec: openssl rand -base64 64
```

### 3.2 Initialiser Terraform

```bash
cd infra/aws
terraform init
```

### 3.3 Plan et Apply

```bash
# Voir ce qui sera créé
terraform plan

# Créer l'infrastructure
terraform apply
```

⏳ **Temps estimé** : 15-20 minutes pour créer toute l'infrastructure

## 🔐 Étape 4 : Configuration GitHub Secrets

1. Aller sur GitHub : `https://github.com/VOTRE_REPO/settings/secrets/actions`

2. Ajouter les secrets suivants :

   - **AWS_ACCESS_KEY_ID** : Votre nouvelle clé d'accès AWS
   - **AWS_SECRET_ACCESS_KEY** : Votre nouveau secret AWS

## 📝 Étape 5 : Mise à jour du Workflow GitHub Actions

Modifier `.github/workflows/docker-build-optimized.yml` :

```yaml
env:
  AWS_REGION: af-south-1  # Cape Town pour l'Afrique
  AWS_ACCOUNT_ID: VOTRE_NOUVEAU_ACCOUNT_ID  # Remplacer
  ECR_REPO_URI: VOTRE_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/yukpomnang-backend
  SSM_DATABASE_URL_PATH: /yukpomnang/production/DATABASE_URL
```

## 🗄️ Étape 6 : Configuration des Migrations Automatiques

Les migrations sont **automatiquement configurées** via le script `scripts/run_migrations_aws.py`.

### Vérification

Le workflow GitHub Actions exécute automatiquement :
1. ✅ Récupération de `DATABASE_URL` depuis SSM
2. ✅ Vérification de l'état des migrations
3. ✅ Application des migrations manquantes
4. ✅ Build et push Docker vers ECR
5. ✅ Déploiement ECS automatique

### Ordre d'exécution

```
1. Push sur main/master
   ↓
2. Job "run-migrations" :
   ├─ Récupère DATABASE_URL depuis SSM
   ├─ Vérifie l'état via sqlx migrate info
   └─ Applique les migrations manquantes
   ↓
3. Job "build-and-push" :
   ├─ Build Docker image optimisée
   └─ Push vers GitHub Container Registry
   ↓
4. Job "push-to-aws" :
   └─ Push vers AWS ECR
   ↓
5. Job "deploy-to-ecs" :
   └─ Déploiement automatique sur ECS
```

## 🌍 Étape 7 : Configuration CloudFront CDN (Optionnel)

Pour optimiser encore plus pour l'Afrique, configurez CloudFront :

```bash
# Créer une distribution CloudFront
aws cloudfront create-distribution \
  --origin-domain-name VOTRE_ALB_DNS \
  --default-root-object index.html \
  --enabled
```

**Points de présence en Afrique** :
- ✅ Johannesburg (Afrique du Sud)
- ✅ Nairobi (Kenya)
- ✅ Lagos (Nigeria)

## ✅ Étape 8 : Vérification

### Vérifier l'infrastructure

```bash
# Vérifier RDS
aws rds describe-db-instances --region af-south-1

# Vérifier ElastiCache
aws elasticache describe-cache-clusters --region af-south-1

# Vérifier ECS
aws ecs list-clusters --region af-south-1
aws ecs list-services --cluster yukpomnang-cluster --region af-south-1

# Vérifier SSM Parameter
aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region af-south-1 --with-decryption
```

### Tester le déploiement

1. **Push sur main/master** :
   ```bash
   git add .
   git commit -m "Configure AWS new account"
   git push origin main
   ```

2. **Vérifier GitHub Actions** :
   - Aller sur `https://github.com/VOTRE_REPO/actions`
   - Vérifier que le workflow "Docker Build Optimized" s'exécute
   - Vérifier que les migrations s'appliquent correctement

3. **Vérifier ECS** :
   ```bash
   aws ecs describe-services \
     --cluster yukpomnang-cluster \
     --services yukpomnang-backend-service \
     --region af-south-1
   ```

## 📊 Coûts Estimés (Afrique du Sud)

| Service | Configuration | Coût/mois |
|---------|--------------|-----------|
| RDS (db.t3.medium) | 20GB storage | ~$60 |
| ElastiCache (cache.t3.small) | 1 node | ~$15 |
| ECS Fargate | 2 tasks (1 vCPU, 2GB) | ~$60 |
| ALB | Standard | ~$20 |
| NAT Gateway | 1 gateway | ~$35 |
| CloudFront | 100GB transfer | ~$10 |
| **Total** | | **~$200/mois** |

## 🔒 Sécurité

### Bonnes pratiques

1. ✅ **Ne jamais commiter** `terraform.tfvars` (déjà dans `.gitignore`)
2. ✅ **Utiliser AWS Secrets Manager** pour les secrets sensibles
3. ✅ **Activer MFA** sur votre compte AWS
4. ✅ **Configurer des budgets AWS** pour éviter les surprises
5. ✅ **Utiliser IAM roles** au lieu de credentials statiques quand possible

### Configuration Budget AWS

```bash
# Créer un budget de $250/mois avec alertes
aws budgets create-budget \
  --account-id VOTRE_ACCOUNT_ID \
  --budget file://budget.json
```

## 🐛 Dépannage

### Erreur : "Cannot connect to RDS"

**Cause** : RDS dans VPC privé, non accessible depuis GitHub Actions

**Solution** : C'est normal ! Les migrations s'exécutent automatiquement au démarrage de l'application ECS.

### Erreur : "ECR repository not found"

**Solution** : Le repository ECR est créé automatiquement par Terraform. Vérifier :
```bash
aws ecr describe-repositories --region af-south-1
```

### Erreur : "SSM parameter not found"

**Solution** : Créer manuellement :
```bash
aws ssm put-parameter \
  --name /yukpomnang/production/DATABASE_URL \
  --value "postgresql://user:pass@host:5432/db" \
  --type SecureString \
  --region af-south-1
```

## 📚 Ressources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [GitHub Actions AWS](https://github.com/aws-actions)

## ✅ Checklist Finale

- [ ] AWS CLI configuré avec nouvelles credentials
- [ ] Terraform initialisé et infrastructure créée
- [ ] GitHub Secrets configurés (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- [ ] Workflow GitHub Actions mis à jour (AWS_REGION, AWS_ACCOUNT_ID)
- [ ] DATABASE_URL stocké dans SSM
- [ ] Premier déploiement réussi
- [ ] Migrations appliquées automatiquement
- [ ] Budget AWS configuré avec alertes
- [ ] CloudFront CDN configuré (optionnel)

---

**🎉 Configuration terminée ! Votre infrastructure AWS est prête pour l'Afrique !**

