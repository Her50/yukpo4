# 📋 Instructions : Configuration Secrets GitHub pour GCP

**Date** : 2026-02-14  
**Objectif** : Configurer tous les secrets GitHub nécessaires pour le déploiement GCP

---

## 🎯 SECRETS DE BASE (6 secrets)

### 1. GCP_SA_KEY

**Valeur** : Contenu du fichier `gcp-sa-key.json`

**Méthode 1 : Via GitHub Web UI**
1. Allez sur : `https://github.com/Her50/yukpo4/settings/secrets/actions`
2. Cliquez sur **"New repository secret"**
3. Nom : `GCP_SA_KEY`
4. Valeur : Copiez-collez le contenu complet de `gcp-sa-key.json`
5. Cliquez sur **"Add secret"**

**Méthode 2 : Via GitHub CLI**
```powershell
gh secret set GCP_SA_KEY --body "$(Get-Content gcp-sa-key.json -Raw)" --repo Her50/yukpo4
```

---

### 2. GCP_DATABASE_URL

**Valeur** : `postgresql://yukpo_admin:***@34.79.29.219:5432/yukpo_db?sslmode=require`

**⚠️ IMPORTANT** : Remplacez `***` par le mot de passe réel de la base de données.

**Via GitHub Web UI** :
1. Nom : `GCP_DATABASE_URL`
2. Valeur : `postgresql://yukpo_admin:[MOT_DE_PASSE]@34.79.29.219:5432/yukpo_db?sslmode=require`

**Via GitHub CLI** :
```powershell
gh secret set GCP_DATABASE_URL --body "postgresql://yukpo_admin:[MOT_DE_PASSE]@34.79.29.219:5432/yukpo_db?sslmode=require" --repo Her50/yukpo4
```

---

### 3. GCP_PROJECT_ID

**Valeur** : `yukpo-project`

**Via GitHub Web UI** :
1. Nom : `GCP_PROJECT_ID`
2. Valeur : `yukpo-project`

**Via GitHub CLI** :
```powershell
gh secret set GCP_PROJECT_ID --body "yukpo-project" --repo Her50/yukpo4
```

---

### 4. GCP_REGION

**Valeur** : `europe-west1`

**Via GitHub Web UI** :
1. Nom : `GCP_REGION`
2. Valeur : `europe-west1`

**Via GitHub CLI** :
```powershell
gh secret set GCP_REGION --body "europe-west1" --repo Her50/yukpo4
```

---

### 5. GCP_SERVICE_ACCOUNT_EMAIL

**Valeur** : `github-actions@yukpo-project.iam.gserviceaccount.com`

**Via GitHub Web UI** :
1. Nom : `GCP_SERVICE_ACCOUNT_EMAIL`
2. Valeur : `github-actions@yukpo-project.iam.gserviceaccount.com`

**Via GitHub CLI** :
```powershell
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --body "github-actions@yukpo-project.iam.gserviceaccount.com" --repo Her50/yukpo4
```

---

### 6. GCP_DB_INSTANCE_CONNECTION_NAME

**Valeur** : `yukpo-project:europe-west1:yukpo-db`

**Via GitHub Web UI** :
1. Nom : `GCP_DB_INSTANCE_CONNECTION_NAME`
2. Valeur : `yukpo-project:europe-west1:yukpo-db`

**Via GitHub CLI** :
```powershell
gh secret set GCP_DB_INSTANCE_CONNECTION_NAME --body "yukpo-project:europe-west1:yukpo-db" --repo Her50/yukpo4
```

---

## 📋 VARIABLES D'ENVIRONNEMENT (GCP_ENV_*)

**Toutes les 152 variables** doivent être configurées avec le préfixe `GCP_ENV_`.

### Méthode Automatique (Recommandée)

**Si GitHub CLI est installé** :
```powershell
.\scripts\configure-github-secrets.ps1
```

**Si GitHub CLI n'est pas installé** :
1. Installez GitHub CLI : https://cli.github.com/
2. Authentifiez-vous : `gh auth login`
3. Exécutez : `.\scripts\configure-github-secrets.ps1`

---

### Méthode Manuelle (Via GitHub Web UI)

**Pour chaque variable dans `gcp-env-vars.json`** :

1. Allez sur : `https://github.com/Her50/yukpo4/settings/secrets/actions`
2. Cliquez sur **"New repository secret"**
3. Nom : `GCP_ENV_{NOM_VARIABLE}`
   - Exemple : `GCP_ENV_DATABASE_URL`
   - Exemple : `GCP_ENV_S3_BUCKET`
   - Exemple : `GCP_ENV_UPLOAD_BASE_URL`
4. Valeur : La valeur de la variable depuis `gcp-env-vars.json`
5. Cliquez sur **"Add secret"`

**Variables importantes à configurer en priorité** :

| Nom Secret | Variable | Valeur |
|------------|----------|--------|
| `GCP_ENV_DATABASE_URL` | `DATABASE_URL` | `postgresql://yukpo_admin:***@34.79.29.219:5432/yukpo_db?sslmode=require` |
| `GCP_ENV_S3_BUCKET` | `S3_BUCKET` | `yukpo-project-yukpo-backend-media` |
| `GCP_ENV_S3_REGION` | `S3_REGION` | `europe-west1` |
| `GCP_ENV_UPLOAD_BASE_URL` | `UPLOAD_BASE_URL` | `http://34.54.117.97` |
| `GCP_ENV_PUBLIC_BASE_URL` | `PUBLIC_BASE_URL` | `http://34.54.117.97` |
| `GCP_ENV_LAUNCH_PHASE_START_DATE` | `LAUNCH_PHASE_START_DATE` | `2026-02-12T15:52:30Z` |
| `GCP_ENV_JWT_SECRET` | `JWT_SECRET` | `[Récupéré depuis AWS]` |
| `GCP_ENV_ENABLE_AUTO_MIGRATIONS` | `ENABLE_AUTO_MIGRATIONS` | `true` |
| `GCP_ENV_SQLX_OFFLINE` | `SQLX_OFFLINE` | `true` |
| `GCP_ENV_RUST_LOG` | `RUST_LOG` | `info` |
| `GCP_ENV_ENVIRONMENT` | `ENVIRONMENT` | `production` |

**Note** : Pour les variables avec `[A_RECUPERER_DEPUIS_AWS]`, relancez `migrate-to-gcp-complete.ps1` pour récupérer les vraies valeurs.

---

## 🚀 SCRIPT AUTOMATIQUE ALTERNATIF (API GitHub)

Si GitHub CLI n'est pas disponible, vous pouvez utiliser l'API GitHub directement :

```powershell
# Configuration du token GitHub
$GITHUB_TOKEN = "[VOTRE_TOKEN_GITHUB]"
$REPO = "Her50/yukpo4"

# Fonction pour créer un secret
function Set-GitHubSecret {
    param($Name, $Value)
    
    $headers = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    # Obtenir la clé publique du repo
    $publicKeyResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/actions/secrets/public-key" -Headers $headers
    $publicKey = $publicKeyResponse.key
    $keyId = $publicKeyResponse.key_id
    
    # Chiffrer la valeur avec la clé publique
    # Note: Nécessite la bibliothèque libsodium pour le chiffrement
    # Pour simplifier, utilisez GitHub CLI ou l'interface web
}

# Utiliser GitHub CLI si disponible
if (Get-Command gh -ErrorAction SilentlyContinue) {
    .\scripts\configure-github-secrets.ps1
} else {
    Write-Host "Installez GitHub CLI pour configurer automatiquement les secrets" -ForegroundColor Yellow
    Write-Host "Ou configurez-les manuellement via: https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Yellow
}
```

---

## ✅ VÉRIFICATION

### Vérifier les secrets configurés

**Via GitHub Web UI** :
1. Allez sur : `https://github.com/Her50/yukpo4/settings/secrets/actions`
2. Vérifiez que tous les secrets sont présents

**Via GitHub CLI** :
```powershell
gh secret list --repo Her50/yukpo4
```

**Secrets attendus** :
- `GCP_SA_KEY`
- `GCP_DATABASE_URL`
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_DB_INSTANCE_CONNECTION_NAME`
- `GCP_ENV_*` (152 variables)

---

## 📊 RÉSUMÉ

**Total secrets à configurer** :
- **6 secrets de base**
- **152 variables d'environnement** (avec préfixe `GCP_ENV_`)

**Total** : **158 secrets GitHub**

---

## 🎯 PROCHAINES ÉTAPES

Après configuration des secrets :

1. ✅ **Push vers GitHub** pour déclencher le workflow
2. ✅ **Vérifier le déploiement** Cloud Run
3. ✅ **Tester l'upload** vers Cloud Storage
4. ✅ **Vérifier l'accès** via Cloud CDN

---

**Date** : 2026-02-14  
**Statut** : ⏳ **EN ATTENTE DE CONFIGURATION**


