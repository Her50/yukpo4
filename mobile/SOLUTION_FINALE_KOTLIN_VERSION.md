# 🔧 SOLUTION FINALE - kotlinVersion pour expo-modules-core

**Date**: 2025-02-05  
**Problème**: `Could not get unknown property 'kotlinVersion'` persiste malgré les corrections

---

## 🔴 PROBLÈME RACINE

Le problème est que `expo-modules-core/android` est inclus via `includeBuild` dans `pluginManagement` de `settings.gradle`, et à ce moment-là :
1. `rootProject` n'existe pas encore (il est créé après l'évaluation de `settings.gradle`)
2. `android/build.gradle` n'est pas encore évalué (il est évalué après `settings.gradle`)
3. `ExpoModulesCorePlugin.gradle` essaie d'accéder à `project.rootProject.ext.get("kotlinVersion")` → **ERREUR**

---

## ✅ SOLUTION RECOMMANDÉE

### Option 1: Patch expo-modules-core (RECOMMANDÉ)

Créer un patch qui modifie `ExpoModulesCorePlugin.gradle` pour utiliser `findProperty('android.kotlinVersion')` au lieu de `project.rootProject.ext.get("kotlinVersion")`.

**Avantages**:
- `findProperty()` lit directement depuis `gradle.properties`
- Fonctionne AVANT que `rootProject.ext` ne soit défini
- Pas besoin de scripts `init.d` complexes

**Fichier à patcher**: `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle`

**Modification**:
```gradle
// AVANT
project.ext.kotlinVersion = {
  project.rootProject.ext.has("kotlinVersion")
      ? project.rootProject.ext.get("kotlinVersion")
      : "1.9.24"
}

// APRÈS
project.ext.kotlinVersion = {
  def kotlinVersion = project.findProperty('android.kotlinVersion')
  if (kotlinVersion) {
    return kotlinVersion
  }
  // Fallback: essayer rootProject.ext si disponible
  if (project.rootProject.hasProperty('ext') && project.rootProject.ext.has("kotlinVersion")) {
    return project.rootProject.ext.get("kotlinVersion")
  }
  // Fallback final
  return "1.9.25"
}
```

---

### Option 2: Retirer includeBuild de pluginManagement

Retirer `expo-modules-core/android` de `pluginManagement` et laisser Expo gérer cela automatiquement via `useExpoModules()`.

**Risque**: Peut causer d'autres problèmes si le plugin n'est pas résolu correctement.

---

### Option 3: Utiliser un script postinstall

Créer un script `postinstall.js` qui modifie `ExpoModulesCorePlugin.gradle` après `npm install`.

**Avantages**: Automatique, pas besoin de patch
**Inconvénients**: Modifie `node_modules` directement (peut être écrasé)

---

## 🎯 PLAN D'ACTION

1. ✅ Vérifier si `expo-modules-core` est installé
2. ⏳ Examiner `ExpoModulesCorePlugin.gradle` pour voir comment `kotlinVersion` est utilisé
3. ⏳ Créer un patch ou un script postinstall pour modifier l'accès à `kotlinVersion`
4. ⏳ Tester le build

---

**Statut**: En cours de résolution

