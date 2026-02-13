# 🔄 Transférer les Variables - Windows PowerShell

## 🎯 Méthode Simple : Commandes Directes

### Étape 1 : Configurer le Profil de l'Ancien Compte

```powershell
# Configurer les credentials de l'ancien compte
aws configure --profile ancien-compte
# Entrez :
# - AWS Access Key ID de l'ancien compte
# - AWS Secret Access Key de l'ancien compte
# - Default region: us-east-1 (ou la région utilisée)
# - Default output: json
```

---

### Étape 2 : Récupérer les Variables de l'Ancien Compte

```powershell
# 1. Récupérer toutes les variables SSM Parameter Store
aws ssm get-parameters-by-path `
  --path "/yukpomnang/production" `
  --region us-east-1 `
  --profile ancien-compte `
  --recursive `
  --with-decryption `
  --output json > ancien-ssm-params.json

# 2. Récupérer les secrets
aws secretsmanager get-secret-value `
  --secret-id yukpomnang/backend/secrets `
  --region us-east-1 `
  --profile ancien-compte `
  --query 'SecretString' `
  --output text > ancien-secrets.txt
```

---

### Étape 3 : Transférer vers le Nouveau Compte

Une fois les fichiers récupérés, envoyez-moi :
- `ancien-ssm-params.json`
- `ancien-secrets.txt`

Je les transférerai vers le nouveau compte.

---

## 🚀 Méthode Automatique : Script PowerShell

### Utilisation du Script

```powershell
# 1. Aller dans le dossier scripts
cd C:\Users\23767\yukpomnang2\scripts

# 2. Exécuter le script PowerShell
.\transfer-variables-aws.ps1 `
  -OldProfile "ancien-compte" `
  -NewProfile "default" `
  -OldRegion "us-east-1" `
  -NewRegion "eu-west-1"
```

---

## 📋 Commandes Manuelles (Si le Script ne Fonctionne pas)

### Transférer une Variable Spécifique

```powershell
# Exemple : Transférer SENDGRID_API_KEY
# 1. Récupérer de l'ancien compte
$value = aws ssm get-parameter `
  --name "/yukpomnang/production/SENDGRID_API_KEY" `
  --region us-east-1 `
  --profile ancien-compte `
  --with-decryption `
  --query 'Parameter.Value' `
  --output text

# 2. Transférer vers le nouveau compte
aws ssm put-parameter `
  --name "/yukpo/production/SENDGRID_API_KEY" `
  --value $value `
  --type "SecureString" `
  --region eu-west-1 `
  --overwrite
```

---

## 🔍 Vérifier les Variables Récupérées

```powershell
# Afficher le contenu du fichier JSON
Get-Content ancien-ssm-params.json | ConvertFrom-Json | Format-Table Name, Type

# Afficher les secrets (attention, contient des valeurs sensibles)
Get-Content ancien-secrets.txt
```

---

## ⚠️ Variables à Mettre à Jour (Pas de Transfert Direct)

Ces variables doivent être mises à jour avec les nouvelles valeurs AWS :

1. **DATABASE_URL** → Nouvelle URL RDS AWS (déjà créée par Terraform)
2. **REDIS_URL** → Nouvelle URL ElastiCache AWS (déjà créée par Terraform)
3. **S3_BUCKET** → `yukpo-backend-media` (déjà configuré)
4. **S3_REGION** → `eu-west-1` (déjà configuré)
5. **S3_ACCESS_KEY/SECRET_KEY** → Nouvelles credentials AWS (déjà configuré)
6. **UPLOAD_BASE_URL** → Nouvelle URL S3 AWS (déjà configuré)

---

## 💡 Recommandation

**Commencez par l'Étape 2** (récupérer les variables) et envoyez-moi les fichiers. Je les transférerai vers le nouveau compte.

Ou si vous préférez, donnez-moi juste les valeurs des variables importantes (SendGrid, Twilio, OpenAI, etc.) et je les configure directement.

