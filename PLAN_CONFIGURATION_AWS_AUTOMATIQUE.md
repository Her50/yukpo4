# 🚀 Plan de Configuration AWS Automatique

## 📋 Ce Que Je Vais Faire Automatiquement

Une fois que vous m'aurez donné les credentials AWS, je vais mettre à jour **tous les fichiers de configuration** automatiquement :

---

## ✅ Fichiers à Mettre à Jour

### 1. `.github/workflows/docker-build-optimized.yml`

**Modifications :**
- ✅ `AWS_REGION` : Nouvelle région AWS
- ✅ `AWS_ACCOUNT_ID` : Nouveau Account ID
- ✅ `ECR_REPO_URI` : Nouvelle URI ECR avec le nouveau Account ID
- ✅ `SSM_DATABASE_URL_PATH` : Chemin SSM pour DATABASE_URL (si différent)

**Lignes concernées :**
```yaml
env:
  AWS_REGION: [NOUVELLE_RÉGION]
  AWS_ACCOUNT_ID: [NOUVEAU_ACCOUNT_ID]
  ECR_REPO_URI: [NOUVEAU_ACCOUNT_ID].dkr.ecr.[RÉGION].amazonaws.com/yukpomnang-backend
  SSM_DATABASE_URL_PATH: /yukpomnang/production/DATABASE_URL
```

---

### 2. `infra/aws/terraform.tfvars`

**Modifications :**
- ✅ `aws_region` : Nouvelle région
- ✅ `rds_instance_class` : Configuration RDS
- ✅ `rds_allocated_storage` : Stockage initial
- ✅ `rds_max_allocated_storage` : Stockage maximum
- ✅ `rds_password` : Mot de passe RDS
- ✅ `redis_node_type` : Type d'instance Redis
- ✅ `ecs_cpu` : CPU ECS
- ✅ `ecs_memory` : Mémoire ECS
- ✅ `ecs_desired_count` : Nombre d'instances
- ✅ `ecs_min_count` : Minimum d'instances
- ✅ `ecs_max_count` : Maximum d'instances
- ✅ `jwt_secret` : Secret JWT

**Exemple :**
```hcl
aws_region = "af-south-1"
rds_instance_class = "db.t3.medium"
rds_allocated_storage = 20
rds_max_allocated_storage = 100
rds_password = "VotreMotDePasseFort"
redis_node_type = "cache.t3.small"
ecs_cpu = 1024
ecs_memory = 2048
ecs_desired_count = 2
ecs_min_count = 2
ecs_max_count = 10
jwt_secret = "VotreJWTSecret"
```

---

### 3. `scripts/run_migrations_aws.py`

**Modifications :**
- ✅ `AWS_REGION` : Nouvelle région (défaut)
- ✅ `SSM_DATABASE_URL_PATH` : Chemin SSM (si différent)

**Lignes concernées :**
```python
AWS_REGION = os.getenv("AWS_REGION", "af-south-1")  # Nouvelle région
SSM_PARAMETER_PATH = os.getenv("SSM_DATABASE_URL_PATH", "/yukpomnang/production/DATABASE_URL")
```

---

### 4. Documentation

**Création/Mise à jour :**
- ✅ Guide de configuration AWS mis à jour
- ✅ Instructions pour secrets GitHub
- ✅ Checklist de vérification

---

## ⚠️ Actions Manuelles Requises (Vous)

### 1. Mettre à Jour les Secrets GitHub

**Où :** https://github.com/[VOTRE_REPO]/settings/secrets/actions

**Secrets à mettre à jour :**
- `AWS_ACCESS_KEY_ID` : Nouvelle Access Key
- `AWS_SECRET_ACCESS_KEY` : Nouvelle Secret Key

**Étapes :**
1. Allez dans GitHub > Settings > Secrets and variables > Actions
2. Cliquez sur `AWS_ACCESS_KEY_ID` > **Update**
3. Entrez la nouvelle valeur > **Update secret**
4. Répétez pour `AWS_SECRET_ACCESS_KEY`

---

### 2. Créer l'Infrastructure AWS (Première Fois)

**Si c'est un nouveau compte AWS, vous devez créer l'infrastructure :**

```bash
# Option A : Via Terraform (recommandé)
cd infra/aws
terraform init
terraform plan  # Vérifier ce qui sera créé
terraform apply  # Créer l'infrastructure

# Option B : Via Script PowerShell
.\scripts\deploy-aws.ps1
```

**Temps estimé :** 15-20 minutes

**Ce qui sera créé :**
- ✅ VPC avec sous-réseaux publics/privés
- ✅ RDS PostgreSQL (avec pgvector)
- ✅ ElastiCache Redis
- ✅ ECR Repository
- ✅ ECS Cluster
- ✅ ECS Service
- ✅ Application Load Balancer
- ✅ Security Groups
- ✅ IAM Roles
- ✅ SSM Parameters (pour secrets)

---

### 3. Vérifier la Configuration

**Après la mise à jour, vérifiez :**

```bash
# Vérifier AWS CLI
aws sts get-caller-identity

# Vérifier la région
aws configure get region

# Vérifier ECR
aws ecr describe-repositories --region [VOTRE_RÉGION]
```

---

## 🔄 Ordre d'Exécution Recommandé

### Phase 1 : Configuration (5 minutes)
1. ✅ Vous me donnez les credentials
2. ✅ Je mets à jour tous les fichiers
3. ✅ Vous mettez à jour les secrets GitHub

### Phase 2 : Infrastructure (15-20 minutes)
4. ✅ Vous créez l'infrastructure AWS (Terraform)
5. ✅ Vérification que tout est créé

### Phase 3 : Déploiement (10-15 minutes)
6. ✅ Push sur GitHub (déclenche le workflow)
7. ✅ GitHub Actions build et push vers ECR
8. ✅ GitHub Actions déploie sur ECS
9. ✅ Vérification que l'application fonctionne

---

## ✅ Checklist Finale

Après toutes les modifications, vérifiez :

- [ ] Fichiers mis à jour (je le ferai)
- [ ] Secrets GitHub mis à jour (vous)
- [ ] Infrastructure AWS créée (vous, via Terraform)
- [ ] ECR Repository existe
- [ ] RDS PostgreSQL créé et accessible
- [ ] ElastiCache Redis créé
- [ ] ECS Cluster créé
- [ ] ECS Service créé
- [ ] Workflow GitHub Actions fonctionne
- [ ] Application déployée et accessible

---

## 🆘 En Cas de Problème

### Erreur : "Access Denied"
- ✅ Vérifier les permissions IAM de l'utilisateur
- ✅ Vérifier que les secrets GitHub sont corrects

### Erreur : "Repository not found"
- ✅ Créer le repository ECR manuellement :
  ```bash
  aws ecr create-repository --repository-name yukpomnang-backend --region [VOTRE_RÉGION]
  ```

### Erreur : "VPC not found"
- ✅ L'infrastructure Terraform doit être créée d'abord

### Erreur : "Migrations failed"
- ✅ Vérifier que RDS est accessible depuis ECS
- ✅ Vérifier le Security Group de RDS
- ✅ Vérifier que le SSM Parameter existe

---

## 📞 Support

Si vous rencontrez un problème, dites-moi :
1. Le message d'erreur exact
2. À quelle étape vous êtes
3. Les logs GitHub Actions (si applicable)

Je vous aiderai à résoudre le problème ! 🚀

