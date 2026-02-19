# 🔑 Créer un Token GitHub pour Mettre à Jour les Secrets

## 📋 Lien Direct

**Créer un nouveau token GitHub** :
👉 https://github.com/settings/tokens/new

---

## ✅ Étapes pour Créer le Token

### 1. Cliquez sur le lien ci-dessus

### 2. Configurez le Token

**Note** : Donnez un nom descriptif** :
```
yukpo-secrets-update-2026-02-16
```

**Expiration** : 
- Choisissez une durée (ex: 90 jours) ou "No expiration" si vous préférez

**Permissions (Scopes)** :
Cochez **UNIQUEMENT** :
- ✅ `repo` (Full control of private repositories)
  - Sous-section : ✅ `repo:status`
  - Sous-section : ✅ `repo_deployment`
  - Sous-section : ✅ `public_repo`
  - Sous-section : ✅ `repo:invite`
  - Sous-section : ✅ `security_events`

**OU** si vous voulez être plus restrictif :
- ✅ `admin:repo_hook` (Full control of repository hooks)
  - Cela permet de gérer les secrets d'actions

### 3. Cliquez sur "Generate token"

### 4. **IMPORTANT** : Copiez le token immédiatement

⚠️ **Vous ne pourrez plus le voir après !**

Le token ressemblera à :
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 Utiliser le Token

Une fois le token créé, exécutez :

```powershell
.\scripts\update_github_secret_gcp_database.ps1 -GitHubToken "ghp_VOTRE_TOKEN_ICI"
```

---

## 🔒 Sécurité

- ✅ Ne partagez **JAMAIS** votre token
- ✅ Ne commitez **JAMAIS** le token dans Git
- ✅ Supprimez le token après utilisation si vous ne voulez pas le garder
- ✅ Utilisez des tokens avec expiration limitée

---

## 📝 Alternative : Utiliser GitHub CLI

Si vous avez `gh` CLI installé :

```powershell
# Se connecter
gh auth login

# Mettre à jour le secret (si gh supporte cette fonctionnalité)
gh secret set GCP_DATABASE_URL --repo Her50/yukpo4 --body "postgresql://yukpo_user:MTeInD(Vw)b`$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
```

---

## 🔗 Liens Utiles

- **Créer un token** : https://github.com/settings/tokens/new
- **Gérer les tokens** : https://github.com/settings/tokens
- **Secrets du repository** : https://github.com/Her50/yukpo4/settings/secrets/actions


