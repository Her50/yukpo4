# ✅ CORRECTION - kotlinVersion dans rootProject.ext

**Date**: 2025-02-05  
**Erreur**: `Could not get unknown property 'kotlinVersion' for object of type org.gradle.api.internal.initialization.DefaultScriptHandler_Decorated`

---

## 🔴 PROBLÈME IDENTIFIÉ

**Erreur** :
```
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > A problem occurred evaluating project ':android'.
      > Could not get unknown property 'kotlinVersion' for object of type org.gradle.api.internal.initialization.DefaultScriptHandler_Decorated.
```

**Cause** : `ExpoModulesCorePlugin.gradle` cherche `project.rootProject.ext.get("kotlinVersion")` mais `kotlinVersion` n'est défini que dans `ext`, pas dans `rootProject.ext`.

**Code dans ExpoModulesCorePlugin.gradle** :
```gradle
project.ext.kotlinVersion = {
  project.rootProject.ext.has("kotlinVersion")
      ? project.rootProject.ext.get("kotlinVersion")
      : "1.9.24"
}
```

---

## ✅ SOLUTION APPLIQUÉE

### Ajout de `rootProject.ext.kotlinVersion` dans `android/build.gradle`

**Fichier**: `mobile/android/build.gradle`

**Code ajouté** :
```gradle
buildscript {
    ext {
        // ... autres propriétés ...
        kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'
    }
    
    // ✅ CRITIQUE: Définir kotlinVersion dans rootProject.ext pour expo-modules-core
    // ExpoModulesCorePlugin.gradle cherche project.rootProject.ext.get("kotlinVersion")
    rootProject.ext.kotlinVersion = ext.kotlinVersion
}
```

**Fonction** : Définit `kotlinVersion` dans `rootProject.ext` pour qu'il soit accessible par `ExpoModulesCorePlugin.gradle`.

**Impact** : `expo-modules-core/android/build.gradle` peut maintenant accéder à `kotlinVersion` via `project.rootProject.ext.get("kotlinVersion")`.

---

## 📋 POURQUOI C'EST NÉCESSAIRE

1. **`ExpoModulesCorePlugin.gradle` cherche `rootProject.ext.kotlinVersion`** : Il ne cherche pas dans `ext` mais dans `rootProject.ext`
2. **`kotlinVersion` était défini seulement dans `ext`** : Pas accessible depuis `expo-modules-core/android`
3. **Avec `rootProject.ext.kotlinVersion`** : Accessible depuis tous les sous-projets, y compris `expo-modules-core/android`

---

## 🎯 RÉSULTAT ATTENDU

- ✅ `kotlinVersion` est maintenant accessible depuis `expo-modules-core/android`
- ✅ `ExpoModulesCorePlugin.gradle` peut trouver `kotlinVersion`
- ✅ Le build devrait fonctionner

---

## 📋 PROCHAINES ÉTAPES

1. ✅ `rootProject.ext.kotlinVersion` ajouté dans `android/build.gradle`
2. ⏳ Relancer le build EAS pour vérifier

