# 📥 Guide Installation gcloud CLI sur Windows

**Date** : 2026-02-14

---

## ✅ ÉTAPE 1 : Télécharger gcloud CLI

### Option A : Installation Interactive (Recommandé)

1. **Téléchargez l'installateur** :
   - Allez sur : https://cloud.google.com/sdk/docs/install
   - Cliquez sur **"Download for Windows"**
   - Téléchargez `GoogleCloudSDKInstaller.exe`

2. **Exécutez l'installateur** :
   - Double-cliquez sur `GoogleCloudSDKInstaller.exe`
   - Suivez les instructions d'installation
   - Laissez les options par défaut (installation dans `C:\Program Files (x86)\Google\Cloud SDK\`)

### Option B : Installation via PowerShell (Alternative)

```powershell
# Télécharger l'installateur
Invoke-WebRequest -Uri "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe" -OutFile "$env:TEMP\GoogleCloudSDKInstaller.exe"

# Exécuter l'installateur
Start-Process "$env:TEMP\GoogleCloudSDKInstaller.exe" -Wait
```

---

## ✅ ÉTAPE 2 : Vérifier l'installation

Ouvrez un **nouveau PowerShell** (important : redémarrer pour charger le PATH) et exécutez :

```powershell
gcloud version
```

Vous devriez voir quelque chose comme :
```
Google Cloud SDK 450.0.0
```

---

## ✅ ÉTAPE 3 : Authentification

```powershell
gcloud auth login
```

Cette commande va :
1. Ouvrir votre navigateur
2. Vous demander de vous connecter avec votre compte Google
3. Autoriser gcloud CLI à accéder à votre compte GCP

**Important** : Utilisez le compte Google qui a accès au projet `yukpo-project`.

---

## ✅ ÉTAPE 4 : Configurer le projet

```powershell
gcloud config set project yukpo-project
```

Vérifiez la configuration :

```powershell
gcloud config list
```

Vous devriez voir :
```
[core]
project = yukpo-project
```

---

## ✅ ÉTAPE 5 : Exécuter les commandes de correction

Une fois authentifié et configuré, exécutez cette commande complète :

```powershell
gcloud services enable artifactregistry.googleapis.com --project=yukpo-project; `
gcloud artifacts repositories create yukpo-backend `
  --repository-format=docker `
  --location=europe-west1 `
  --description="Docker repository for yukpo-backend" `
  --project=yukpo-project 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "✅ Repository already exists" }; `
gcloud projects add-iam-policy-binding yukpo-project `
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" `
  --role="roles/artifactregistry.writer"; `
gcloud projects add-iam-policy-binding yukpo-project `
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" `
  --role="roles/artifactregistry.reader"; `
Write-Host "✅ Permissions configurées avec succès!"
```

**Note** : Si le repository existe déjà, vous verrez un message d'erreur. C'est normal, continuez.

---

## 🔍 VÉRIFICATION

### Vérifier que le repository existe

```powershell
gcloud artifacts repositories list --location=europe-west1 --project=yukpo-project
```

### Vérifier les permissions

```powershell
gcloud projects get-iam-policy yukpo-project `
  --flatten="bindings[].members" `
  --filter="bindings.members:serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" `
  --format="table(bindings.role)" | Select-String "artifactregistry"
```

---

## ⚠️ PROBLÈMES COURANTS

### "gcloud n'est pas reconnu"

**Solution** :
1. Fermez et rouvrez PowerShell
2. Vérifiez que le PATH contient : `C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin`
3. Ou ajoutez manuellement au PATH :
   ```powershell
   $env:PATH += ";C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
   ```

### "Permission denied"

**Solution** :
- Assurez-vous d'utiliser un compte Google avec les permissions d'administrateur sur le projet `yukpo-project`
- Vérifiez que vous avez les rôles `Owner` ou `Editor` sur le projet

---

## ✅ RÉSUMÉ DES COMMANDES

```powershell
# 1. Installer (si pas déjà fait)
# Télécharger depuis https://cloud.google.com/sdk/docs/install

# 2. Authentifier
gcloud auth login

# 3. Configurer le projet
gcloud config set project yukpo-project

# 4. Corriger les permissions (commande complète)
gcloud services enable artifactregistry.googleapis.com --project=yukpo-project; gcloud artifacts repositories create yukpo-backend --repository-format=docker --location=europe-west1 --description="Docker repository for yukpo-backend" --project=yukpo-project 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "✅ Repository already exists" }; gcloud projects add-iam-policy-binding yukpo-project --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"; gcloud projects add-iam-policy-binding yukpo-project --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" --role="roles/artifactregistry.reader"; Write-Host "✅ Permissions configurées avec succès!"
```

---

**Date** : 2026-02-14  
**Statut** : ✅ **GUIDE COMPLET**

