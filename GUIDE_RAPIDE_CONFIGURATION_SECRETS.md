# 🚀 Guide Rapide : Configuration Secrets GitHub

**Date** : 2026-02-14

---

## ✅ ÉTAPE 1 : Créer un Token GitHub

1. **Allez sur** : https://github.com/settings/tokens
2. **Cliquez sur** : "Generate new token (classic)"
3. **Nom** : `GCP-Secrets-Config`
4. **Scopes** :
   - ✅ `repo` (accès complet)
   - ✅ `workflow` (GitHub Actions)
5. **Générez** et **copiez le token** (⚠️ visible une seule fois)

---

## ✅ ÉTAPE 2 : Configurer les Secrets

**Exécutez cette commande** (remplacez `VOTRE_TOKEN` par votre token) :

```powershell
.\scripts\configure-github-secrets-with-token.ps1 -GitHubToken "VOTRE_TOKEN"
```

**Ou authentifiez d'abord GitHub CLI** :

```powershell
# Authentifier avec le token
echo "VOTRE_TOKEN" | gh auth login --with-token

# Puis configurer les secrets
.\scripts\configure-github-secrets.ps1
```

---

## 📋 CE QUI SERA CONFIGURÉ

### Secrets de Base (6)
- ✅ `GCP_SA_KEY` - Clé Service Account
- ✅ `GCP_DATABASE_URL` - URL Cloud SQL
- ✅ `GCP_PROJECT_ID` - yukpo-project
- ✅ `GCP_REGION` - europe-west1
- ✅ `GCP_SERVICE_ACCOUNT_EMAIL` - github-actions@yukpo-project.iam.gserviceaccount.com
- ✅ `GCP_DB_INSTANCE_CONNECTION_NAME` - yukpo-project:europe-west1:yukpo-db

### Variables d'Environnement (~150)
- ✅ Toutes les variables depuis `gcp-env-vars.json`
- ✅ Préfixe : `GCP_ENV_*`
- ✅ Exemples : `GCP_ENV_DATABASE_URL`, `GCP_ENV_S3_BUCKET`, etc.

---

## ⏱️ TEMPS ESTIMÉ

- **Création token** : 1 minute
- **Configuration secrets** : 2-5 minutes (selon le nombre de variables)

---

## ✅ VÉRIFICATION

Après configuration, vérifiez :

```powershell
gh secret list --repo Her50/yukpo4
```

Vous devriez voir tous les secrets listés.

---

**C'est tout ! Une fois les secrets configurés, vous pouvez push vers GitHub pour déclencher le déploiement.**

