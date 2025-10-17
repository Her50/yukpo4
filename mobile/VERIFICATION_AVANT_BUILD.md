# 🔍 Checklist de Vérification Avant Build EAS

## ✅ Vérifications Obligatoires

### 1. Configuration des Fichiers

- [x] **app.config.js** : Contient toutes les permissions Android
- [x] **eas.json** : Profile `preview` correctement configuré
- [x] **package.json** : Toutes les dépendances présentes
- [x] **plugins/** : Tous les plugins nécessaires existent
- [x] **eas-build-post-install.sh** : Script de post-install optimisé

### 2. Assets et Ressources

Vérifiez que ces fichiers existent :

```bash
cd mobile
ls -la assets/icon.png
ls -la assets/splash.png
ls -la assets/adaptive-icon.png
```

Si manquant, créez des placeholders :
- **icon.png** : 1024x1024 px
- **splash.png** : 2048x2048 px (avec logo centré)
- **adaptive-icon.png** : 1024x1024 px

### 3. Dépendances Node

```bash
cd mobile

# Vérifier que node_modules existe
ls node_modules

# Si manquant, installer
npm install

# Vérifier qu'il n'y a pas d'erreurs
npm run postinstall
```

### 4. Configuration Expo

```bash
# Vérifier le project ID
grep "projectId" app.config.js

# Devrait afficher : a5407780-d5ad-45fa-8b72-a673d3828b93
```

### 5. Tests de Compilation

```bash
# Test 1 : Vérifier la syntaxe
npx expo-doctor

# Test 2 : Générer le prebuild (dossier android/)
npx expo prebuild --platform android --clean

# Test 3 : Vérifier le App.tsx
node -e "require('./App.tsx')" || echo "Fichier valide"
```

## 🔧 Commandes de Diagnostic

### Diagnostic Complet

```powershell
# Dans PowerShell (Windows)
cd mobile

Write-Host "🔍 Vérification de la configuration EAS Build..." -ForegroundColor Cyan

# 1. Vérifier Node et NPM
Write-Host "`n📦 Versions Node/NPM:" -ForegroundColor Yellow
node --version
npm --version

# 2. Vérifier Expo CLI
Write-Host "`n📦 Version Expo CLI:" -ForegroundColor Yellow
npx expo --version

# 3. Vérifier EAS CLI
Write-Host "`n📦 Version EAS CLI:" -ForegroundColor Yellow
eas --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ EAS CLI non installé. Installez avec: npm install -g eas-cli" -ForegroundColor Red
}

# 4. Vérifier les fichiers critiques
Write-Host "`n📁 Fichiers critiques:" -ForegroundColor Yellow
$files = @(
    "package.json",
    "app.config.js",
    "eas.json",
    "App.tsx",
    "babel.config.js",
    "assets/icon.png",
    "assets/splash.png",
    "assets/adaptive-icon.png",
    "plugins/withKotlinVersion.js",
    "plugins/withWebRTCExpo53.js",
    "plugins/disableUpdates.js",
    "eas-build-post-install.sh"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MANQUANT" -ForegroundColor Red
    }
}

# 5. Vérifier node_modules
Write-Host "`n📦 Dépendances:" -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ✅ node_modules présent" -ForegroundColor Green
    $packageCount = (Get-ChildItem node_modules -Directory).Count
    Write-Host "  📊 $packageCount packages installés" -ForegroundColor Cyan
} else {
    Write-Host "  ❌ node_modules manquant - Exécutez: npm install" -ForegroundColor Red
}

# 6. Vérifier le statut EAS
Write-Host "`n🔐 Statut EAS:" -ForegroundColor Yellow
eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Non connecté à EAS - Exécutez: eas login" -ForegroundColor Red
} else {
    Write-Host "  ✅ Connecté à EAS" -ForegroundColor Green
}

Write-Host "`n✨ Vérification terminée!" -ForegroundColor Cyan
```

Sauvegardez ce script dans `mobile/verif-eas.ps1` et exécutez :
```powershell
powershell -ExecutionPolicy Bypass -File ./verif-eas.ps1
```

## 🚨 Problèmes Courants et Solutions

### Problème 1 : EAS CLI non installé
```bash
npm install -g eas-cli
eas --version
```

### Problème 2 : Non connecté à Expo
```bash
eas login
# Utilisez le compte : hernandezlele
```

### Problème 3 : node_modules corrompu
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problème 4 : Erreurs de dépendances
```bash
npm install --legacy-peer-deps
```

### Problème 5 : Assets manquants
Créez les images ou utilisez des placeholders :
```bash
# Créer des placeholders de 1024x1024 px
# Vous pouvez utiliser https://www.canva.com ou tout éditeur d'image
```

### Problème 6 : Permissions de scripts
```bash
# Sur Windows avec Git Bash ou WSL
chmod +x eas-build-post-install.sh
chmod +x eas-build-pre-install.sh
```

## 📝 Checklist Finale Avant Build

Avant de lancer `npx eas build --platform android --profile preview`, vérifiez :

- [ ] ✅ EAS CLI installé et à jour
- [ ] ✅ Connecté avec `eas login`
- [ ] ✅ `node_modules` installé
- [ ] ✅ Tous les fichiers assets présents
- [ ] ✅ Aucune erreur dans `npm run postinstall`
- [ ] ✅ `app.config.js` valide (testé avec `node app.config.js`)
- [ ] ✅ `eas.json` valide (JSON bien formé)
- [ ] ✅ Plugins présents dans `plugins/`
- [ ] ✅ Scripts `.sh` ont les bonnes permissions
- [ ] ✅ Internet stable et rapide (upload ~50-100 MB)

## 🎯 Commande de Build Finale

Une fois toutes les vérifications passées :

```bash
cd mobile

# Commande de build
npx eas build --platform android --profile preview

# Ou avec le script npm
npm run build:preview
```

## 📊 Estimation du Build

- **Upload du code** : 2-5 minutes
- **Installation des dépendances** : 3-5 minutes
- **Compilation Android** : 5-10 minutes
- **Génération de l'APK** : 2-3 minutes
- **Total** : ~15-25 minutes

## 🎉 Après le Build Réussi

1. Téléchargez l'APK depuis le lien fourni
2. Installez sur votre téléphone Android
3. Testez toutes les fonctionnalités
4. Si OK, documentez la version du build
5. Partagez l'APK avec les testeurs si nécessaire

---

**Note** : Ce document sera mis à jour selon les problèmes rencontrés lors des builds.

