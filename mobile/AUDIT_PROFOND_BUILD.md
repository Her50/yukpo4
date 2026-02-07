# 🔍 AUDIT PROFOND BUILD MOBILE - PROBLÈME DE FOND

**Date**: 2025-02-05  
**Problème**: Build échoue depuis 5 jours avec erreurs récurrentes  
**Contexte**: Build fonctionnait avant le 01 février 2026

---

## 🔴 ERREUR ACTUELLE

```
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > A problem occurred evaluating project ':android'.
      > Could not get unknown property 'kotlinVersion' for object of type org.gradle.api.internal.initialization.DefaultScriptHandler_Decorated.
```

**Fichier concerné**: `expo-modules-core/android/build.gradle`  
**Ligne**: Dans `applyKotlinExpoModulesCorePlugin()`

---

## 📋 ANALYSE DU PROBLÈME

### Structure de `expo-modules-core@2.0.6/android/build.gradle`

```gradle
def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()  // ← ERREUR ICI
```

**Le problème** : `applyKotlinExpoModulesCorePlugin()` essaie d'accéder à `kotlinVersion` qui n'est pas défini dans le contexte de `expo-modules-core/android/build.gradle`.

### Pourquoi `kotlinVersion` n'est pas défini ?

1. **`kotlinVersion` est défini dans `android/build.gradle`** (ligne 9) :
   ```gradle
   kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'
   ```

2. **Mais `expo-modules-core/android/build.gradle` est évalué AVANT** que `android/build.gradle` ne soit complètement évalué

3. **`ExpoModulesCorePlugin.gradle` définit probablement `kotlinVersion()`** mais dans un contexte où il n'est pas accessible

---

## 🎯 SOLUTION RADICALE

### Option 1: Définir `kotlinVersion` dans `gradle.properties` AVANT tout

**Fichier**: `mobile/android/gradle.properties`

Ajouter au début :
```properties
android.kotlinVersion=1.9.25
```

**Impact**: `kotlinVersion` sera disponible via `findProperty('android.kotlinVersion')` dès le début.

### Option 2: Créer un script postinstall pour modifier `expo-modules-core/android/build.gradle`

**Fichier**: `mobile/fix-expo-modules-core-kotlin-version-v2.js`

Définir `kotlinVersion` directement dans `expo-modules-core/android/build.gradle` AVANT `applyKotlinExpoModulesCorePlugin()`.

### Option 3: Revenir à `expo-modules-core@2.2.3` avec patch

**Raison**: La version `2.2.3` avait des patches qui fonctionnaient (même si complexes).

**Risque**: On revient au problème initial.

---

## 📊 COMPARAISON AVEC CONFIGURATION QUI FONCTIONNAIT

### Commit fonctionnel: `16afbdb20d556b52139f58d8981a1ac6a4b834ee`

**settings.gradle** :
- Pas d'`includeBuild` pour `expo-modules-core/android`
- Configuration minimale

**package.json** :
- `expo-modules-core` : Version non spécifiée (laissée à Expo SDK)

**Différences clés** :
1. Pas de PIN de `expo-modules-core`
2. Pas de `includeBuild` pour `expo-modules-core/android`
3. Configuration minimale

---

## 💡 HYPOTHÈSE

**Le vrai problème** : En ajoutant `includeBuild` pour `expo-modules-core/android`, on force Gradle à évaluer `expo-modules-core/android/build.gradle` AVANT que `kotlinVersion` ne soit défini dans le contexte global.

**Solution** : Définir `kotlinVersion` dans `gradle.properties` pour qu'il soit disponible dès le début, OU ne pas inclure `expo-modules-core/android` dans `pluginManagement` et laisser Expo gérer cela automatiquement.

---

## 🎯 PLAN D'ACTION

1. ✅ Vérifier `ExpoModulesCorePlugin.gradle` pour comprendre comment `kotlinVersion` est utilisé
2. ⏳ Définir `kotlinVersion` dans `gradle.properties` si nécessaire
3. ⏳ Tester si retirer `includeBuild` résout le problème
4. ⏳ Si non, créer un script postinstall pour définir `kotlinVersion` dans `expo-modules-core/android/build.gradle`

---

## 📋 PROCHAINES ÉTAPES

1. Analyser `ExpoModulesCorePlugin.gradle`
2. Appliquer la solution appropriée
3. Tester le build

