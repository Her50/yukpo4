# 📊 Analyse de la taille de l'APK (215 MB)

## 🔍 Causes identifiées

### 1. **4 architectures natives** (PRINCIPALE CAUSE) ⚠️

Dans `gradle.properties` :
```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

**Impact** : Chaque bibliothèque native est incluse **4 fois** dans l'APK, multipliant la taille par 4 !

- `armeabi-v7a` : 32-bit ARM (anciens appareils)
- `arm64-v8a` : 64-bit ARM (99% des appareils modernes) ✅
- `x86` : 32-bit Intel (émulateurs uniquement)
- `x86_64` : 64-bit Intel (émulateurs uniquement)

**Solution** : Ne garder que `arm64-v8a` (ou `arm64-v8a` + `armeabi-v7a` pour compatibilité)

### 2. **Bibliothèques natives volumineuses**

- `react-native-webrtc` (~50-80 MB par architecture) - WebRTC
- `react-native-vision-camera` (~20-30 MB par architecture) - Camera native
- `@tensorflow/tfjs-react-native` (~30-50 MB par architecture) - TensorFlow
- `livekit-react-native` (~20-30 MB par architecture) - WebRTC

**Avec 4 architectures** : ~480-760 MB de bibliothèques natives !

### 3. **Build DEBUG (non optimisé)**

- ❌ Pas de minification
- ❌ Pas de ProGuard/R8
- ❌ Pas de compression des ressources
- ❌ Pas de tree-shaking

### 4. **Pas de splits APK**

Un seul APK contient toutes les architectures au lieu d'APK séparés.

## ✅ Solutions pour réduire la taille

### Solution 1 : Réduire les architectures (RECOMMANDÉ)

**Pour production** : Ne garder que `arm64-v8a` (99% des appareils modernes)

```properties
# Dans mobile/android/gradle.properties
reactNativeArchitectures=arm64-v8a
```

**Réduction estimée** : 215 MB → ~55 MB (75% de réduction)

**Pour compatibilité maximale** : Garder `arm64-v8a` + `armeabi-v7a`

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

**Réduction estimée** : 215 MB → ~110 MB (50% de réduction)

### Solution 2 : Configurer les splits APK

Créer des APK séparés par architecture (Google Play les gère automatiquement) :

```gradle
// Dans mobile/android/app/build.gradle
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

### Solution 3 : Build RELEASE avec optimisations

```powershell
cd mobile/android
.\gradlew.bat assembleRelease
```

Avec :
- ✅ Minification (ProGuard/R8)
- ✅ Compression des ressources
- ✅ Tree-shaking
- ✅ Optimisation du code

**Réduction estimée** : 30-40% supplémentaire

### Solution 4 : Vérifier les assets/images

```powershell
# Vérifier la taille des assets
cd mobile
Get-ChildItem -Recurse assets,images -File | Measure-Object -Property Length -Sum
```

Optimiser les images :
- Utiliser WebP au lieu de PNG
- Compresser les images
- Supprimer les assets non utilisés

## 📋 Plan d'action recommandé

### Étape 1 : Réduire les architectures (IMMÉDIAT)

```properties
# mobile/android/gradle.properties
reactNativeArchitectures=arm64-v8a
```

Puis rebuilder :
```powershell
cd mobile/android
.\gradlew.bat clean assembleDebug
```

**Résultat attendu** : ~55 MB au lieu de 215 MB

### Étape 2 : Configurer les splits APK (OPTIONNEL)

Si vous voulez supporter plusieurs architectures, utilisez les splits APK.

### Étape 3 : Builder en RELEASE (PRODUCTION)

```powershell
cd mobile/android
.\gradlew.bat assembleRelease
```

**Résultat attendu** : ~30-40 MB pour arm64-v8a uniquement

## 🎯 Objectif de taille

- **APK debug** : 50-60 MB (arm64-v8a uniquement)
- **APK release** : 30-40 MB (arm64-v8a uniquement, optimisé)
- **AAB (App Bundle)** : 20-30 MB (Google Play optimise automatiquement)

## ⚠️ Notes importantes

1. **x86/x86_64** : Ne sont nécessaires QUE pour les émulateurs Android
   - Pour les vrais appareils : inutile
   - Pour les émulateurs : Android Studio peut utiliser arm64-v8a via ARM translation

2. **armeabi-v7a** : De moins en moins nécessaire
   - Les appareils 32-bit ARM sont très rares maintenant
   - Google Play recommande arm64-v8a minimum

3. **Google Play** : Gère automatiquement les architectures
   - Si vous uploadez un AAB, Google Play crée des APK par architecture
   - Les utilisateurs téléchargent uniquement leur architecture

