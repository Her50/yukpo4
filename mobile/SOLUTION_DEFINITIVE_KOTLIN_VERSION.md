# ✅ SOLUTION DÉFINITIVE - kotlinVersion dans rootProject.ext

**Date**: 2025-02-05  
**Problème**: `Could not get unknown property 'kotlinVersion'` dans `expo-modules-core/android`

---

## 🔴 PROBLÈME IDENTIFIÉ

**Erreur** :
```
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > Could not get unknown property 'kotlinVersion' for object of type org.gradle.api.internal.initialization.DefaultScriptHandler_Decorated.
```

**Cause** : `ExpoModulesCorePlugin.gradle` cherche `project.rootProject.ext.get("kotlinVersion")` mais `rootProject.ext.kotlinVersion` n'est pas défini AVANT que `expo-modules-core/android/build.gradle` ne soit évalué.

---

## ✅ SOLUTION APPLIQUÉE

### Définir `rootProject.ext.kotlinVersion` dans `settings.gradle`

**Fichier**: `mobile/android/settings.gradle`

**Code ajouté** :
```gradle
// ✅ CRITIQUE: Définir kotlinVersion dans rootProject.ext AVANT includeBuild
// ExpoModulesCorePlugin.gradle cherche project.rootProject.ext.get("kotlinVersion")
// Cela doit être fait AVANT que expo-modules-core/android ne soit évalué
rootProject.ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'

pluginManagement {
    // ...
}
```

**Fonction** : Définit `rootProject.ext.kotlinVersion` AVANT que `pluginManagement` n'inclue `expo-modules-core/android`, garantissant qu'il est disponible lorsque `ExpoModulesCorePlugin.gradle` le cherche.

**Impact** : `expo-modules-core/android/build.gradle` peut maintenant accéder à `kotlinVersion` via `project.rootProject.ext.get("kotlinVersion")`.

### Retirer `rootProject.ext.kotlinVersion` de `android/build.gradle`

**Fichier**: `mobile/android/build.gradle`

**Code retiré** :
```gradle
// ❌ RETIRÉ: Ne fonctionne pas car trop tard (expo-modules-core est évalué avant)
rootProject.ext.kotlinVersion = ext.kotlinVersion
```

**Raison** : `expo-modules-core/android` est évalué AVANT que le `buildscript` de `android/build.gradle` ne soit complètement exécuté.

---

## 📋 POURQUOI CETTE SOLUTION FONCTIONNE

1. **Ordre d'exécution** : `settings.gradle` est évalué AVANT `pluginManagement`, donc AVANT que `expo-modules-core/android` ne soit inclus
2. **Disponibilité** : `rootProject.ext.kotlinVersion` est défini dès le début, accessible depuis tous les sous-projets
3. **Timing** : `ExpoModulesCorePlugin.gradle` peut trouver `kotlinVersion` au moment où il en a besoin

---

## 🎯 RÉSULTAT ATTENDU

- ✅ `rootProject.ext.kotlinVersion` est défini AVANT que `expo-modules-core/android` ne soit évalué
- ✅ `ExpoModulesCorePlugin.gradle` peut trouver `kotlinVersion`
- ✅ Le build devrait fonctionner

---

## 📋 PROCHAINES ÉTAPES

1. ✅ `rootProject.ext.kotlinVersion` ajouté dans `settings.gradle`
2. ✅ `rootProject.ext.kotlinVersion` retiré de `android/build.gradle`
3. ⏳ Relancer le build EAS pour vérifier



