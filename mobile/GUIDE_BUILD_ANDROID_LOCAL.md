# 📱 Guide de Build Android Local - Yukpomnang

## ✅ Pré-requis en cours d'installation

- [x] Java JDK 21 installé
- [ ] Android Studio en cours de téléchargement
- [ ] Android SDK (sera installé avec Android Studio)

## 📥 Étape 1: Installation d'Android Studio

### Pendant le téléchargement (environ 1 GB)
Vous pouvez continuer à lire ce guide pour comprendre les étapes suivantes.

### Une fois téléchargé:

1. **Lancez l'installateur**
   - Double-cliquez sur le fichier `.exe` téléchargé
   - Acceptez les conditions d'utilisation

2. **Options d'installation** (IMPORTANT - Cochez tout):
   ```
   ✅ Android SDK
   ✅ Android SDK Platform
   ✅ Android Virtual Device (AVD)
   ✅ Performance (Intel HAXM)
   ```

3. **Chemins d'installation recommandés**:
   - Android Studio: `C:\Program Files\Android\Android Studio`
   - Android SDK: `C:\Users\23767\AppData\Local\Android\Sdk`

4. **Attendez la fin** (10-20 minutes)

## 🔧 Étape 2: Configuration initiale d'Android Studio

### Au premier lancement:

1. **SDK Manager**
   - Cliquez sur `More Actions` > `SDK Manager`
   
2. **Onglet "SDK Platforms"**
   - Cochez "Show Package Details" en bas à droite
   - Installez:
     ```
     ✅ Android 14.0 (API 34)  ⬅️ PRINCIPAL
        ├─ Android SDK Platform 34
        └─ Sources for Android 34
     ✅ Android 13.0 (API 33)
     ✅ Android 12.0 (API 31)
     ```

3. **Onglet "SDK Tools"**
   - Cochez "Show Package Details"
   - Installez:
     ```
     ✅ Android SDK Build-Tools 34.0.0
     ✅ Android SDK Command-line Tools (latest)
     ✅ Android Emulator
     ✅ Android SDK Platform-Tools
     ✅ NDK (Side by side) - version 26.1.10909125
     ✅ CMake
     ```

4. **Cliquez sur "Apply"**
   - Le téléchargement démarre (environ 5-8 GB)
   - Patience, c'est l'étape la plus longue (20-40 minutes selon votre connexion)

## ⚙️ Étape 3: Configuration des variables d'environnement

Une fois l'installation terminée, **REVENEZ ICI** et lancez:

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\setup-android-env.ps1
```

Ce script configurera automatiquement:
- `ANDROID_HOME`
- `JAVA_HOME`
- Ajout au `PATH` des outils Android

Puis **REDÉMARREZ votre terminal PowerShell**.

## 🔐 Étape 4: Générer le Keystore de signature

Le keystore est nécessaire pour signer votre APK/AAB:

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\generate-android-keystore.ps1
```

Suivez les instructions (ou appuyez sur Entrée pour les valeurs par défaut).

**⚠️ IMPORTANT**: Sauvegardez les informations du keystore en lieu sûr!

## 📦 Étape 5: Installer les dépendances du projet

```powershell
cd mobile
npm install
```

## 🏗️ Étape 6: Prebuild Expo (génération native)

Expo doit générer les fichiers natifs Android:

```powershell
npx expo prebuild --platform android
```

Cette commande va:
- Créer/mettre à jour le dossier `android/`
- Configurer les plugins Expo
- Générer les fichiers Gradle
- Installer les dépendances natives

## 📱 Étape 7: Build de l'application

### Option A: Build de développement (APK Debug)

```powershell
# Lancer le metro bundler dans un terminal
npx expo start

# Dans un autre terminal
npx expo run:android
```

Cela va:
1. Compiler l'application
2. Installer sur un émulateur ou appareil connecté
3. Lancer l'app automatiquement

### Option B: Build de production (APK Release)

```powershell
cd android
.\gradlew assembleRelease
```

L'APK sera généré dans:
`android\app\build\outputs\apk\release\app-release.apk`

### Option C: Build AAB (pour Google Play Store)

```powershell
cd android
.\gradlew bundleRelease
```

L'AAB sera généré dans:
`android\app\build\outputs\bundle\release\app-release.aab`

## 🚀 Utiliser l'émulateur Android

### Créer un émulateur:

1. Dans Android Studio: `Tools` > `Device Manager`
2. Cliquez sur `Create Device`
3. Choisissez un appareil (ex: Pixel 7)
4. Téléchargez une image système (API 34 recommandé)
5. Nommez votre émulateur et cliquez sur `Finish`

### Lancer l'émulateur depuis la ligne de commande:

```powershell
# Lister les émulateurs disponibles
emulator -list-avds

# Lancer un émulateur
emulator -avd Pixel_7_API_34
```

## 📊 Vérification de l'installation

Après avoir exécuté `setup-android-env.ps1`, vérifiez:

```powershell
# Vérifier Java
java -version
# Doit afficher: java version "21.0.9"

# Vérifier Android SDK
adb version
# Doit afficher: Android Debug Bridge version...

# Vérifier les SDK installés
sdkmanager --list_installed
```

## 🐛 Dépannage

### Erreur "ANDROID_HOME not set"
```powershell
# Vérifier
$env:ANDROID_HOME
# Si vide, relancer le script setup-android-env.ps1
```

### Erreur "SDK location not found"
Créer/modifier `android/local.properties`:
```properties
sdk.dir=C:\\Users\\23767\\AppData\\Local\\Android\\Sdk
```

### Erreur de build Gradle
```powershell
# Nettoyer et rebuilder
cd android
.\gradlew clean
.\gradlew assembleDebug
```

### Port Metro déjà utilisé
```powershell
# Tuer le processus sur le port 8081
npx react-native start --reset-cache
```

## 📝 Scripts utiles

J'ai créé des scripts pour vous faciliter la vie:

- `setup-android-env.ps1` - Configuration automatique de l'environnement
- `generate-android-keystore.ps1` - Génération du keystore de signature
- Plus à venir après l'installation!

## 🎯 État actuel

**EN COURS**: 
- ⏳ Téléchargement d'Android Studio
- ⏳ En attente de l'installation

**PROCHAIN**:
- Configuration d'Android Studio
- Installation des SDK Platforms et Tools
- Configuration des variables d'environnement

---

## 📞 Besoin d'aide?

Une fois Android Studio installé, revenez ici et dites "installation terminée" pour que je puisse continuer avec les étapes suivantes!

