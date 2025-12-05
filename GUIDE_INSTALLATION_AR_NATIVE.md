# 📘 Guide d'Installation - Tracking AR Natif

## 📋 Packages Recommandés

### iOS - ARKit

**Option 1 : react-native-arkit (Recommandé)**
```bash
npm install react-native-arkit
# ou
yarn add react-native-arkit
```

**Option 2 : @react-native-community/arkit**
```bash
npm install @react-native-community/arkit
```

### Android - ARCore

**Option 1 : react-native-arcore**
```bash
npm install react-native-arcore
```

**Option 2 : @react-native-ar/arcore**
```bash
npm install @react-native-ar/arcore
```

---

## 🔧 Configuration iOS (ARKit)

### 1. Ajouter dans `Info.plist` :

```xml
<key>NSCameraUsageDescription</key>
<string>Cette app utilise la caméra pour l'édition vidéo en réalité augmentée</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Cette app utilise la localisation pour améliorer l'expérience AR</string>
```

### 2. Configuration Podfile (si nécessaire) :

```ruby
pod 'ARKit', '~> 13.0'
```

### 3. Installer les pods :

```bash
cd ios
pod install
cd ..
```

---

## 🔧 Configuration Android (ARCore)

### 1. Ajouter dans `AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera.ar" android:required="false" />
```

### 2. Ajouter ARCore dans `build.gradle` :

```gradle
dependencies {
    implementation 'com.google.ar:core:1.40.0'
}
```

### 3. Vérifier la compatibilité ARCore :

```xml
<uses-feature android:name="android.hardware.camera.ar" android:required="false" />
<meta-data android:name="com.google.ar.core" android:value="required" />
```

---

## 📝 Notes d'Intégration

### Pour react-native-arkit

**Exemple d'utilisation** :
```typescript
import { ARKit } from 'react-native-arkit';

// Démarrer AR
ARKit.init();
ARKit.start();
```

### Pour react-native-arcore

**Exemple d'utilisation** :
```typescript
import { ARCore } from 'react-native-arcore';

// Démarrer AR
ARCore.start();
```

---

## ✅ Checklist Installation

### iOS
- [ ] Installer package ARKit
- [ ] Configurer Info.plist
- [ ] Installer pods
- [ ] Tester sur appareil iOS

### Android
- [ ] Installer package ARCore
- [ ] Configurer AndroidManifest.xml
- [ ] Ajouter dépendances Gradle
- [ ] Tester sur appareil Android compatible ARCore

---

**Date** : 2025-01-27

