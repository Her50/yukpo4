# 📊 Analyse : Build Android > 500Mo

## 🔍 Problèmes Identifiés

### ❌ 1. **assetBundlePatterns trop large**

**Problème** : Dans `app.json` et `mobile/app.config.js`
```json
"assetBundlePatterns": [
  "**/*"  // ❌ Inclut TOUS les fichiers du projet !
]
```

**Impact** :
- Inclut potentiellement des fichiers de développement
- Inclut des fichiers non nécessaires
- Inclut des dossiers comme `node_modules` (si mal configuré)
- Inclut des assets de test

**Solution** : Restreindre aux assets nécessaires uniquement

---

### ❌ 2. **Profil EAS "preview" non optimisé**

**Problème** : Dans `eas.json`
```json
"preview": {
  "distribution": "internal"
  // ❌ Pas d'optimisations spécifiques
}
```

**Manque** :
- Pas de minification activée
- Pas de shrinkResources
- Pas d'exclusions de dépendances inutiles
- Pas de compression d'assets

---

### ❌ 3. **Dépendances lourdes**

**Bibliothèques volumineuses identifiées** :
- `react-native-webrtc` (~124.0.3) : **~100-150 MB**
  - Inclut des binaires natifs pour toutes les architectures
  - Codecs vidéo/audio
  - LibWebRTC complète
- `expo-av` (~15.0.2) : **~20-30 MB**
- `expo-camera` (~16.0.18) : **~15-25 MB**
- `expo-video` (~2.0.1) : **~10-15 MB**
- `react-native-maps` (1.18.0) : **~10-15 MB**
  - Inclut les données Google Maps
- `@react-native-community/blur` (~4.4.1) : **~5-10 MB**

**Total estimé dépendances natives** : ~150-250 MB

---

### ❌ 4. **Build Android non optimisé**

**Problème** : Dans `mobile/android/app/build.gradle`
```gradle
minifyEnabled enableProguardInReleaseBuilds  // ❌ false par défaut
shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)  // ❌ false
```

**Impact** :
- Code non minifié
- Resources non compressées
- Assets non optimisés
- APK/AAB non optimisé

---

### ❌ 5. **Pas d'ABI splits configurés**

**Problème** : Le build inclut toutes les architectures
- `armeabi-v7a` (32-bit ARM)
- `arm64-v8a` (64-bit ARM)
- `x86` (32-bit Intel)
- `x86_64` (64-bit Intel)

**Impact** : Multiplie la taille par 4 si toutes incluses

---

## ✅ Solutions Recommandées

### 1. **Optimiser assetBundlePatterns**

**Modifier** `app.json` et `mobile/app.config.js` :
```json
"assetBundlePatterns": [
  "assets/**/*",
  "!assets/**/*.md",
  "!assets/**/*.txt",
  "!assets/videos/**/*",  // Exclure vidéos (chargées depuis CDN)
  "!node_modules/**/*"
]
```

**OU** (plus restrictif) :
```json
"assetBundlePatterns": [
  "assets/images/**/*",
  "assets/fonts/**/*",
  "assets/icons/**/*"
]
```

---

### 2. **Configurer le profil EAS preview avec optimisations**

**Modifier** `eas.json` :
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:bundleRelease",
        "env": {
          "ANDROID_ENABLE_PROGUARD": "true",
          "ANDROID_ENABLE_SHRINK_RESOURCES": "true"
        }
      }
    }
  }
}
```

---

### 3. **Activer ProGuard et shrinkResources**

**Créer/Modifier** `mobile/android/gradle.properties` :
```properties
android.enableProguardInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
android.enablePngCrunchInReleaseBuilds=true
```

---

### 4. **Configurer ABI splits (recommandé)**

**Modifier** `mobile/android/app/build.gradle` :
```gradle
android {
    // ... existing code ...
    
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"  // Seulement ARM (95% des devices)
            universalApk false
        }
    }
}
```

**Résultat** : APK séparés par architecture (réduction ~60-70%)

---

### 5. **Optimiser les dépendances**

#### A. **WebRTC** (si pas utilisé partout)
```json
// package.json - Vérifier si vraiment nécessaire partout
"react-native-webrtc": "^124.0.3"  // ❓ Utilisé dans preview ?
```

#### B. **Utiliser des alternatives plus légères**
- Remplacer `@react-native-community/blur` par `expo-blur` (si compatible)
- Vérifier si toutes les fonctionnalités d'`expo-av` sont utilisées

---

### 6. **Configurer buildProperties pour optimisations**

**Modifier** `mobile/app.config.js` :
```javascript
plugins: [
  [
    "expo-build-properties",
    {
      android: {
        // ... existing ...
        enableProguardInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        enableR8: true,
        enableR8FullMode: true,
        proguardMinifyEnabled: true,
        // Réduire la taille
        packagingOptions: {
          pickFirst: ['**/libc++_shared.so', '**/libfbjni.so']
        }
      }
    }
  ]
]
```

---

### 7. **Optimiser les assets**

#### A. **Compresser les images**
- Icon : Optimiser PNG (TinyPNG, ImageOptim)
- Splash : Optimiser PNG
- Adaptive Icon : Optimiser PNG

#### B. **Vérifier la taille des assets**
```bash
# Vérifier la taille des assets
du -sh assets/*
```

#### C. **Exclure les assets inutiles**
- Supprimer les assets de test
- Supprimer les assets de développement

---

### 8. **Utiliser App Bundle (AAB) au lieu d'APK**

**Modifier** `eas.json` :
```json
"preview": {
  "android": {
    "buildType": "app-bundle"  // Au lieu de "apk"
  }
}
```

**Avantage** : Google Play optimise automatiquement par device

---

## 📊 Réduction Estimée

| Optimisation | Réduction | Taille Après |
|-------------|-----------|--------------|
| **Base** | - | 500+ MB |
| ProGuard + shrinkResources | -50 MB | ~450 MB |
| ABI splits (ARM seulement) | -150 MB | ~300 MB |
| AssetBundle optimisé | -20 MB | ~280 MB |
| Optimisation assets | -10 MB | ~270 MB |
| **TOTAL** | **~230 MB** | **~270 MB** |

---

## 🎯 Plan d'Action Priorisé

### ✅ **Priorité HAUTE** (Impact immédiat)

1. **Activer ProGuard et shrinkResources**
   - Modifier `mobile/android/gradle.properties`
   - Réduction : ~50 MB

2. **Optimiser assetBundlePatterns**
   - Modifier `app.json` et `mobile/app.config.js`
   - Réduction : ~20 MB

3. **Configurer ABI splits (ARM seulement)**
   - Modifier `mobile/android/app/build.gradle`
   - Réduction : ~150 MB

### ⚡ **Priorité MOYENNE**

4. **Optimiser les assets**
   - Compresser les images
   - Réduction : ~10 MB

5. **Configurer EAS preview**
   - Modifier `eas.json`
   - Activation automatique des optimisations

### 📝 **Priorité BASSE**

6. **Réviser les dépendances**
   - Analyser l'utilisation de WebRTC
   - Réduction potentielle : Variable

---

## ⚠️ Notes Importantes

1. **WebRTC** : Si `react-native-webrtc` est nécessaire pour le preview, la taille restera importante (~100-150 MB)
2. **Test** : Toujours tester après optimisation pour vérifier que tout fonctionne
3. **ProGuard** : Peut nécessiter des règles ProGuard pour certaines dépendances
4. **ABI splits** : Nécessite de distribuer des APKs séparés par architecture

---

## 🔧 Commandes de Test

```bash
# Build local pour tester la taille
cd mobile
npx eas build --platform android --profile preview --local

# Vérifier la taille de l'APK généré
ls -lh android/app/build/outputs/apk/release/*.apk

# Ou pour AAB
ls -lh android/app/build/outputs/bundle/release/*.aab
```

---

## 📚 Ressources

- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [ProGuard Optimization](https://developer.android.com/studio/build/shrink-code)
- [ABI Splits](https://developer.android.com/studio/build/configure-apk-splits)


