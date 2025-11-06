# Guide d'installation - Compilation Android Locale pour Yukpomnang

## ✅ Étapes déjà complétées
- [x] Java JDK 21 installé

## 📋 Étapes restantes

### 1. Installation d'Android Studio

**Téléchargement** : La page est déjà ouverte dans votre navigateur
- Téléchargez Android Studio (version stable recommandée)
- Taille : environ 1 GB

**Installation** :
1. Lancez l'installateur téléchargé
2. Suivez l'assistant d'installation
3. **Important** : Cochez les options suivantes :
   - ✅ Android SDK
   - ✅ Android SDK Platform
   - ✅ Android Virtual Device (AVD)
   - ✅ Performance (Intel HAXM ou AMD)

4. Choisissez le chemin d'installation (recommandé : défaut)
   - Android Studio : `C:\Program Files\Android\Android Studio`
   - Android SDK : `C:\Users\23767\AppData\Local\Android\Sdk`

5. Attendez la fin de l'installation (peut prendre 10-20 minutes)

### 2. Configuration initiale d'Android Studio

1. Lancez Android Studio
2. À l'écran de bienvenue, cliquez sur "More Actions" > "SDK Manager"
3. Dans l'onglet **SDK Platforms**, installez :
   - ✅ Android 14.0 (API 34) - **Cochez "Show Package Details"**
     - Android SDK Platform 34
     - Sources for Android 34
   - ✅ Android 13.0 (API 33)
   - ✅ Android 12.0 (API 31)

4. Dans l'onglet **SDK Tools**, installez :
   - ✅ Android SDK Build-Tools (dernière version)
   - ✅ Android SDK Command-line Tools (latest)
   - ✅ Android Emulator
   - ✅ Android SDK Platform-Tools
   - ✅ NDK (Side by side) - dernière version
   - ✅ CMake

5. Cliquez sur "Apply" et attendez le téléchargement

### 3. Configuration des variables d'environnement

Une fois l'installation terminée, **revenez ici** et je configurerai automatiquement les variables d'environnement nécessaires.

### 4. Préparation de votre projet Expo

Après la configuration des variables d'environnement, nous devrons :
1. Pré-compiler votre app Expo (`npx expo prebuild`)
2. Générer le fichier de signature Android (keystore)
3. Compiler l'APK ou l'AAB

## 🎯 État actuel

**En cours** : Téléchargement et installation d'Android Studio

**Prochaine étape** : Une fois l'installation terminée, revenez dans le terminal et tapez "installation terminée" pour que je configure automatiquement les variables d'environnement.

## ⚙️ Configuration requise

- Espace disque : ~15 GB minimum
- RAM : 8 GB minimum (16 GB recommandé)
- Connexion Internet stable pour les téléchargements

## 📝 Notes

- L'installation peut prendre 30-60 minutes selon votre connexion
- Ne fermez pas cette fenêtre, nous continuerons après l'installation
- Les variables d'environnement seront configurées automatiquement

