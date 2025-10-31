# Guide de dépannage - Erreurs de build EAS

## 🚨 Erreur : "Could not resolve com.github.Dimezis:BlurView"

### 📋 Description du problème
```
Could not resolve com.github.Dimezis:BlurView:version-2.0.6.
> Could not GET 'https://www.jitpack.io/com/github/Dimezis/BlurView/version-2.0.4/BlurView-version-2.0.4.pom'. 
> Received status code 500 from server: Internal Server Error
```

### 🔍 Cause
- **Conflit de dépendances** : L'application utilise à la fois `@react-native-community/blur` et `expo-blur`
- **Problème JitPack** : Le serveur JitPack retourne une erreur 500
- **Incompatibilité** : `@react-native-community/blur` n'est pas compatible avec les builds EAS cloud

### ✅ Solution appliquée

#### 1. **Unification des dépendances BlurView**
- **Supprimé** : `@react-native-community/blur` du package.json
- **Conservé** : `expo-blur` (compatible EAS)
- **Modifié** : Tous les composants utilisent maintenant `expo-blur`

#### 2. **Correction des imports**
```typescript
// AVANT (problématique)
import { BlurView } from '@react-native-community/blur';

// APRÈS (corrigé)
import { BlurView } from 'expo-blur';
```

#### 3. **Adaptation de l'API**
```typescript
// AVANT (API @react-native-community/blur)
<BlurView
  blurType={blurType}
  blurAmount={intensity}
  reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.8)"
>

// APRÈS (API expo-blur)
<BlurView
  intensity={intensity}
  tint={blurType === 'dark' ? 'dark' : 'light'}
>
```

### 🛠️ Script de correction automatique

Exécutez le script `fix-blur-dependency.ps1` :
```powershell
.\fix-blur-dependency.ps1
```

Ce script :
1. Nettoie le cache npm
2. Supprime node_modules et package-lock.json
3. Réinstalle les dépendances
4. Vérifie que expo-blur est installé
5. Supprime @react-native-community/blur si présent
6. Nettoie le cache Expo

### 🔄 Étapes manuelles (si le script échoue)

#### 1. Nettoyer les dépendances
```bash
# Supprimer les dépendances
rm -rf node_modules package-lock.json

# Nettoyer le cache
npm cache clean --force
```

#### 2. Modifier package.json
```json
{
  "dependencies": {
    // SUPPRIMER cette ligne :
    // "@react-native-community/blur": "^4.4.1",
    
    // CONSERVER cette ligne :
    "expo-blur": "~14.0.3"
  }
}
```

#### 3. Réinstaller les dépendances
```bash
npm install
npx expo install --fix
```

#### 4. Vérifier les imports
Rechercher et remplacer dans tous les fichiers :
```bash
# Rechercher les imports problématiques
grep -r "@react-native-community/blur" src/

# Remplacer par expo-blur
# (fait manuellement dans chaque fichier)
```

### 🧪 Test de la correction

#### 1. Vérifier les dépendances
```bash
# Vérifier que expo-blur est installé
npm list expo-blur

# Vérifier que @react-native-community/blur n'est plus installé
npm list @react-native-community/blur
```

#### 2. Test local
```bash
# Démarrer l'application en mode développement
npx expo start

# Tester les composants avec BlurView
# - GlassmorphismCard
# - ModernBackground  
# - ModernCard
```

#### 3. Test de build
```bash
# Build de test (local)
npx expo run:android

# Build EAS (cloud)
eas build --platform android
```

### 📊 Composants affectés

| Composant | Import corrigé | API adaptée |
|-----------|----------------|-------------|
| `GlassmorphismCard.tsx` | ✅ Déjà correct | ✅ Compatible |
| `ModernBackground.tsx` | ✅ Déjà correct | ✅ Compatible |
| `ModernCard.tsx` | ✅ Corrigé | ✅ Adapté |

### 🚨 Erreurs similaires à surveiller

#### 1. **Autres dépendances JitPack**
```
Could not resolve com.github.[AUTHOR]:[REPO]
> Could not GET 'https://www.jitpack.io/...'
> Received status code 500 from server
```

**Solution** : Remplacer par des alternatives Expo ou npm officielles

#### 2. **Conflits de dépendances React Native**
```
Could not resolve all dependencies for configuration ':app:releaseRuntimeClasspath'
```

**Solution** : 
- Vérifier les versions dans package.json
- Utiliser `npx expo install --fix`
- Nettoyer le cache Gradle

#### 3. **Problèmes de cache Gradle**
```
Repository maven4 is disabled due to earlier error
```

**Solution** :
- Nettoyer le cache Gradle
- Relancer le build
- Vérifier la connectivité réseau

### 🔧 Prévention

#### 1. **Utiliser exclusivement les packages Expo**
```json
{
  "dependencies": {
    // ✅ BON - Packages Expo
    "expo-blur": "~14.0.3",
    "expo-linear-gradient": "~14.0.2",
    "expo-camera": "~16.0.18",
    
    // ❌ ÉVITER - Packages communautaires problématiques
    // "@react-native-community/blur": "^4.4.1",
    // "react-native-linear-gradient": "^2.8.3"
  }
}
```

#### 2. **Vérifier la compatibilité EAS**
- Consulter la [documentation Expo](https://docs.expo.dev/)
- Utiliser `npx expo install` pour les dépendances
- Éviter les packages qui dépendent de JitPack

#### 3. **Tests réguliers**
```bash
# Test de build local avant EAS
npx expo run:android

# Test de build EAS en mode preview
eas build --platform android --profile preview
```

### 📞 Support

Si le problème persiste :
1. **Vérifiez les logs** : `eas build:list` pour voir les détails
2. **Testez localement** : `npx expo run:android`
3. **Consultez la documentation** : [Expo Build Troubleshooting](https://docs.expo.dev/build/troubleshooting/)
4. **Contactez le support** : [Expo Discord](https://chat.expo.dev/)

---

*Ce guide couvre la correction du problème BlurView et fournit des solutions pour des erreurs similaires.*














