# 🔍 Vérification Variables d'Environnement et S3/CDN

## 📋 Objectif

Vérifier que toutes les variables d'environnement du backend sont configurées dans AWS et que le système S3/CDN pour les médias est opérationnel.

---

## ✅ Étape 1 : Vérifier les Variables d'Environnement

### Script : `scripts/verifier_variables_environnement_aws.ps1`

Ce script vérifie :
- **Secrets Manager** : Variables sensibles (DATABASE_URL, REDIS_URL, JWT_SECRET, etc.)
- **SSM Parameter Store** : Variables de configuration (S3_BUCKET, S3_REGION, etc.)

### Variables attendues

#### Secrets Manager (`yukpo/backend/secrets`)
- ✅ `DATABASE_URL`
- ✅ `REDIS_URL`
- ✅ `JWT_SECRET`
- ✅ `MONGODB_URL`
- ✅ `RUST_LOG`
- ✅ `PORT`
- ✅ `HOST`
- ✅ `APP_ENV`
- ✅ `ENABLE_AUTO_MIGRATIONS`

#### SSM Parameter Store (`/yukpo/production/...`)
- ✅ `S3_BUCKET`
- ✅ `S3_REGION`
- ✅ `S3_ACCESS_KEY`
- ✅ `S3_SECRET_KEY`
- ✅ `UPLOAD_BASE_URL`
- ✅ `LAUNCH_PHASE_START_DATE`

### Exécution

```powershell
.\scripts\verifier_variables_environnement_aws.ps1
```

---

## ✅ Étape 2 : Vérifier la Configuration S3

### Script : `scripts/verifier_s3_media.ps1`

Ce script vérifie :
1. ✅ Existence et accessibilité du bucket S3
2. ✅ Permissions publiques (Public Access Block)
3. ✅ Politique du bucket
4. ✅ Configuration CORS
5. ✅ Test d'upload d'un fichier
6. ✅ Test de téléchargement du fichier
7. ✅ Test d'accès public via URL CDN

### Exécution

```powershell
.\scripts\verifier_s3_media.ps1
```

---

## ✅ Étape 3 : Tester Upload et Lecture de Médias

### Script : `scripts/tester_upload_lecture_media.ps1`

Ce script teste :
1. ✅ Accessibilité du backend ECS
2. ✅ Health check du backend
3. ✅ Endpoints d'upload disponibles
4. ✅ Instructions pour test complet avec authentification

### Exécution

```powershell
.\scripts\tester_upload_lecture_media.ps1
```

---

## 📝 Configuration S3 Requise

### 1. Créer le Bucket S3

```bash
aws s3 mb s3://yukpo-backend-media --region eu-west-1
```

### 2. Configurer les Permissions Publiques

```bash
aws s3api put-bucket-public-access-block \
  --bucket yukpo-backend-media \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region eu-west-1
```

### 3. Ajouter une Politique de Bucket

```bash
aws s3api put-bucket-policy --bucket yukpo-backend-media --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::yukpo-backend-media/*"
    }
  ]
}' --region eu-west-1
```

### 4. Configurer CORS

```bash
aws s3api put-bucket-cors --bucket yukpo-backend-media --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}' --region eu-west-1
```

### 5. Créer les Variables SSM

```powershell
# S3_BUCKET
aws ssm put-parameter `
  --name "/yukpo/production/S3_BUCKET" `
  --value "yukpo-backend-media" `
  --type "String" `
  --region eu-west-1

# S3_REGION
aws ssm put-parameter `
  --name "/yukpo/production/S3_REGION" `
  --value "eu-west-1" `
  --type "String" `
  --region eu-west-1

# S3_ACCESS_KEY (remplacer par vos credentials)
aws ssm put-parameter `
  --name "/yukpo/production/S3_ACCESS_KEY" `
  --value "YOUR_ACCESS_KEY" `
  --type "SecureString" `
  --region eu-west-1

# S3_SECRET_KEY (remplacer par vos credentials)
aws ssm put-parameter `
  --name "/yukpo/production/S3_SECRET_KEY" `
  --value "YOUR_SECRET_KEY" `
  --type "SecureString" `
  --region eu-west-1

# UPLOAD_BASE_URL (URL CloudFront ou S3 direct)
aws ssm put-parameter `
  --name "/yukpo/production/UPLOAD_BASE_URL" `
  --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" `
  --type "String" `
  --region eu-west-1
```

---

## 🔧 Configuration CloudFront (Optionnel mais Recommandé)

### 1. Créer une Distribution CloudFront

```bash
# Via AWS Console recommandé pour la configuration complète
# Ou via Terraform (à ajouter dans infra/aws/main.tf)
```

### 2. Mettre à jour UPLOAD_BASE_URL

```powershell
aws ssm put-parameter `
  --name "/yukpo/production/UPLOAD_BASE_URL" `
  --value "https://d1234567890.cloudfront.net" `
  --type "String" `
  --overwrite `
  --region eu-west-1
```

---

## ✅ Checklist de Vérification

- [ ] Toutes les variables Secrets Manager présentes
- [ ] Toutes les variables SSM Parameter Store présentes
- [ ] Bucket S3 créé et accessible
- [ ] Permissions publiques configurées
- [ ] Politique de bucket configurée
- [ ] CORS configuré
- [ ] Test d'upload réussi
- [ ] Test de téléchargement réussi
- [ ] Test d'accès public réussi (ou via CDN)
- [ ] Backend ECS accessible
- [ ] Endpoints d'upload fonctionnels

---

## 🚨 Résolution de Problèmes

### Variables manquantes dans SSM

Si des variables SSM sont manquantes, utilisez les commandes ci-dessus pour les créer.

### Bucket S3 inaccessible

1. Vérifier les permissions IAM du rôle ECS Task
2. Vérifier que le bucket existe dans la bonne région
3. Vérifier les Security Groups (si applicable)

### Upload échoue

1. Vérifier les credentials S3 (S3_ACCESS_KEY, S3_SECRET_KEY)
2. Vérifier les permissions IAM (s3:PutObject, s3:GetObject)
3. Vérifier que le bucket existe et est accessible

### Accès public ne fonctionne pas

1. Vérifier Public Access Block (doit permettre l'accès public)
2. Vérifier la politique du bucket
3. Si CloudFront est utilisé, vérifier la distribution et l'OAI/OAC

---

## 📚 Références

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)


