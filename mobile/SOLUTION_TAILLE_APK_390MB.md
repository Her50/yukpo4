# 🔧 Solution pour réduire l'APK de 390+ MB

## ⚠️ Problème identifié

L'APK fait **390+ MB** alors que l'objectif est **30-40 MB**. C'est **10x trop gros** !

## 🔍 Causes principales

### 1. **Toutes les architectures incluses** (PROBABLEMENT)

EAS Build peut inclure toutes les architectures par défaut :
- `armeabi-v7a` (32-bit ARM)
- `arm64-v8a` (64-bit ARM) ✅
- `x86` (32-bit Intel)
- `x86_64` (64-bit Intel)

**Impact** : Chaque bibliothèque native est incluse **4 fois** !

### 2. **Bibliothèques natives volumineuses**

- `react-native-webrtc` : ~50-80 MB par architecture
- `react-native-vision-camera` : ~20-30 MB par architecture
- `@tensorflow/tfjs-react-native` : ~30-50 MB par architecture
- `livekit-react-native` : ~20-30 MB par architecture

**Avec 4 architectures** : ~480-760 MB !

### 3. **Build non optimisé**

Même si ProGuard/R8 est activé, certaines optimisations peuvent ne pas être appliquées.

## ✅ Solutions

### Solution 1 : Forcer une seule architecture dans EAS Build

Modifier `eas.json` pour spécifier l'architecture :

```json
{
  "build": {
    "production": {
      "env": {
        // ... vos variables ...
      },
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:assembleRelease",
        "env": {
          "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a"
        }
      }
    }
  }
}
```

### Solution 2 : Utiliser App Bundle (AAB) au lieu d'APK

L'App Bundle permet à Google Play de créer des APK optimisés par architecture.

**Déjà configuré** : `"buildType": "app-bundle"` dans `eas.json`

**Avantage** : Les utilisateurs téléchargent uniquement leur architecture (~20-30 MB)

### Solution 3 : Vérifier et optimiser gradle.properties

S'assurer que `gradle.properties` limite les architectures :

```properties
reactNativeArchitectures=arm64-v8a
```

### Solution 4 : Activer les optimisations EAS

Ajouter dans `eas.json` :

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle",
        "image": "latest",
        "env": {
          "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a"
        },
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

## 🚀 Plan d'action immédiat

1. **Vérifier `gradle.properties`** : S'assurer que `reactNativeArchitectures=arm64-v8a`
2. **Modifier `eas.json`** : Ajouter `EXPO_ANDROID_ARCHITECTURES=arm64-v8a`
3. **Relancer le build** : `eas build --platform android --profile production`
4. **Vérifier la taille** : Devrait être ~30-40 MB pour l'AAB

## 📊 Taille attendue après optimisation

- **AAB (App Bundle)** : ~30-40 MB
- **APK universel** : ~80-100 MB (si nécessaire)
- **APK par architecture** : ~20-30 MB chacun

## ⚠️ Note importante

Si vous téléchargez un **APK universel** depuis EAS, il contiendra toutes les architectures (d'où les 390 MB).

**Solution** : Utilisez l'**App Bundle (AAB)** et laissez Google Play gérer la distribution, ou téléchargez un APK spécifique à une architecture.



