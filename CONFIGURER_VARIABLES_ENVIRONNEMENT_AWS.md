# 🔧 Configurer les Variables d'Environnement AWS

## 📋 Variables à Configurer dans SSM Parameter Store

Terraform utilise AWS SSM Parameter Store pour stocker les variables d'environnement. Voici comment les configurer.

---

## ✅ Variables Déjà Configurées par Terraform

Ces variables sont automatiquement créées par Terraform dans Secrets Manager :
- `DATABASE_URL` (dans Secrets Manager)
- `REDIS_URL` (dans Secrets Manager)
- `JWT_SECRET` (dans Secrets Manager)

---

## 🔴 Variables à Configurer Manuellement dans SSM Parameter Store

Ces variables doivent être créées dans SSM Parameter Store avec le chemin : `/yukpo/production/{NOM_VARIABLE}`

### 1. S3_BUCKET

**Chemin :** `/yukpo/production/S3_BUCKET`

**Valeur :** Nom de votre bucket S3
- Si vous utilisez Wasabi : `yukpo-video-prod`
- Si vous créez un nouveau bucket AWS : `yukpo-backend-media`

**Comment créer :**
```bash
aws ssm put-parameter \
  --name "/yukpo/production/S3_BUCKET" \
  --value "yukpo-backend-media" \
  --type "String" \
  --region eu-west-1
```

---

### 2. S3_REGION

**Chemin :** `/yukpo/production/S3_REGION`

**Valeur :** `eu-west-1` (ou la région de votre bucket)

**Comment créer :**
```bash
aws ssm put-parameter \
  --name "/yukpo/production/S3_REGION" \
  --value "eu-west-1" \
  --type "String" \
  --region eu-west-1
```

---

### 3. S3_ACCESS_KEY et S3_SECRET_KEY

**Chemins :**
- `/yukpo/production/S3_ACCESS_KEY`
- `/yukpo/production/S3_SECRET_KEY`

**Valeurs :** Vos credentials S3/Wasabi

**⚠️ SÉCURITÉ :** Utilisez le type "SecureString" pour les secrets

**Comment créer :**
```bash
# Access Key
aws ssm put-parameter \
  --name "/yukpo/production/S3_ACCESS_KEY" \
  --value "VOTRE_ACCESS_KEY" \
  --type "SecureString" \
  --region eu-west-1

# Secret Key
aws ssm put-parameter \
  --name "/yukpo/production/S3_SECRET_KEY" \
  --value "VOTRE_SECRET_KEY" \
  --type "SecureString" \
  --region eu-west-1
```

---

### 4. UPLOAD_BASE_URL (CRITIQUE pour les images)

**Chemin :** `/yukpo/production/UPLOAD_BASE_URL`

**Valeur :** URL de base pour les médias
- Pour Wasabi : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`
- Pour AWS S3 : `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- Avec CloudFront : `https://d1234567890.cloudfront.net`

**Comment créer :**
```bash
aws ssm put-parameter \
  --name "/yukpo/production/UPLOAD_BASE_URL" \
  --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" \
  --type "String" \
  --region eu-west-1
```

---

### 5. LAUNCH_PHASE_START_DATE

**Chemin :** `/yukpo/production/LAUNCH_PHASE_START_DATE`

**Valeur :** Date de lancement (format ISO 8601)
- Exemple : `2026-02-12T00:00:00Z`

**Comment créer :**
```bash
aws ssm put-parameter \
  --name "/yukpo/production/LAUNCH_PHASE_START_DATE" \
  --value "2026-02-12T00:00:00Z" \
  --type "String" \
  --region eu-west-1
```

---

## 🚀 Script Automatique

Créez un fichier `scripts/setup-aws-ssm-params.sh` :

```bash
#!/bin/bash

REGION="eu-west-1"
PROJECT_NAME="yukpo"
ENVIRONMENT="production"

# S3 Configuration
aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/S3_BUCKET" \
  --value "yukpo-backend-media" \
  --type "String" \
  --region $REGION \
  --overwrite

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/S3_REGION" \
  --value "eu-west-1" \
  --type "String" \
  --region $REGION \
  --overwrite

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/S3_ACCESS_KEY" \
  --value "VOTRE_ACCESS_KEY" \
  --type "SecureString" \
  --region $REGION \
  --overwrite

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/S3_SECRET_KEY" \
  --value "VOTRE_SECRET_KEY" \
  --type "SecureString" \
  --region $REGION \
  --overwrite

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/UPLOAD_BASE_URL" \
  --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" \
  --type "String" \
  --region $REGION \
  --overwrite

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/${ENVIRONMENT}/LAUNCH_PHASE_START_DATE" \
  --value "2026-02-12T00:00:00Z" \
  --type "String" \
  --region $REGION \
  --overwrite

echo "✅ Variables SSM configurées avec succès !"
```

---

## 📋 Checklist

- [ ] Créer le bucket S3 (ou utiliser Wasabi existant)
- [ ] Configurer `S3_BUCKET` dans SSM
- [ ] Configurer `S3_REGION` dans SSM
- [ ] Configurer `S3_ACCESS_KEY` dans SSM (SecureString)
- [ ] Configurer `S3_SECRET_KEY` dans SSM (SecureString)
- [ ] Configurer `UPLOAD_BASE_URL` dans SSM (CRITIQUE pour les images)
- [ ] Configurer `LAUNCH_PHASE_START_DATE` dans SSM

---

## 🔍 Vérification

Vérifiez que toutes les variables sont créées :

```bash
aws ssm get-parameters-by-path \
  --path "/yukpo/production" \
  --region eu-west-1 \
  --query 'Parameters[*].Name' \
  --output table
```

---

## 💡 Note Importante

**UPLOAD_BASE_URL est CRITIQUE** pour résoudre le problème des images produits. Assurez-vous de le configurer correctement !

