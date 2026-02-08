# 🔍 DIAGNOSTIC PROFOND COMPLET - BUILD ANDROID

**Date**: 2025-02-05  
**Problème**: Build échoue depuis 5 jours avec `kotlinVersion` non accessible  
**Contexte**: Build fonctionnait avant le 01 février 2026

---

## 🔴 ERREUR ACTUELLE

```
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > A problem occurred evaluating project ':android'.
      > Could not get unknown property 'kotlinVersion' for object of type org.gradle.api.internal.initialization.DefaultScriptHandler_Decorated.
```

**Fichier**: `expo-modules-core/android/build.gradle`  
**Ligne**: Dans `applyKotlinExpoModulesCorePlugin()`  
**Contexte**: `ExpoModulesCorePlugin.gradle` cherche `project.rootProject.ext.get("kotlinVersion")`

---

## 📋 ANALYSE DU PROBLÈME

### 1. Ordre d'Exécution Gradle

**Ordre actuel** :
1. `settings.gradle` est évalué
2. `pluginManagement` inclut `expo-modules-core/android` via `includeBuild`
3. `expo-modules-core/android/build.gradle` est évalué
4. `applyKotlinExpoModulesCorePlugin()` est appelé
5. `ExpoModulesCorePlugin.gradle` cherche `project.rootProject.ext.get("kotlinVersion")`
6. ❌ **ERREUR**: `rootProject.ext.kotlinVersion` n'existe pas encore
7. `android/build.gradle` est évalué (trop tard)

**Le problème** : `expo-modules-core/android` est évalué AVANT que `android/build.gradle` ne définisse `rootProject.ext.kotlinVersion`.

### 2. Code dans ExpoModulesCorePlugin.gradle

```gradle
project.ext.kotlinVersion = {
  project.rootProject.ext.has("kotlinVersion")
      ? project.rootProject.ext.get("kotlinVersion")
      : "1.9.24"  // Fallback
}
```

**Le problème** : `rootProject.ext.kotlinVersion` doit être défini AVANT que `expo-modules-core/android/build.gradle` ne soit évalué.

### 3. Tentative de Correction Actuelle

**Fichier**: `mobile/android/build.gradle`
```gradle
buildscript {
    ext {
        kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'
    }
    rootProject.ext.kotlinVersion = ext.kotlinVersion  // ← NE FONCTIONNE PAS
}
```

**Pourquoi ça ne fonctionne pas** :
- `rootProject.ext` n'est pas encore initialisé dans le `buildscript`
- `expo-modules-core/android` est évalué AVANT que le `buildscript` ne soit complètement exécuté

---

## ✅ SOLUTION DÉFINITIVE

### Option 1: Définir `rootProject.ext.kotlinVersion` dans `settings.gradle` (RECOMMANDÉ)

**Fichier**: `mobile/android/settings.gradle`

Ajouter AVANT `pluginManagement` :
```gradle
// ✅ CRITIQUE: Définir kotlinVersion dans rootProject.ext AVANT includeBuild
// Cela doit être fait AVANT que expo-modules-core/android ne soit évalué
rootProject.ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'

pluginManagement {
    // ...
}
```

**Avantage** : `rootProject.ext.kotlinVersion` est défini AVANT que `expo-modules-core/android` ne soit évalué.

### Option 2: Script postinstall pour modifier `expo-modules-core/android/build.gradle`

**Fichier**: `mobile/fix-expo-modules-core-kotlin-version-v2.js`

Définir `rootProject.ext.kotlinVersion` directement dans `expo-modules-core/android/build.gradle` AVANT `applyKotlinExpoModulesCorePlugin()`.

---

## 📊 COMPARAISON AVEC CONFIGURATION QUI FONCTIONNAIT

### Commit fonctionnel: `16afbdb20d556b52139f58d8981a1ac6a4b834ee`

**Différences clés** :
1. ❌ **PAS d'`includeBuild` pour `expo-modules-core/android`** dans `settings.gradle`
2. ❌ **PAS de PIN de `expo-modules-core`** dans `package.json`
3. ✅ Configuration minimale

**Pourquoi ça fonctionnait** :
- `expo-modules-core/android` n'était PAS inclus dans `pluginManagement`
- Expo gérait automatiquement la résolution du plugin
- Pas de problème d'ordre d'exécution

**Pourquoi ça ne fonctionne plus** :
- Ajout d'`includeBuild` pour `expo-modules-core/android` (nécessaire pour que le plugin soit disponible)
- Mais cela crée un problème d'ordre d'exécution : `expo-modules-core/android` est évalué AVANT que `rootProject.ext.kotlinVersion` ne soit défini

---

## 🎯 PLAN D'ACTION DÉFINITIF

### Étape 1: Définir `rootProject.ext.kotlinVersion` dans `settings.gradle`

**Fichier**: `mobile/android/settings.gradle`

Ajouter au début :
```gradle
// ✅ CRITIQUE: Définir kotlinVersion dans rootProject.ext AVANT includeBuild
// ExpoModulesCorePlugin.gradle cherche project.rootProject.ext.get("kotlinVersion")
// Cela doit être fait AVANT que expo-modules-core/android ne soit évalué
rootProject.ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'

pluginManagement {
    // ...
}
```

### Étape 2: Retirer `rootProject.ext.kotlinVersion` de `android/build.gradle`

**Fichier**: `mobile/android/build.gradle`

Retirer :
```gradle
// ❌ RETIRER: Ne fonctionne pas car trop tard
rootProject.ext.kotlinVersion = ext.kotlinVersion
```

### Étape 3: Tester le build

---

## 📋 VERSIONS ET COMPATIBILITÉ

### Versions Actuelles
- **Expo SDK**: `~52.0.0` ✅
- **React Native**: `0.76.9` ✅
- **expo-modules-core**: `~2.0.0` (2.0.6 installé) ✅
- **Kotlin**: `1.9.25` ✅
- **AGP**: `8.6.0` ✅
- **Gradle**: `8.10.2` ✅
- **compileSdkVersion**: `35` ✅

### Changements Depuis le 01 Février 2026
- ✅ Ajout de `expo-auth-session` et `expo-web-browser` (nécessitent `expo-module-gradle-plugin`)
- ✅ Ajout d'`includeBuild` pour `expo-modules-core/android` (nécessaire pour le plugin)
- ❌ Problème d'ordre d'exécution créé

---

## 💡 CONCLUSION

**Le vrai problème** : Ordre d'exécution Gradle. `expo-modules-core/android` est évalué AVANT que `rootProject.ext.kotlinVersion` ne soit défini.

**La solution** : Définir `rootProject.ext.kotlinVersion` dans `settings.gradle` AVANT `pluginManagement`, pour qu'il soit disponible dès le début.



