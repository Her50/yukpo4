# 🚀 À FAIRE APRÈS L'INSTALLATION D'ANDROID STUDIO

## ✅ Une fois Android Studio téléchargé et installé

### ÉTAPE 1️⃣ : Premier lancement d'Android Studio

1. **Lancez Android Studio**
   - Cherchez "Android Studio" dans le menu Démarrer
   - Double-cliquez pour lancer

2. **Assistant de configuration** (première fois)
   - Choisissez "Standard" installation
   - Attendez que tout se télécharge (SDK, tools, etc.)
   - Ça peut prendre 20-40 minutes

3. **SDK Manager** (Important!)
   - Une fois sur l'écran d'accueil, cliquez sur `More Actions` > `SDK Manager`
   
   **Onglet "SDK Platforms":**
   - Cochez "Show Package Details" (en bas)
   - Installez :
     ```
     ✅ Android 14.0 (API 34)
        └─ Android SDK Platform 34
        └─ Sources for Android 34
     ```
   
   **Onglet "SDK Tools":**
   - Cochez "Show Package Details"
   - Installez :
     ```
     ✅ Android SDK Build-Tools 34.0.0
     ✅ Android SDK Command-line Tools (latest)
     ✅ Android SDK Platform-Tools
     ✅ Android Emulator
     ✅ NDK (Side by side) - dernière version
     ```

4. **Cliquez sur "Apply"** et attendez le téléchargement

---

### ÉTAPE 2️⃣ : Configuration automatique

Une fois tout installé dans Android Studio, **REVENEZ ICI** et exécutez :

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\post-android-studio-setup.ps1
```

Ce script va automatiquement :
- ✅ Configurer ANDROID_HOME
- ✅ Ajouter les outils Android au PATH
- ✅ Vérifier que tout est bien configuré

---

### ÉTAPE 3️⃣ : Redémarrez votre terminal

**IMPORTANT** : Fermez et rouvrez PowerShell pour que les variables d'environnement prennent effet.

Puis vérifiez :
```powershell
adb --version
echo $env:ANDROID_HOME
```

---

### ÉTAPE 4️⃣ : Préparez votre projet mobile

```powershell
cd mobile
npm install
npx expo prebuild --platform android
```

---

### ÉTAPE 5️⃣ : Compilez votre première APK !

**Option A : APK de développement (rapide)**
```powershell
.\build-android.ps1 -BuildType debug
```

**Option B : APK de production (pour distribuer)**
```powershell
# Générer d'abord le keystore
cd ..
.\scripts\generate-android-keystore.ps1

# Puis compiler
cd mobile
.\build-android.ps1 -BuildType release
```

---

## 📱 Tester sur un appareil

### Si vous avez un téléphone Android :

1. **Activez le mode développeur** sur votre téléphone :
   - Allez dans Paramètres > À propos du téléphone
   - Tapez 7 fois sur "Numéro de build"
   - Revenez dans Paramètres > Options développeur
   - Activez "Débogage USB"

2. **Connectez votre téléphone** en USB à votre PC

3. **Vérifiez la connexion** :
   ```powershell
   adb devices
   ```
   Vous devriez voir votre appareil listé

4. **Installez et lancez l'app** :
   ```powershell
   cd mobile
   .\build-android.ps1 -BuildType debug -Install -Run
   ```

---

### Si vous voulez utiliser un émulateur :

1. **Dans Android Studio** : `Tools` > `Device Manager`
2. **Créez un appareil virtuel** (ex: Pixel 7, API 34)
3. **Lancez l'émulateur**
4. **Compilez et installez** :
   ```powershell
   cd mobile
   .\build-android.ps1 -BuildType debug -Install -Run
   ```

---

## 🎯 RÉCAPITULATIF RAPIDE

Une fois Android Studio installé :

```powershell
# 1. Configuration automatique
.\scripts\post-android-studio-setup.ps1

# 2. Redémarrer le terminal, puis :
cd mobile
npm install

# 3. Prebuild Expo
npx expo prebuild --platform android

# 4. Compiler
.\build-android.ps1 -BuildType debug

# 5. Installer sur appareil/émulateur
.\build-android.ps1 -BuildType debug -Install -Run
```

---

## ⏰ TEMPS ESTIMÉ TOTAL

- Installation Android Studio : 10-20 min
- Téléchargement SDK/Tools : 20-40 min
- Configuration : 5 min
- Première compilation : 10-15 min

**Total : 45-90 minutes**

---

## 📞 QUAND VOUS SEREZ PRÊT

Dites-moi simplement : **"Android Studio installé"**

Et je vous guiderai étape par étape pour compiler votre première APK ! 🚀

