# 🎬 Guide d'Installation Complète - Module AR Immersif

## 📋 Vue d'ensemble

Ce guide couvre l'installation complète du module de montage vidéo immersif AR pour Yukpomnang, incluant:
- **ARVideoEditor** : Éditeur AR natif avec tracking
- **Rendu 3D Blender** : Pipeline de rendu backend
- **Intégration Remotion** : Templates AR pour génération vidéo

---

## ✅ Phase 1: Dépendances NPM/Expo

### Mobile (React Native / Expo)

```bash
cd mobile
npm install
```

**Dépendances AR ajoutées:**
- `expo-gl` (~14.0.3) - OpenGL pour rendu 3D
- `expo-gl-cpp` (~13.0.2) - Support C++ pour expo-gl
- `expo-three` (~7.0.0) - Three.js pour Expo

**Dépendances existantes utilisées:**
- `expo-camera` (~16.0.18) - Caméra pour AR
- `expo-av` (~15.0.2) - Audio/Vidéo
- `react-native-reanimated` (~3.16.1) - Animations

### Frontend (Web)

```bash
cd frontend
npm install
```

**Dépendances existantes:**
- `three` (via Remotion) - Rendu 3D web
- `@react-three/fiber` - React Three Fiber
- `@react-three/drei` - Helpers Three.js

### Video Renderer (Remotion)

```bash
cd video-renderer
npm install
```

**Dépendances existantes:**
- `@remotion/three` (^4.0.88) - Remotion + Three.js
- `three` (^0.164.0) - Three.js
- `@react-three/fiber` (^8.15.12) - React Three Fiber
- `@react-three/drei` (^9.110.0) - Helpers Three.js

---

## ✅ Phase 2: Configuration Native

### iOS (ARKit)

#### 1. Ajouter permissions dans `ios/Yukpomnang/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Cette app utilise la caméra pour l'édition vidéo en réalité augmentée</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Cette app utilise la localisation pour améliorer l'expérience AR</string>
```

#### 2. Installer pods:

```bash
cd ios
pod install
cd ..
```

#### 3. Vérifier ARKit dans Xcode:

- Ouvrir `ios/Yukpomnang.xcworkspace` dans Xcode
- Vérifier que `ARKit.framework` est lié dans "Linked Frameworks and Libraries"

### Android (ARCore)

#### 1. Ajouter permissions dans `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera.ar" android:required="false" />
```

#### 2. Ajouter ARCore dans `android/app/build.gradle`:

```gradle
dependencies {
    // ... autres dépendances
    implementation 'com.google.ar:core:1.40.0'
}
```

#### 3. Vérifier compatibilité ARCore:

```xml
<uses-feature android:name="android.hardware.camera.ar" android:required="false" />
<meta-data android:name="com.google.ar.core" android:value="required" />
```

---

## ✅ Phase 3: Configuration Backend (Blender)

### 1. Installer Blender

**Windows:**
```bash
# Télécharger depuis https://www.blender.org/download/
# Installer dans C:\Program Files\Blender Foundation\Blender 4.x\
```

**macOS:**
```bash
brew install --cask blender
# ou télécharger depuis https://www.blender.org/download/
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install blender
```

### 2. Vérifier installation:

```bash
blender --version
# Devrait afficher: Blender 3.0+ ou 4.0+
```

### 3. Configurer variables d'environnement:

Créer/modifier `.env` dans le dossier `backend/`:

```bash
# Blender Configuration
BLENDER_PATH=/usr/bin/blender  # ou chemin complet vers blender.exe
BLENDER_RENDER_SCRIPT=scripts/blender/render_ar_scene.py
BLENDER_RENDER_SAMPLES=64
BLENDER_USE_GPU=true
AR_RENDER_OUTPUT_DIR=storage/ar_previews
```

**Note:** Sur Windows, utiliser le chemin complet:
```bash
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
```

### 4. Tester le script Blender:

```bash
# Créer un fichier de test
echo '{"scene_id":"test","position":{"x":0,"y":0,"z":0},"clips":[]}' > test_scene.json

# Tester le rendu
blender --background --python scripts/blender/render_ar_scene.py test_scene.json test_output.mp4
```

---

## ✅ Phase 4: Intégration dans l'Application

### Mobile - Intégrer ARVideoEditor

Le composant `ARVideoEditor.tsx` est maintenant disponible dans:
```
mobile/src/components/ARVideoEditor.tsx
```

**Utilisation dans VideoCreationWizardScreen:**

```typescript
import ARVideoEditor from '../../components/ARVideoEditor';

// Dans le composant
const [showAREditor, setShowAREditor] = useState(false);

// Ajouter un bouton pour ouvrir l'éditeur AR
<NativeButton
    onPress={() => setShowAREditor(true)}
    variant="primary"
>
    Ouvrir éditeur AR
</NativeButton>

// Modal avec ARVideoEditor
{showAREditor && (
    <Modal visible={showAREditor} animationType="slide">
        <ARVideoEditor
            productName={productName}
            serviceId={serviceId}
            productIndex={productIndex}
            onVideoCaptured={(videoUri) => {
                console.log('Vidéo AR capturée:', videoUri);
                setShowAREditor(false);
                // Intégrer la vidéo dans la timeline
            }}
            onClose={() => setShowAREditor(false)}
        />
    </Modal>
)}
```

### Frontend - ImmersiveVideoWizard

Le wizard web utilise déjà les templates AR via Remotion:
- `ARHighlightScene` - Scène avec effets AR 3D
- Templates disponibles dans `video-renderer/src/templates/`

---

## ✅ Phase 5: Vérification et Tests

### 1. Vérifier les dépendances installées:

```bash
# Mobile
cd mobile
npm list expo-gl expo-three expo-camera

# Video Renderer
cd video-renderer
npm list @remotion/three three @react-three/fiber
```

### 2. Tester ARVideoEditor (Mobile):

```bash
cd mobile
npm run ios  # ou npm run android
```

**Checklist:**
- [ ] Permissions caméra demandées et accordées
- [ ] Indicateur de tracking AR visible
- [ ] Bouton d'enregistrement fonctionnel
- [ ] Timer d'enregistrement actif
- [ ] Vidéo capturée et URI retournée

### 3. Tester rendu Blender (Backend):

```bash
# Depuis le dossier racine
blender --background --python scripts/blender/render_ar_scene.py \
    storage/ar_previews/test_scene.json \
    storage/ar_previews/test_output.mp4
```

**Vérifier:**
- [ ] Script s'exécute sans erreur
- [ ] Fichier vidéo généré
- [ ] Qualité de rendu acceptable

### 4. Tester pipeline complet:

1. **Mobile:** Capturer vidéo AR avec ARVideoEditor
2. **Backend:** Uploader la vidéo vers le serveur
3. **Remotion:** Générer vidéo finale avec effets AR
4. **Vérifier:** Vidéo finale contient les effets AR

---

## 🐛 Troubleshooting

### Problème: expo-gl ne s'installe pas

**Solution:**
```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo install expo-gl expo-gl-cpp
```

### Problème: ARKit/ARCore non détecté

**iOS:**
- Vérifier que l'appareil supporte ARKit (iPhone 6s+)
- Tester sur appareil réel (pas simulateur)

**Android:**
- Vérifier que l'appareil supporte ARCore
- Consulter: https://developers.google.com/ar/discover/supported-devices

### Problème: Blender non trouvé

**Solution:**
```bash
# Ajouter Blender au PATH
export PATH=$PATH:/path/to/blender

# Ou utiliser variable d'environnement
export BLENDER_PATH=/path/to/blender
```

### Problème: Rendu Blender lent

**Solutions:**
- Activer GPU: `BLENDER_USE_GPU=true`
- Réduire samples: `BLENDER_RENDER_SAMPLES=32`
- Réduire résolution dans le script

---

## 📝 Prochaines Étapes

### Améliorations futures:

1. **Tracking AR réel:**
   - Intégrer ARKit via `react-native-arkit` (iOS)
   - Intégrer ARCore via `react-native-arcore` (Android)
   - Détection de surfaces réelles

2. **Effets AR avancés:**
   - Particules 3D synchronisées avec audio
   - Overlay produits en temps réel
   - Tracking de mouvements

3. **Optimisations:**
   - Cache des previews AR
   - Rendu GPU backend
   - Compression vidéo optimisée

---

## 📚 Ressources

- [Expo Camera Docs](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Expo GL Docs](https://docs.expo.dev/versions/latest/sdk/gl/)
- [Three.js Docs](https://threejs.org/docs/)
- [Remotion Three Docs](https://www.remotion.dev/docs/three)
- [Blender Python API](https://docs.blender.org/api/current/)
- [ARKit Documentation](https://developer.apple.com/documentation/arkit)
- [ARCore Documentation](https://developers.google.com/ar)

---

**Date:** 2025-01-27  
**Statut:** ✅ Installation complète prête


