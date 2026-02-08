# 🔧 Variables d'environnement et taille de l'APK

## 1️⃣ Variables d'environnement - Build local

### ❌ Problème identifié

**Le build local ne charge PAS automatiquement les variables d'environnement définies dans `eas.json`.**

Les variables d'environnement dans `eas.json` sont uniquement utilisées par **EAS Build** (build dans le cloud), pas par le build local avec Gradle.

### ✅ Solution : Charger les variables d'environnement localement

#### Option 1 : Fichier `.env` (Recommandé)

Créer un fichier `.env` dans `mobile/` :

```bash
# mobile/.env
EXPO_PUBLIC_API_URL=https://api.yukpomnang.com
EXPO_PUBLIC_WS_URL=wss://api.yukpomnang.com
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
```

Puis modifier `app.config.js` pour charger le fichier `.env` :

```javascript
// mobile/app.config.js
require('dotenv').config(); // Installer: npm install dotenv

module.exports = {
    expo: {
        // ... configuration existante ...
        extra: {
            // Les variables EXPO_PUBLIC_* sont automatiquement disponibles
            // via process.env.EXPO_PUBLIC_*
        }
    }
};
```

#### Option 2 : Variables d'environnement système

Définir les variables dans votre shell avant le build :

```powershell
# PowerShell
$env:EXPO_PUBLIC_API_URL="https://api.yukpomnang.com"
$env:EXPO_PUBLIC_WS_URL="wss://api.yukpomnang.com"
# ... autres variables ...

cd android
.\gradlew.bat assembleDebug
```

#### Option 3 : Script de build avec variables

Créer un script `build-local.ps1` :

```powershell
# mobile/build-local.ps1
$env:EXPO_PUBLIC_API_URL="https://api.yukpomnang.com"
$env:EXPO_PUBLIC_WS_URL="wss://api.yukpomnang.com"
$env:EXPO_PUBLIC_SHARE_URL="https://yukpomnang.com"
$env:EXPO_PUBLIC_ENVIRONMENT="production"
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
$env:EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY="AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"

cd android
.\gradlew.bat assembleDebug
```

### 📋 Comment Expo charge les variables

1. **Build EAS** : Charge depuis `eas.json` → `build.*.env`
2. **Build local** : Charge depuis :
   - Fichier `.env` (si `dotenv` est configuré)
   - Variables d'environnement système (`process.env`)
   - `app.config.js` (si défini explicitement)

### ⚠️ Important

- Les variables doivent commencer par `EXPO_PUBLIC_` pour être accessibles dans le code JavaScript
- Les variables sont intégrées au moment du build (bundle JavaScript)
- Changer les variables nécessite un rebuild complet

---

## 2️⃣ Taille de l'APK - État actuel

### 📊 Situation actuelle

- **Taille actuelle** : ~196 MB (après réduction des architectures)
- **Taille initiale** : 215 MB (4 architectures)
- **Réduction obtenue** : ~9% (19 MB)
- **Objectif** : 50-60 MB pour debug, 30-40 MB pour release

### ❌ Pourquoi la réduction est faible ?

La réduction des architectures (4 → 1) n'a réduit que de 9% car :

1. **Bibliothèques natives volumineuses** :
   - `react-native-webrtc` : ~50-80 MB par architecture
   - `react-native-vision-camera` : ~20-30 MB par architecture
   - `@tensorflow/tfjs-react-native` : ~30-50 MB par architecture
   - `livekit-react-native` : ~20-30 MB par architecture

2. **Build DEBUG** (non optimisé) :
   - Pas de minification
   - Pas de ProGuard/R8
   - Pas de compression des ressources
   - Symboles de debug inclus

3. **Assets/images** : Peuvent être volumineux

### ✅ Solutions pour réduire davantage

#### Solution 1 : Build RELEASE (RECOMMANDÉ)

Le build release avec optimisations peut réduire de 30-40% :

```powershell
cd mobile/android
.\gradlew.bat assembleRelease
```

**Avantages** :
- Minification (ProGuard/R8)
- Compression des ressources
- Tree-shaking
- Suppression des symboles de debug

**Taille attendue** : ~60-80 MB (au lieu de 196 MB)

#### Solution 2 : Vérifier les bibliothèques natives

Certaines bibliothèques peuvent être optimisées :

```powershell
# Analyser la taille des bibliothèques natives
cd mobile/android
.\gradlew.bat app:dependencies --configuration releaseRuntimeClasspath | Select-String "react-native"
```

#### Solution 3 : Optimiser les assets

```powershell
# Vérifier la taille des assets
cd mobile
Get-ChildItem -Recurse assets -File | Measure-Object -Property Length -Sum
```

**Actions** :
- Convertir PNG → WebP
- Compresser les images
- Supprimer les assets non utilisés

#### Solution 4 : Splits APK (si besoin de plusieurs architectures)

Si vous avez besoin de plusieurs architectures, utilisez les splits APK :

```gradle
// mobile/android/app/build.gradle
android {
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a'
            universalApk false
        }
    }
}
```

Cela créera 2 APK séparés (~50-60 MB chacun) au lieu d'un APK universel.

#### Solution 5 : App Bundle (AAB) pour Google Play

Pour Google Play, utilisez un App Bundle :

```powershell
cd mobile/android
.\gradlew.bat bundleRelease
```

**Avantages** :
- Google Play crée automatiquement des APK optimisés par architecture
- Les utilisateurs téléchargent uniquement leur architecture
- **Taille de téléchargement** : ~20-30 MB

### 📋 Plan d'action recommandé

1. ✅ **Déjà fait** : Réduire à arm64-v8a uniquement
2. ⏳ **À faire** : Builder en RELEASE pour voir la réduction
3. ⏳ **À faire** : Analyser les assets et les optimiser
4. ⏳ **À faire** : Vérifier si toutes les bibliothèques sont nécessaires

### 🎯 Objectifs de taille

- **APK debug** : 50-60 MB (actuellement 196 MB)
- **APK release** : 30-40 MB (à tester)
- **AAB (App Bundle)** : 20-30 MB (pour Google Play)

---

## 📝 Résumé

### Variables d'environnement
- ❌ Le build local ne charge PAS automatiquement les variables de `eas.json`
- ✅ Solution : Utiliser un fichier `.env` ou définir les variables système
- ✅ Les variables doivent commencer par `EXPO_PUBLIC_`

### Taille de l'APK
- ✅ Réduction de 9% obtenue (215 MB → 196 MB)
- ⏳ Build RELEASE nécessaire pour réduire davantage (objectif : 30-40 MB)
- ⏳ Optimisation des assets nécessaire



