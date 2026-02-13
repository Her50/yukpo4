# 🔄 Changement de Région : eu-west-1 → us-east-1

## ✅ Modifications Effectuées

### 1. Terraform Configuration
- ✅ `infra/aws/terraform.tfvars` : `aws_region = "us-east-1"`

### 2. GitHub Actions
- ✅ `.github/workflows/docker-build-optimized.yml` : `AWS_REGION: us-east-1`
- ✅ `.github/workflows/docker-build-optimized.yml` : `ECR_REPO_URI` mis à jour pour `us-east-1`

### 3. Scripts
- ✅ `scripts/run_migrations_aws.py` : `AWS_REGION = "us-east-1"`

---

## ⚠️ Actions Requises

### 1. Mettre à Jour les Variables SSM

```powershell
# Mettre à jour S3_REGION
aws ssm put-parameter `
  --name "/yukpo/production/S3_REGION" `
  --value "us-east-1" `
  --type "String" `
  --region us-east-1 `
  --overwrite

# Mettre à jour UPLOAD_BASE_URL
aws ssm put-parameter `
  --name "/yukpo/production/UPLOAD_BASE_URL" `
  --value "https://yukpo-backend-media.s3.us-east-1.amazonaws.com" `
  --type "String" `
  --region us-east-1 `
  --overwrite
```

### 2. Supprimer les Ressources dans eu-west-1

```powershell
cd infra/aws
# Changer temporairement la région dans terraform.tfvars vers eu-west-1
# Puis :
terraform destroy
```

### 3. Recréer dans us-east-1

```powershell
cd infra/aws
# La région est déjà us-east-1 dans terraform.tfvars
terraform apply
```

---

## 🎯 Pourquoi us-east-1 ?

1. **Ancien compte utilisait us-east-1** → Fonctionnait sans problème
2. **Moins restrictive** pour nouveaux comptes
3. **Probablement pas besoin d'activation AWS Support** pour ELB
4. **Même configuration** que l'ancien compte qui fonctionnait

---

## ⚠️ Note sur la Latence

- **us-east-1** → Afrique : ~150-200ms
- **eu-west-1** → Afrique : ~100-150ms
- **af-south-1** → Afrique : ~20-50ms

**Pour l'instant**, utilisons `us-east-1` pour que tout fonctionne. **Plus tard**, nous pourrons migrer vers `af-south-1` une fois que tout est stable.

