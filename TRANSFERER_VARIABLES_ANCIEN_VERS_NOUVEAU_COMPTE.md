# 🔄 Transférer les Variables d'Environnement : Ancien → Nouveau Compte

## 🎯 Objectif

Récupérer toutes les variables d'environnement de l'ancien compte AWS et les transférer vers le nouveau compte.

---

## 📋 Méthode 1 : Récupération Automatique (Recommandé)

### Étape 1 : Configurer les Credentials de l'Ancien Compte

```bash
# Sauvegarder les credentials actuels (nouveau compte)
aws configure list > ~/aws-config-nouveau.txt

# Configurer l'ancien compte (temporairement)
export AWS_PROFILE=ancien-compte
# ou
aws configure --profile ancien-compte
# Entrez les credentials de l'ancien compte
```

### Étape 2 : Récupérer Toutes les Variables

#### A. SSM Parameter Store

```bash
# Récupérer toutes les variables SSM de l'ancien compte
aws ssm get-parameters-by-path \
  --path "/yukpomnang/production" \
  --region us-east-1 \
  --profile ancien-compte \
  --recursive \
  --with-decryption \
  --query 'Parameters[*].[Name,Value,Type]' \
  --output json > ancien-compte-ssm-params.json
```

#### B. Secrets Manager

```bash
# Récupérer les secrets de l'ancien compte
aws secretsmanager get-secret-value \
  --secret-id yukpomnang/backend/secrets \
  --region us-east-1 \
  --profile ancien-compte \
  --query 'SecretString' \
  --output text > ancien-compte-secrets.json
```

#### C. Variables d'Environnement du Backend

Si vous avez un fichier `.env` ou des variables sur le serveur Hetzner :

```bash
# Sur votre serveur Hetzner
env | grep -E "DATABASE_URL|REDIS_URL|JWT_SECRET|S3_|MONGODB|EMAIL|SMS" > variables-env.txt
```

---

## 📋 Méthode 2 : Récupération Manuelle (Si Méthode 1 ne fonctionne pas)

### Via AWS Console

1. **SSM Parameter Store :**
   - Ancien compte : https://console.aws.amazon.com/systems-manager/parameters
   - Région : `us-east-1` (ou la région utilisée)
   - Cherchez : `/yukpomnang/production/`
   - Copiez toutes les variables

2. **Secrets Manager :**
   - Ancien compte : https://console.aws.amazon.com/secretsmanager/
   - Cherchez : `yukpomnang/backend/secrets`
   - Affichez la valeur secrète et copiez

3. **Variables du Serveur :**
   - Connectez-vous à votre serveur Hetzner
   - Récupérez les variables d'environnement

---

## 🔄 Script de Transfert Automatique

Créez un fichier `scripts/transfer-variables.sh` :

```bash
#!/bin/bash

# Configuration
OLD_REGION="us-east-1"
NEW_REGION="eu-west-1"
OLD_PROFILE="ancien-compte"
NEW_PROFILE="default"  # ou nouveau-compte
OLD_PATH="/yukpomnang/production"
NEW_PATH="/yukpo/production"

echo "🔄 Transfert des variables SSM Parameter Store..."

# Récupérer toutes les variables de l'ancien compte
aws ssm get-parameters-by-path \
  --path "$OLD_PATH" \
  --region "$OLD_REGION" \
  --profile "$OLD_PROFILE" \
  --recursive \
  --with-decryption \
  --query 'Parameters[*]' \
  --output json > /tmp/old-params.json

# Transférer vers le nouveau compte
jq -r '.[] | "\(.Name | sub("'$OLD_PATH'"; "'$NEW_PATH'"))|\(.Type)|\(.Value)"' /tmp/old-params.json | while IFS='|' read -r name type value; do
  echo "📝 Transfert: $name"
  aws ssm put-parameter \
    --name "$name" \
    --value "$value" \
    --type "$type" \
    --region "$NEW_REGION" \
    --profile "$NEW_PROFILE" \
    --overwrite
done

echo "✅ Transfert terminé !"
```

---

## 📋 Liste des Variables à Transférer

### Variables Critiques (Priorité 1)

1. **DATABASE_URL** (dans Secrets Manager)
   - Format : `postgresql://user:password@host:port/database`
   - **⚠️ IMPORTANT :** Mettre à jour avec la nouvelle URL RDS AWS

2. **REDIS_URL** (dans Secrets Manager)
   - Format : `redis://host:port/db`
   - **⚠️ IMPORTANT :** Mettre à jour avec la nouvelle URL ElastiCache AWS

3. **JWT_SECRET** (dans Secrets Manager)
   - Peut être réutilisé tel quel

### Variables S3/Wasabi (Priorité 2)

4. **S3_BUCKET** ou **AWS_S3_BUCKET**
   - Ancien : probablement Wasabi
   - Nouveau : `yukpo-backend-media` (déjà configuré)

5. **S3_REGION** ou **AWS_REGION**
   - Ancien : `eu-central-1` (Wasabi) ou autre
   - Nouveau : `eu-west-1` (déjà configuré)

6. **S3_ACCESS_KEY** et **S3_SECRET_KEY**
   - Ancien : Credentials Wasabi
   - Nouveau : Credentials AWS S3 (déjà configuré)

7. **UPLOAD_BASE_URL**
   - Ancien : URL Wasabi
   - Nouveau : `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com` (déjà configuré)

### Variables Application (Priorité 3)

8. **MONGODB_URL**
   - Peut être réutilisé tel quel (si MongoDB externe)

9. **EMAIL_* (SendGrid)**
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - `SENDGRID_FROM_NAME`
   - Peuvent être réutilisées

10. **SMS_* (Twilio)**
    - `TWILIO_ACCOUNT_SID`
    - `TWILIO_AUTH_TOKEN`
    - `TWILIO_FROM_NUMBER`
    - Peuvent être réutilisées

11. **IA/OpenAI**
    - `OPENAI_API_KEY`
    - `MISTRAL_API_KEY`
    - `GEMINI_API_KEY`
    - Peuvent être réutilisées

12. **Google Maps**
    - `GOOGLE_MAPS_API_KEY`
    - Peut être réutilisé

13. **Autres Variables**
    - `LAUNCH_PHASE_START_DATE`
    - `RUST_LOG`
    - `ALLOWED_ORIGINS`
    - etc.

---

## 🔧 Commandes pour Récupérer les Variables

### Depuis l'Ancien Compte (via CLI)

```bash
# 1. SSM Parameter Store
aws ssm get-parameters-by-path \
  --path "/yukpomnang/production" \
  --region us-east-1 \
  --recursive \
  --with-decryption \
  --output json > ancien-ssm-params.json

# 2. Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id yukpomnang/backend/secrets \
  --region us-east-1 \
  --query 'SecretString' \
  --output text > ancien-secrets.json

# 3. Afficher toutes les variables
cat ancien-ssm-params.json | jq '.[] | {Name: .Name, Value: .Value, Type: .Type}'
cat ancien-secrets.json | jq '.'
```

---

## 📝 Template pour Me Donner les Variables

Si vous préférez me donner les variables manuellement, utilisez ce format :

```markdown
# Variables à Transférer

## Secrets Manager (yukpomnang/backend/secrets)
- DATABASE_URL: [valeur]
- REDIS_URL: [valeur]
- JWT_SECRET: [valeur]

## SSM Parameter Store (/yukpomnang/production/)
- S3_BUCKET: [valeur]
- S3_REGION: [valeur]
- S3_ACCESS_KEY: [valeur]
- S3_SECRET_KEY: [valeur]
- UPLOAD_BASE_URL: [valeur]
- MONGODB_URL: [valeur]
- SENDGRID_API_KEY: [valeur]
- TWILIO_ACCOUNT_SID: [valeur]
- OPENAI_API_KEY: [valeur]
- GOOGLE_MAPS_API_KEY: [valeur]
- etc.
```

---

## ⚠️ Variables à Mettre à Jour (Pas de Transfert Direct)

Ces variables doivent être mises à jour avec les nouvelles valeurs AWS :

1. **DATABASE_URL** → Nouvelle URL RDS AWS
2. **REDIS_URL** → Nouvelle URL ElastiCache AWS
3. **S3_BUCKET** → `yukpo-backend-media` (déjà fait)
4. **S3_REGION** → `eu-west-1` (déjà fait)
5. **S3_ACCESS_KEY/SECRET_KEY** → Nouvelles credentials AWS (déjà fait)
6. **UPLOAD_BASE_URL** → Nouvelle URL S3 AWS (déjà fait)

---

## 🚀 Action Immédiate

**Option 1 :** Exécutez les commandes ci-dessus pour récupérer les variables et envoyez-moi les fichiers JSON.

**Option 2 :** Donnez-moi les valeurs des variables importantes (sans les secrets sensibles) et je les configure dans le nouveau compte.

**Option 3 :** Je peux créer un script qui fait tout automatiquement si vous avez les credentials des deux comptes.

Quelle option préférez-vous ?

