# 🔄 Guide : Transférer les Variables de Render vers AWS

## 📋 Résumé des Modifications

### ✅ Variables à Mettre à Jour avec les Nouvelles Valeurs AWS

1. **DATABASE_URL** → Nouvelle URL RDS PostgreSQL AWS
2. **REDIS_URL** → Nouvelle URL ElastiCache Redis AWS
3. **S3_BUCKET** → `yukpo-backend-media` (nouveau bucket AWS)
4. **S3_REGION** → `eu-west-1` (nouvelle région)
5. **S3_ACCESS_KEY** → Nouvelles credentials IAM user `yukpo-s3-media`
6. **S3_SECRET_KEY** → Nouvelles credentials IAM user `yukpo-s3-media`
7. **S3_ENDPOINT** → Vide (AWS S3 standard, pas Wasabi)
8. **S3_FORCE_PATH_STYLE** → `false` (AWS S3 standard)
9. **UPLOAD_BASE_URL** → `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com`

### ⚠️ Variables GPU (DÉSACTIVÉES)

**AWS ECS Fargate ne supporte pas GPU**, donc ces variables sont désactivées :

- `GPU_AVAILABLE=false`
- `AMD_GPU_AVAILABLE=false`
- `BLENDER_USE_GPU=false`
- `VIDEO_RENDERER_ENABLE_GPU=false`
- `CUDA_VISIBLE_DEVICES=""`
- `NVIDIA_VISIBLE_DEVICES=""`

**Note :** Pour utiliser GPU, il faudrait migrer vers EC2 avec instances GPU (p3.2xlarge, g4dn.xlarge, etc.), mais cela coûte beaucoup plus cher (~$1-3/heure).

### ✅ Nouvelle Variable : LAUNCH_PHASE_START_DATE

Variable manquante dans Render mais présente dans l'ancien compte AWS :

- **Nom :** `LAUNCH_PHASE_START_DATE`
- **Format :** `2026-02-06T00:00:00Z` (RFC3339)
- **Description :** Date de début de la phase de lancement (3 mois gratuits pour création de produits)
- **Valeur par défaut :** Date actuelle si non définie
- **Durée :** 90 jours (3 mois)

---

## 🚀 Méthode Automatique : Script PowerShell

### Étape 1 : Exécuter le Script

```powershell
cd C:\Users\23767\yukpomnang2\scripts
.\configure-variables-aws.ps1
```

Le script va :
1. ✅ Récupérer automatiquement `DATABASE_URL` et `REDIS_URL` depuis Terraform outputs
2. ✅ Configurer toutes les variables dans AWS SSM Parameter Store
3. ✅ Désactiver les variables GPU
4. ✅ Configurer `LAUNCH_PHASE_START_DATE`

### Étape 2 : Actions Manuelles Requises

Après l'exécution du script, vous devez configurer manuellement :

#### 1. Credentials S3

```powershell
# Récupérer les credentials depuis IAM user yukpo-s3-media
aws iam list-access-keys --user-name yukpo-s3-media --region eu-west-1

# Si pas encore créé, créer l'access key
aws iam create-access-key --user-name yukpo-s3-media --region eu-west-1

# Configurer dans SSM
aws ssm put-parameter `
  --name "/yukpo/production/S3_ACCESS_KEY" `
  --value "AKIA..." `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite

aws ssm put-parameter `
  --name "/yukpo/production/S3_SECRET_KEY" `
  --value "secret..." `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite
```

#### 2. Vérifier DATABASE_URL et REDIS_URL

```powershell
# Vérifier DATABASE_URL
aws ssm get-parameter `
  --name "/yukpo/production/DATABASE_URL" `
  --region eu-west-1 `
  --with-decryption `
  --query 'Parameter.Value' `
  --output text

# Vérifier REDIS_URL
aws ssm get-parameter `
  --name "/yukpo/production/REDIS_URL" `
  --region eu-west-1 `
  --with-decryption `
  --query 'Parameter.Value' `
  --output text
```

#### 3. Mettre à Jour les Secrets Sensibles

```powershell
# SendGrid
aws ssm put-parameter `
  --name "/yukpo/production/SENDGRID_API_KEY" `
  --value "SG.xxxxx" `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite

# Twilio
aws ssm put-parameter `
  --name "/yukpo/production/TWILIO_ACCOUNT_SID" `
  --value "ACxxxxx" `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite

aws ssm put-parameter `
  --name "/yukpo/production/TWILIO_AUTH_TOKEN" `
  --value "xxxxx" `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite
```

---

## 📋 Liste Complète des Variables Configurées

### 🔴 Variables AWS (Nouvelles Valeurs)

| Variable | Ancienne Valeur (Render) | Nouvelle Valeur (AWS) |
|----------|---------------------------|----------------------|
| `DATABASE_URL` | Render PostgreSQL | AWS RDS PostgreSQL |
| `REDIS_URL` | Upstash Redis | AWS ElastiCache Redis |
| `S3_BUCKET` | `yukpomnang-media-prod` | `yukpo-backend-media` |
| `S3_REGION` | `us-east-1` | `eu-west-1` |
| `S3_ENDPOINT` | Wasabi endpoint | (vide) |
| `S3_ACCESS_KEY` | Wasabi credentials | AWS IAM credentials |
| `S3_SECRET_KEY` | Wasabi credentials | AWS IAM credentials |
| `UPLOAD_BASE_URL` | `https://cdn.yukpomnang.com` | `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` |

### ⚠️ Variables GPU (Désactivées)

| Variable | Ancienne Valeur | Nouvelle Valeur |
|----------|-----------------|-----------------|
| `GPU_AVAILABLE` | `false` | `false` |
| `AMD_GPU_AVAILABLE` | `true` | `false` |
| `BLENDER_USE_GPU` | `false` | `false` |
| `VIDEO_RENDERER_ENABLE_GPU` | `true` | `false` |
| `CUDA_VISIBLE_DEVICES` | `0,1` | (vide) |
| `NVIDIA_VISIBLE_DEVICES` | `all` | (vide) |

### ✅ Nouvelle Variable

| Variable | Description | Valeur |
|----------|-------------|--------|
| `LAUNCH_PHASE_START_DATE` | Date de début phase de lancement | `2026-02-06T00:00:00Z` (exemple) |

### 📦 Variables Transférées Telles Quelles

Toutes les autres variables sont transférées telles quelles depuis Render :
- Variables API (timeouts, rate limits)
- Variables IA (OpenAI, Sora, etc.)
- Variables Google (Maps, Translate, YouTube)
- Variables Email/SMS (SendGrid, Twilio)
- Variables LiveKit
- Variables Vidéo/Blender
- Variables Recherche
- Variables Livraison
- Variables Paiement Mobile Money
- Variables API Externes (Pexels, Pixabay, Unsplash, etc.)
- Variables Monitoring/Webhooks

---

## 🔍 Vérification

### Lister Toutes les Variables Configurées

```powershell
aws ssm get-parameters-by-path `
  --path "/yukpo/production" `
  --region eu-west-1 `
  --recursive `
  --query 'Parameters[*].Name' `
  --output table
```

### Vérifier une Variable Spécifique

```powershell
aws ssm get-parameter `
  --name "/yukpo/production/DATABASE_URL" `
  --region eu-west-1 `
  --with-decryption
```

---

## ⚠️ Notes Importantes

1. **GPU Désactivé :** AWS ECS Fargate ne supporte pas GPU. Pour utiliser GPU, migrez vers EC2 avec instances GPU (coût supplémentaire ~$1-3/heure).

2. **S3 vs Wasabi :** Les credentials S3 doivent être récupérées depuis l'utilisateur IAM `yukpo-s3-media` créé par Terraform.

3. **Secrets Sensibles :** Certaines variables comme `SENDGRID_API_KEY`, `TWILIO_*` doivent être mises à jour avec les vraies valeurs.

4. **Mobile Money :** Les variables `MTN_MONEY_*` et `ORANGE_MONEY_*` doivent être configurées avec les vraies credentials.

5. **Phase de Lancement :** La variable `LAUNCH_PHASE_START_DATE` détermine quand commence la période de 90 jours gratuits pour la création de produits.

---

## 🚀 Prochaines Étapes

1. ✅ Exécuter le script `configure-variables-aws.ps1`
2. ✅ Configurer les credentials S3 manuellement
3. ✅ Vérifier DATABASE_URL et REDIS_URL
4. ✅ Mettre à jour les secrets sensibles (SendGrid, Twilio, etc.)
5. ✅ Tester la connexion à la base de données
6. ✅ Tester l'upload vers S3
7. ✅ Déployer l'application sur ECS

