# 🔐 Création du Compte Super Admin via API

## 📋 Vue d'ensemble

Cette solution permet de créer le compte super admin via un endpoint API temporaire, évitant les problèmes de timeout avec les tasks ECS et psql.

## 🚀 Solution Implémentée

### Endpoint API
- **URL:** `POST /api/auth/bootstrap-super-admin`
- **Sécurité:** Protégé par un token secret (`BOOTSTRAP_SUPER_ADMIN_TOKEN`)
- **Fonctionnalité:** Crée ou met à jour le compte super admin

### Identifiants créés
- **Email:** `admin@yukpo.dev`
- **Mot de passe:** `Hernandez87`
- **Rôle:** `super_admin` (tous les droits)
- **Tokens:** 1,000,000

## 📝 Étapes d'utilisation

### 1. Configurer le token secret

#### Option A: Via le script PowerShell (recommandé)
```powershell
.\scripts\setup_bootstrap_token.ps1
```

Le script va:
- Générer un token aléatoire de 64 caractères
- Le stocker dans AWS SSM Parameter Store: `/yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN`

#### Option B: Manuellement
```powershell
# Générer un token
$token = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})

# Stocker dans SSM
aws ssm put-parameter `
  --name /yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN `
  --value $token `
  --type "SecureString" `
  --region us-east-1
```

### 2. Ajouter le token à la task definition ECS

Le token doit être disponible dans le conteneur backend. Ajoutez-le dans la task definition ECS:

```json
{
  "name": "BOOTSTRAP_SUPER_ADMIN_TOKEN",
  "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT_ID:parameter/yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN"
}
```

**Note:** Remplacez `ACCOUNT_ID` par votre ID de compte AWS.

### 3. Déployer le backend

Assurez-vous que le code avec l'endpoint `bootstrap_super_admin` est déployé dans ECS.

### 4. Appeler l'endpoint

#### Option A: Via le script PowerShell (recommandé)
```powershell
.\scripts\call_bootstrap_super_admin.ps1
```

Le script va:
- Récupérer l'URL de l'API depuis SSM ou vous la demander
- Récupérer le token depuis SSM ou vous le demander
- Appeler l'endpoint `/api/auth/bootstrap-super-admin`
- Afficher les identifiants créés

#### Option B: Via curl
```bash
curl -X POST https://api.yukpo.dev/api/auth/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -d '{"secret_token": "YOUR_SECRET_TOKEN"}'
```

#### Option C: Via PowerShell direct
```powershell
$apiUrl = "https://api.yukpo.dev"
$token = "YOUR_SECRET_TOKEN"

$body = @{
    secret_token = $token
} | ConvertTo-Json

Invoke-RestMethod -Uri "$apiUrl/api/auth/bootstrap-super-admin" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```

## ✅ Vérification

Après l'appel, vous devriez recevoir une réponse JSON:

```json
{
  "success": true,
  "message": "Super admin créé/mis à jour avec succès",
  "user": {
    "id": 1,
    "email": "admin@yukpo.dev",
    "role": "super_admin",
    "nom_complet": "Super Super Admin",
    "tokens_balance": 1000000
  },
  "credentials": {
    "email": "admin@yukpo.dev",
    "password": "Hernandez87",
    "role": "super_admin"
  }
}
```

## 🔒 Sécurité

### ⚠️ IMPORTANT

1. **Token fort:** Utilisez un token d'au moins 32 caractères, idéalement 64+
2. **Stockage sécurisé:** Stockez le token dans AWS SSM Parameter Store (type SecureString)
3. **Suppression après usage:** Une fois le compte créé, vous pouvez:
   - Supprimer la variable d'environnement de la task definition
   - Supprimer le paramètre SSM
   - Supprimer l'endpoint du code (optionnel, il est déjà protégé par le token)

### Supprimer le token SSM après usage
```powershell
aws ssm delete-parameter `
  --name /yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN `
  --region us-east-1
```

## 🐛 Dépannage

### Erreur: "Token invalide"
- Vérifiez que le token dans SSM correspond à celui utilisé dans l'appel
- Vérifiez que la variable `BOOTSTRAP_SUPER_ADMIN_TOKEN` est bien définie dans le conteneur ECS

### Erreur: "Connection refused" ou timeout
- Vérifiez que l'API est accessible
- Vérifiez les logs ECS: `aws logs tail /ecs/yukpomnang-backend --region us-east-1 --follow`

### Erreur: "Parameter not found"
- Vérifiez que le paramètre SSM existe: 
  ```powershell
  aws ssm get-parameter --name /yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN --region us-east-1
  ```

## 📚 Fichiers associés

- `backend/src/controllers/auth_controller.rs` - Fonction `bootstrap_super_admin`
- `backend/src/routes/auth_routes.rs` - Route `/auth/bootstrap-super-admin`
- `scripts/call_bootstrap_super_admin.ps1` - Script d'appel
- `scripts/setup_bootstrap_token.ps1` - Script de configuration du token

## 🔄 Alternative: Supprimer l'endpoint après usage

Une fois le compte créé, vous pouvez supprimer l'endpoint du code:

1. Supprimer la route dans `backend/src/routes/auth_routes.rs`
2. Supprimer la fonction dans `backend/src/controllers/auth_controller.rs`
3. Rebuild et redéployer

Ou simplement laisser l'endpoint (il est protégé par le token secret).



