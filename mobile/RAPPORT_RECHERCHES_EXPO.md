# 📊 RAPPORT RECHERCHES EXPO - ANALYSE COMPLÈTE

**Date**: 2025-02-05  
**Objectif**: Analyser les problèmes de build Android après 5 jours d'échecs

---

## 🔍 RECHERCHES EFFECTUÉES

### 1. Problèmes Courants Expo/React Native

**Résultats** : Les problèmes rencontrés sont **très courants** dans l'écosystème :
- Cascades d'incompatibilités lors de mises à jour
- Modules natifs avec dépendances de build incompatibles
- Scripts de fix fragiles qui ne survivent pas aux builds EAS

**Source** : [React Native : comment une simple mise à jour fait tout s'écrouler](https://forem.com/noodle/react-native-comment-une-simple-mise-a-jour-fait-tout-secrouler-405k)

---

## 🔴 PROBLÈME DE FOND IDENTIFIÉ

### Ordre d'Exécution Gradle dans `expo-modules-core`

**Le vrai problème** :
```gradle
// build.gradle ligne 10
applyKotlinExpoModulesCorePlugin()

// build.gradle ligne 13 (dans buildscript)
ext.KOTLIN_MAJOR_VERSION = kotlinVersion.split("\\.")[0].toInteger()
// ❌ kotlinVersion() n'existe pas encore !
```

**Dans ExpoModulesCorePlugin.gradle** :
```gradle
project.buildscript {  // S'exécute APRÈS le buildscript de build.gradle
  project.ext.kotlinVersion = { ... }  // Défini ici, mais trop tard
}
```

**Ordre d'exécution réel** :
1. `buildscript { ext.KOTLIN_MAJOR_VERSION = kotlinVersion.split(...) }` ← **ERREUR**
2. `applyKotlinExpoModulesCorePlugin()` ← Définit `kotlinVersion()` mais trop tard

---

## ✅ SOLUTION APPLIQUÉE

### Patch `expo-modules-core+2.2.3.patch`

Le patch corrige en :
1. Définissant `kotlinVersionValue` directement depuis `gradle.properties` AVANT le buildscript
2. Remplaçant `kotlinVersion()` par `kotlinVersionValue` partout

**Modifications du patch** :
- Ligne 11-12 : Définit `kotlinVersionValue` avant `KOTLIN_MAJOR_VERSION`
- Ligne 21 : Utilise `kotlinVersionValue` au lieu de `kotlinVersion`
- Ligne 30-31 : Utilise `kotlinVersionForCompose` au lieu de `kotlinVersion()`
- Ligne 42-43 : Utilise `kotlinVersionForDeps` au lieu de `kotlinVersion()`

---

## 📋 COMPATIBILITÉ DES VERSIONS

### Versions Actuelles
| Package | Version | Status |
|---------|---------|--------|
| Expo SDK | ~52.0.0 | ✅ |
| React Native | 0.76.9 | ✅ |
| expo-modules-core | 2.2.3 (PINNED) | ⚠️ |
| Kotlin | 1.9.25 | ✅ |
| AGP | 8.6.0 | ✅ |
| Gradle | 8.10.2 | ✅ |
| compileSdkVersion | 35 | ✅ |

### Problème de Compatibilité
- **expo-modules-core 2.2.3** : Structure avec `ExpoModulesCorePlugin.gradle` qui définit `kotlinVersion()` de manière asynchrone
- **expo-modules-core ~2.5.0** : Version standard Expo SDK 52, peut avoir une structure différente

---

## 🎯 RECOMMANDATIONS BASÉES SUR LES RECHERCHES

### 1. Utiliser des Patches Persistants (Déjà Fait ✅)
- Patch `expo-crypto+15.0.8.patch` créé ✅
- Patch `expo-modules-core+2.2.3.patch` créé ✅
- Plus fiable que les scripts `postinstall.js`

### 2. Vérifier que les Patches sont dans Git
- Les patches doivent être commités pour être appliqués lors des builds EAS
- Vérifier : `git status patches/`

### 3. Tester Localement Avant EAS Build
- `cd android && ./gradlew :expo-modules-core:build`
- Si ça fonctionne localement, le patch devrait fonctionner sur EAS

### 4. Considérer Upgrade expo-modules-core
- Si le patch ne fonctionne pas, tester `expo-modules-core@~2.5.0`
- Version standard Expo SDK 52, peut résoudre le problème à la source

---

## 📊 PROBLÈMES IDENTIFIÉS - CHRONOLOGIE

### Jour 1-2 : `compileSdkVersion` non accessible
- **Cause**: `expo-modules-core/android` non inclus dans `pluginManagement`
- **Solution**: ✅ Ajouté `includeBuild` dans `settings.gradle`

### Jour 3 : `expo-crypto` utilise plugin problématique
- **Cause**: `expo-crypto` utilise `expo-module-gradle-plugin` qui cherche `compileSdkVersion`
- **Solution**: ✅ Patch créé pour retirer le plugin

### Jour 4-5 : `KOTLIN_MAJOR_VERSION` non défini
- **Cause**: `kotlinVersion()` défini trop tard dans `ExpoModulesCorePlugin.gradle`
- **Solution**: ✅ Patch créé pour définir `kotlinVersionValue` avant utilisation

---

## 💡 CONCLUSION

**Le problème de fond** : `ExpoModulesCorePlugin.gradle` définit `kotlinVersion()` de manière qui n'est pas compatible avec l'ordre d'exécution du `buildscript` dans `build.gradle`.

**La solution** : Patch qui définit `kotlinVersionValue` directement depuis `gradle.properties` avant le buildscript.

**Prochaine étape** : Vérifier que le patch est commité et sera appliqué lors du build EAS.



