# 🔑 Guide : Créer un Token GitHub pour Mettre à Jour les Secrets

**Date**: 2026-02-15  
**Objectif**: Créer un Personal Access Token (PAT) pour mettre à jour les secrets GitHub

---

## 🔗 Lien Direct

**URL pour créer un token GitHub** :
👉 https://github.com/settings/tokens?type=beta

**OU** via le menu :
1. GitHub → Votre profil (icône en haut à droite)
2. Settings
3. Developer settings (en bas à gauche)
4. Personal access tokens
5. Tokens (classic) ou Fine-grained tokens

---

## 📝 Étapes pour Créer un Token

### Option 1: Fine-grained Token (Recommandé - Plus Sécurisé)

1. **Aller sur** : https://github.com/settings/tokens?type=beta

2. **Cliquer sur "Generate new token"** → "Generate new token (fine-grained)"

3. **Configurer le token** :
   - **Token name** : `yukpo-gcp-secrets-updater`
   - **Description** : `Token pour mettre à jour les secrets GitHub (GCP_DATABASE_URL)`
   - **Expiration** : Choisir une durée (ex: 90 jours)
   - **Repository access** : Sélectionner "Only select repositories"
   - **Repository** : Sélectionner `Her50/yukpo4`

4. **Permissions nécessaires** :
   - ✅ **Repository permissions** → **Secrets** → **Read and write**

5. **Cliquer sur "Generate token"**

6. **Copier le token** (⚠️ Il ne sera affiché qu'une seule fois !)

### Option 2: Classic Token (Alternative)

1. **Aller sur** : https://github.com/settings/tokens

2. **Cliquer sur "Generate new token"** → "Generate new token (classic)"

3. **Configurer le token** :
   - **Note** : `yukpo-gcp-secrets-updater`
   - **Expiration** : Choisir une durée
   - **Scopes** : Cocher `repo` (accès complet au repository)

4. **Cliquer sur "Generate token"**

5. **Copier le token** (⚠️ Il ne sera affiché qu'une seule fois !)

---

## 🔧 Utiliser le Token

### Option A: Via GitHub CLI

```bash
# Installer GitHub CLI si nécessaire
# Windows: winget install GitHub.cli
# OU télécharger depuis: https://cli.github.com/

# Se connecter avec le token
gh auth login --with-token <<< "VOTRE_TOKEN_ICI"

# Mettre à jour le secret
echo 'postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres' | gh secret set GCP_DATABASE_URL --repo Her50/yukpo4
```

### Option B: Via Script PowerShell (avec token)

```powershell
# Utiliser le script avec le token
.\scripts\mettre-a-jour-secret-gcp-database-url.ps1 -GitHubToken "VOTRE_TOKEN_ICI"
```

### Option C: Via API GitHub (curl)

```bash
# Mettre à jour le secret via API GitHub
# (Nécessite chiffrement avec libsodium - complexe)
```

---

## ⚠️ Sécurité

1. **Ne jamais** commiter le token dans le code
2. **Ne jamais** partager le token publiquement
3. **Stockage** : Utiliser un gestionnaire de mots de passe
4. **Expiration** : Définir une expiration raisonnable
5. **Permissions** : Donner uniquement les permissions nécessaires

---

## 📋 Permissions Requises

Pour mettre à jour les secrets GitHub Actions, le token doit avoir :

- ✅ **Repository** → **Secrets** → **Read and write** (Fine-grained)
- ✅ **repo** scope (Classic token)

---

## 🔗 Liens Utiles

- **Créer un token** : https://github.com/settings/tokens?type=beta
- **Tokens classiques** : https://github.com/settings/tokens
- **Documentation GitHub** : https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **GitHub CLI** : https://cli.github.com/

---

## ✅ Après Création du Token

Une fois le token créé, vous pouvez :

1. **Mettre à jour le secret via GitHub CLI** :
   ```bash
   gh auth login --with-token <<< "VOTRE_TOKEN"
   echo 'postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres' | gh secret set GCP_DATABASE_URL --repo Her50/yukpo4
   ```

2. **OU mettre à jour manuellement via l'interface GitHub** :
   - https://github.com/Her50/yukpo4/settings/secrets/actions
   - Trouver `GCP_DATABASE_URL`
   - Cliquer sur "Update"
   - Coller la valeur

---

**🔗 Lien Direct** : https://github.com/settings/tokens?type=beta


