# 🪣 Configuration S3 AWS pour les Médias

## 🎯 Objectif

Créer un bucket S3 AWS et configurer `UPLOAD_BASE_URL` pour servir les images produits.

---

## 📋 Étape 1 : Créer le Bucket S3

### Via AWS Console (Recommandé)

1. **Allez sur S3 :** https://console.aws.amazon.com/s3/
2. **Cliquez sur "Créer un bucket"** (Create bucket)
3. **Configuration :**
   - **Nom du bucket :** `yukpo-backend-media` (doit être unique globalement)
   - **Région :** `eu-west-1` (Irlande)
   - **Paramètres par défaut :** Gardez les valeurs par défaut
4. **Permissions :**
   - **Bloquer l'accès public :** DÉSACTIVÉ (pour permettre l'accès public aux images)
   - Ou utilisez CloudFront avec OAI (plus sécurisé)
5. **Créer le bucket**

### Via AWS CLI

```bash
# Créer le bucket
aws s3 mb s3://yukpo-backend-media --region eu-west-1

# Activer l'accès public (pour les images)
aws s3api put-bucket-public-access-block \
  --bucket yukpo-backend-media \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region eu-west-1

# Ajouter une politique de bucket pour l'accès public en lecture
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

---

## 📋 Étape 2 : Configurer CORS

Pour permettre au frontend d'accéder aux images :

```bash
aws s3api put-bucket-cors --bucket yukpo-backend-media --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": [],
      "MaxAgeSeconds": 3000
    }
  ]
}' --region eu-west-1
```

**⚠️ Note :** Remplacez `"AllowedOrigins": ["*"]` par vos domaines de production pour plus de sécurité :
```json
"AllowedOrigins": [
  "https://votre-domaine.com",
  "https://app.votre-domaine.com"
]
```

---

## 📋 Étape 3 : Configurer UPLOAD_BASE_URL dans SSM

### URL du Bucket S3

L'URL de base pour votre bucket sera :
```
https://yukpo-backend-media.s3.eu-west-1.amazonaws.com
```

### Configurer dans SSM Parameter Store

```bash
aws ssm put-parameter \
  --name "/yukpo/production/UPLOAD_BASE_URL" \
  --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" \
  --type "String" \
  --region eu-west-1 \
  --overwrite
```

---

## 📋 Étape 4 : Configurer les Credentials S3

### Option A : Utiliser les Credentials IAM (Recommandé)

Si votre backend ECS utilise un rôle IAM, vous n'avez pas besoin de credentials séparés. Le rôle IAM de la tâche ECS aura les permissions S3.

### Option B : Utiliser des Access Keys S3

Si vous préférez utiliser des Access Keys (comme pour Wasabi) :

1. **Créer un utilisateur IAM pour S3 :**
   - IAM > Users > Create user
   - Nom : `yukpo-s3-media`
   - Attacher la politique : `AmazonS3FullAccess` (ou une politique personnalisée plus restrictive)

2. **Créer les Access Keys :**
   - Onglet "Security credentials"
   - "Create access key"
   - Sauvegarder les clés

3. **Configurer dans SSM :**
```bash
# Access Key
aws ssm put-parameter \
  --name "/yukpo/production/S3_ACCESS_KEY" \
  --value "VOTRE_ACCESS_KEY" \
  --type "SecureString" \
  --region eu-west-1 \
  --overwrite

# Secret Key
aws ssm put-parameter \
  --name "/yukpo/production/S3_SECRET_KEY" \
  --value "VOTRE_SECRET_KEY" \
  --type "SecureString" \
  --region eu-west-1 \
  --overwrite
```

---

## 📋 Étape 5 : Configurer les Autres Variables SSM

```bash
# S3_BUCKET
aws ssm put-parameter \
  --name "/yukpo/production/S3_BUCKET" \
  --value "yukpo-backend-media" \
  --type "String" \
  --region eu-west-1 \
  --overwrite

# S3_REGION
aws ssm put-parameter \
  --name "/yukpo/production/S3_REGION" \
  --value "eu-west-1" \
  --type "String" \
  --region eu-west-1 \
  --overwrite

# S3_ENDPOINT (optionnel - laisser vide pour AWS S3 standard)
# Pas besoin pour AWS S3 standard
```

---

## 🔍 Vérification

### Vérifier que le bucket existe

```bash
aws s3 ls s3://yukpo-backend-media --region eu-west-1
```

### Vérifier les variables SSM

```bash
aws ssm get-parameters-by-path \
  --path "/yukpo/production" \
  --region eu-west-1 \
  --query 'Parameters[*].[Name,Type]' \
  --output table
```

### Tester l'URL

```bash
# L'URL devrait être accessible (même si vide)
curl -I https://yukpo-backend-media.s3.eu-west-1.amazonaws.com/
```

---

## 🎯 Structure du Bucket

Vos médias seront organisés ainsi :

```
yukpo-backend-media/
└── uploads/
    ├── services/
    │   └── {service_id}/
    │       ├── images/
    │       ├── videos/
    │       └── audio/
    ├── products/
    │   └── {product_id}/
    │       └── {image_name}
    ├── comments/
    │   └── {comment_id}/
    │       └── {media_name}
    └── videos/
        └── {video_id}.mp4
```

---

## 🔒 Sécurité (Optionnel mais Recommandé)

### Utiliser CloudFront au lieu de l'accès public direct

1. **Créer une distribution CloudFront** pointant vers le bucket
2. **Configurer OAI (Origin Access Identity)** pour restreindre l'accès
3. **Mettre à jour UPLOAD_BASE_URL** avec l'URL CloudFront :
   ```bash
   aws ssm put-parameter \
     --name "/yukpo/production/UPLOAD_BASE_URL" \
     --value "https://d1234567890.cloudfront.net" \
     --type "String" \
     --region eu-west-1 \
     --overwrite
   ```

**Avantages CloudFront :**
- ✅ HTTPS automatique
- ✅ CDN global (meilleure latence pour l'Afrique)
- ✅ Cache intelligent
- ✅ Protection DDoS
- ✅ Plus sécurisé (pas d'accès direct au bucket)

---

## 📋 Checklist

- [ ] Bucket S3 créé : `yukpo-backend-media`
- [ ] Accès public configuré (ou CloudFront)
- [ ] CORS configuré
- [ ] `UPLOAD_BASE_URL` configuré dans SSM
- [ ] `S3_BUCKET` configuré dans SSM
- [ ] `S3_REGION` configuré dans SSM
- [ ] Credentials S3 configurés (si nécessaire)
- [ ] Test d'upload réussi
- [ ] Test d'accès public réussi

---

## 🚀 Prochaines Étapes

Une fois S3 configuré :
1. ✅ Les images uploadées seront stockées dans S3
2. ✅ Les URLs générées utiliseront `UPLOAD_BASE_URL`
3. ✅ Les images seront accessibles publiquement
4. ✅ Le problème d'affichage des images sera résolu

---

## 💡 Note Importante

**Pour le serveur actuel (Hetzner) :** Vous devez aussi configurer `UPLOAD_BASE_URL` là-bas pour résoudre le problème immédiat des images :

```bash
# Sur votre serveur Hetzner
export UPLOAD_BASE_URL=https://yukpo-backend-media.s3.eu-west-1.amazonaws.com
# Redémarrer le backend
```

Une fois que vous migrez vers AWS ECS, cette variable sera automatiquement récupérée depuis SSM Parameter Store.

