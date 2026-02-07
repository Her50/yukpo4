# 🔍 ANALYSE DU PROBLÈME DE FOND - 5 JOURS DE BUILD ÉCHOUÉS

**Date**: 2025-02-05  
**Problème**: Build Android EAS échoue systématiquement depuis 5 jours

---

## 📋 RÉSUMÉ DES RECHERCHES EN LIGNE

### Problèmes Courants Identifiés dans l'Écosystème Expo/React Native

Les recherches confirment que vos problèmes sont **très courants** lors de mises à jour Expo/React Native :

1. **Cascades d'incompatibilités** : Une mise à jour mineure (Android SDK, Gradle) crée une chaîne de ruptures
2. **Modules natifs obsolètes** : `expo-modules-core`, `expo-crypto` ont des dépendances de build incompatibles
3. **Scripts de fix fragiles** : Les scripts `postinstall.js` ne s'appliquent pas correctement lors des builds EAS

---

## 🔴 PROBLÈME DE FOND IDENTIFIÉ

### Le Vrai Problème : `ExpoModulesCorePlugin.gradle`

Le fichier `expo-modules-core/android/build.gradle` **ORIGINAL** utilise :
```gradle
def expoModulesCorePlugin = new File(...)
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
```

Cette fonction `applyKotlinExpoModulesCorePlugin()` définit probablement `kotlinVersion()` **APRÈS** que `KOTLIN_MAJOR_VERSION` soit utilisé dans le `buildscript`.

**Ordre d'exécution problématique** :
1. `buildscript { ext.KOTLIN_MAJOR_VERSION = kotlinVersion.split(...) }` ← **ERREUR** : `kotlinVersion` n'existe pas encore
2. `applyKotlinExpoModulesCorePlugin()` ← Définit `kotlinVersion()` mais trop tard

---

## 📋 PROBLÈMES IDENTIFIÉS DEPUIS 5 JOURS

### 1. `compileSdkVersion` non accessible
- **Symptôme**: `expo-module-gradle-plugin` ne trouve pas `compileSdkVersion`
- **Cause**: `expo-modules-core/android` non inclus dans `pluginManagement`
- **Solution**: ✅ Ajouté `includeBuild` dans `settings.gradle`

### 2. `expo-crypto` utilise `expo-module-gradle-plugin`
- **Symptôme**: `expo-crypto` cherche `compileSdkVersion` dans `rootProject.ext`
- **Cause**: `expo-crypto` utilise le plugin qui nécessite des propriétés non définies
- **Solution**: ✅ Patch créé pour retirer le plugin

### 3. `KOTLIN_MAJOR_VERSION` non défini
- **Symptôme**: `Could not get unknown property 'KOTLIN_MAJOR_VERSION'`
- **Cause**: `kotlinVersion()` n'est pas défini au moment où `KOTLIN_MAJOR_VERSION` est calculé
- **Solution**: ⚠️ Patch créé mais peut ne pas s'appliquer correctement

### 4. Conflit Kotlin Version
- **Symptôme**: `app.config.js` définit Kotlin 2.0.0, `gradle.properties` définit 1.9.25
- **Cause**: Incohérence entre expo-build-properties et gradle.properties
- **Solution**: ✅ Corrigé dans `app.config.js`

---

## 🎯 SOLUTION RADICALE PROPOSÉE

### Option 1: Mettre à jour `expo-modules-core` vers une version compatible

**Vérifier si une version plus récente résout le problème** :
- `expo-modules-core@2.2.3` (actuel, PINNED)
- `expo-modules-core@~2.5.0` (version dans Expo SDK 52)

**Risque**: Peut introduire d'autres incompatibilités

### Option 2: Créer un patch complet pour `expo-modules-core`

Le patch doit :
1. Définir `kotlinVersion` AVANT le `buildscript`
2. Définir `KOTLIN_MAJOR_VERSION` AVANT son utilisation
3. Remplacer toutes les références à `kotlinVersion()` par des variables définies

### Option 3: Downgrade vers une configuration qui fonctionnait

**Restauration complète depuis le commit `16afbdb20d556b52139f58d8981a1ac6a4b834ee`** :
- Restaurer tous les fichiers de build
- Identifier les différences avec la version actuelle
- Appliquer uniquement les changements nécessaires

---

## 📊 COMPATIBILITÉ DES VERSIONS

### Versions Actuelles
- **Expo SDK**: `~52.0.0` ✅
- **React Native**: `0.76.9` ✅
- **expo-modules-core**: `2.2.3` (PINNED) ⚠️
- **Kotlin**: `1.9.25` ✅
- **AGP**: `8.6.0` ✅
- **Gradle**: `8.10.2` ✅
- **compileSdkVersion**: `35` ✅

### Problème de Compatibilité
- **expo-modules-core 2.2.3** utilise `ExpoModulesCorePlugin.gradle` qui définit `kotlinVersion()` de manière asynchrone
- **expo-modules-core 2.5.0** (version standard Expo SDK 52) peut avoir une structure différente

---

## 🔧 ACTIONS IMMÉDIATES

1. **Vérifier le patch expo-modules-core** : S'assurer qu'il corrige le bon fichier
2. **Vérifier ExpoModulesCorePlugin.gradle** : Comprendre comment `kotlinVersion()` est défini
3. **Tester localement** : `cd android && ./gradlew :expo-modules-core:build` avant EAS Build
4. **Considérer upgrade** : Tester `expo-modules-core@~2.5.0` si compatible

---

## 💡 RECOMMANDATION FINALE

**Avant de relancer un build EAS** :
1. ✅ Vérifier que les patches sont bien créés
2. ✅ Tester le build localement
3. ✅ Vérifier `ExpoModulesCorePlugin.gradle` pour comprendre `kotlinVersion()`
4. ⚠️ Considérer upgrade `expo-modules-core` si le patch ne fonctionne pas

**Le problème de fond** : `ExpoModulesCorePlugin.gradle` définit `kotlinVersion()` de manière qui n'est pas compatible avec l'ordre d'exécution du `buildscript`.

