# 🔗 Lien Direct : Création Token GitHub

**Lien Direct** : https://github.com/settings/tokens/new

---

## 📋 Instructions Rapides

### 1. Note du Token
- **Nom** : `GCP-Secrets-Config`

### 2. Expiration
- **Recommandé** : `90 days` (ou `No expiration` si vous préférez)

### 3. Scopes à Sélectionner

**✅ repo** (tout cocher)
- `repo:status`
- `repo_deployment`
- `public_repo`
- `repo:invite`
- `security_events`

**✅ workflow** (tout cocher)
- `workflow`

### 4. Générer le Token
- Cliquez sur **"Generate token"** (en bas de la page)

### 5. ⚠️ IMPORTANT : Copier le Token
- **Le token est visible UNE SEULE FOIS**
- Copiez-le immédiatement
- Envoyez-le moi pour que je configure automatiquement tous les secrets

---

## 🚀 Après Création du Token

Une fois le token créé, envoyez-le moi et j'exécuterai :

```powershell
.\scripts\configure-github-secrets-with-token.ps1 -GitHubToken "VOTRE_TOKEN"
```

Cela configurera automatiquement :
- ✅ 6 secrets de base
- ✅ ~150 variables d'environnement

---

**Lien Direct** : https://github.com/settings/tokens/new



