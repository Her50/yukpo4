# 🔐 Instructions : Authentification GitHub CLI

**Date** : 2026-02-14

---

## 🎯 MÉTHODE 1 : Authentification via Token (Recommandée)

### Étape 1 : Créer un Token GitHub

1. Allez sur : **https://github.com/settings/tokens**
2. Cliquez sur **"Generate new token (classic)"**
3. Donnez un nom au token : `GCP-Secrets-Config`
4. Sélectionnez les scopes :
   - ✅ `repo` (accès complet aux repositories)
   - ✅ `workflow` (accès aux workflows GitHub Actions)
5. Cliquez sur **"Generate token"**
6. **⚠️ IMPORTANT** : Copiez le token immédiatement (il ne sera plus visible)

### Étape 2 : Utiliser le Token

**Option A : Via le script avec token**
```powershell
.\scripts\configure-github-secrets-with-token.ps1 -GitHubToken "votre_token_ici"
```

**Option B : Authentifier GitHub CLI avec le token**
```powershell
echo "votre_token_ici" | gh auth login --with-token
```

Puis exécuter :
```powershell
.\scripts\configure-github-secrets.ps1
```

---

## 🎯 MÉTHODE 2 : Authentification via Navigateur

### Étape 1 : Ouvrir le navigateur manuellement

1. Allez sur : **https://github.com/login/device**
2. Vous verrez un code à 8 caractères

### Étape 2 : Authentifier GitHub CLI

```powershell
gh auth login --device-code
```

Suivez les instructions affichées pour entrer le code.

---

## 🎯 MÉTHODE 3 : Authentification Web (Alternative)

```powershell
gh auth login --web
```

Si le navigateur ne s'ouvre pas automatiquement :
1. Copiez l'URL affichée dans le terminal
2. Collez-la dans votre navigateur
3. Suivez les instructions

---

## ✅ VÉRIFICATION

Après authentification, vérifiez :

```powershell
gh auth status
```

Vous devriez voir :
```
✓ Logged in to github.com as [votre_username]
```

---

## 🚀 CONFIGURATION DES SECRETS

Une fois authentifié, exécutez :

```powershell
.\scripts\configure-github-secrets.ps1
```

Ou avec token directement :

```powershell
.\scripts\configure-github-secrets-with-token.ps1 -GitHubToken "votre_token"
```

---

**Date** : 2026-02-14



