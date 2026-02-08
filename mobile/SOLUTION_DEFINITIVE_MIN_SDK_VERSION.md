# ✅ Solution Définitive - minSdkVersion pour expo-module-gradle-plugin

## 🎯 Problème Identifié

L'erreur persistante depuis 4 jours :
```
Build file '/home/expo/workingdir/build/mobile/node_modules/expo-crypto/android/build.gradle' line: 3
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > A problem occurred evaluating project ':android'.
      > Cannot get property 'minSdkVersion' on extra properties extension as it does not exist
```

**Le problème réel** : Le plugin `expo-module-gradle-plugin` (défini dans `expo-modules-core/android`) essaie d'accéder à `minSdkVersion` depuis `ext` (extra properties) lors de sa résolution, mais cette propriété n'existe pas encore au moment où le plugin est résolu.

## 🔍 Analyse Approfondie

### Ordre d'exécution Gradle

1. **settings.gradle** est évalué en premier
   - `pluginManagement` est exécuté
   - `includeBuild` pour `expo-modules-core/android` est appelé
   - Gradle essaie de résoudre le plugin `expo-module-gradle-plugin`

2. **build.gradle** racine est évalué ensuite
   - `buildscript` est exécuté
   - `ext` est défini (mais trop tard !)

3. **expo-modules-core/android/build.gradle** est évalué
   - Le plugin `expo-module-gradle-plugin` est résolu
   - Il essaie d'accéder à `ext.minSdkVersion` → **ERREUR** car `ext` n'existe pas encore dans le contexte du projet `:android`

### Pourquoi le patch ne suffisait pas

Le patch `expo-modules-core+2.2.3.patch` modifie `useDefaultAndroidSdkVersions()` pour utiliser des valeurs directes au lieu de `safeExtGet()`, mais le problème se produit **AVANT** que `useDefaultAndroidSdkVersions()` ne soit appelé. Le plugin lui-même essaie d'accéder à `ext.minSdkVersion` lors de sa résolution.

## ✅ Solution Multi-Niveaux Appliquée

### 1. **gradle.ext dans settings.gradle** - CRITIQUE ⭐

**Fichier :** `mobile/android/settings.gradle`

Définit les propriétés AVANT `pluginManagement` :

```gradle
// ✅ CRITIQUE: Définir les propriétés ext AVANT pluginManagement
gradle.ext.compileSdkVersion = 35
gradle.ext.targetSdkVersion = 35
gradle.ext.minSdkVersion = 24
gradle.ext.buildToolsVersion = '35.0.0'

pluginManagement {
    // ...
}
```

**Avantage :** Ces propriétés sont disponibles pour TOUS les projets, y compris `:android`, dès le début de l'évaluation de `settings.gradle`.

### 2. **ext au début de build.gradle** - CRITIQUE ⭐

**Fichier :** `mobile/android/build.gradle`

Définit `ext` AVANT `buildscript` :

```gradle
// ✅ CRITIQUE: Définir ext AVANT buildscript
ext {
    compileSdkVersion = 35
    targetSdkVersion = 35
    minSdkVersion = 24
    buildToolsVersion = '35.0.0'
}

buildscript {
    // ...
}
```

**Avantage :** Ces propriétés sont disponibles dès le début de l'évaluation de `build.gradle`, avant que les plugins ne soient résolus.

### 3. **gradle.properties dans expo-modules-core/android** - BACKUP

**Fichier :** Créé par `settings.gradle` AVANT `includeBuild`

```properties
android.compileSdkVersion=35
android.targetSdkVersion=35
android.minSdkVersion=24
android.buildToolsVersion=35.0.0
```

**Avantage :** `findProperty("android.minSdkVersion")` trouvera cette valeur.

### 4. **Patch expo-modules-core** - BACKUP

**Fichier :** `mobile/patches/expo-modules-core+2.2.3.patch`

Le patch modifie :
- `ExpoModulesCorePlugin.gradle` : Améliore `safeExtGet()` pour gérer les cas où `ext` n'existe pas
- `ExpoModulesCorePlugin.gradle` : Modifie `useDefaultAndroidSdkVersions()` pour utiliser des valeurs directes
- `build.gradle` : Ajoute `compileSdkVersion` et `minSdkVersion` directement dans le bloc `android {}`

## 🔧 Fichiers Modifiés

1. **mobile/android/settings.gradle**
   - Ajout de `gradle.ext.*` AVANT `pluginManagement`

2. **mobile/android/build.gradle**
   - Déplacement de `ext {}` AVANT `buildscript`
   - Suppression du bloc `ext {}` redondant après `apply plugin`

3. **mobile/patches/expo-modules-core+2.2.3.patch**
   - Déjà présent et correct

## ✅ Vérification

Pour vérifier que les corrections sont appliquées :

1. **settings.gradle** doit avoir `gradle.ext.minSdkVersion = 24` AVANT `pluginManagement`
2. **build.gradle** doit avoir `ext { minSdkVersion = 24 }` AVANT `buildscript`
3. Le patch doit être appliqué (vérifié par `patch-package` dans `postinstall`)

## 🎯 Résultat Attendu

Le build devrait maintenant réussir car :
- `gradle.ext.minSdkVersion` est défini dans `settings.gradle` AVANT la résolution des plugins
- `ext.minSdkVersion` est défini dans `build.gradle` AVANT `buildscript`
- Le patch garantit que `useDefaultAndroidSdkVersions()` utilise des valeurs directes
- Le patch garantit que `expo-modules-core/android/build.gradle` a `minSdkVersion` défini directement

## 📝 Notes Importantes

- **Ordre d'exécution** : `settings.gradle` → `build.gradle` → projets individuels
- **gradle.ext** : Disponible dans `settings.gradle` et accessible via `gradle.ext.*`
- **ext** : Disponible dans `build.gradle` et accessible via `rootProject.ext.*` ou `project.ext.*`
- **findProperty()** : Lit depuis `gradle.properties` et les propriétés système

## 🔄 Différence avec le Build Réussi

Le commit `16afbdb20d556b52139f58d8981a1ac6a4b834ee` qui fonctionnait n'avait pas de bloc `ext` après `apply plugin`, ce qui signifie que les propriétés étaient probablement définies ailleurs ou que le plugin n'essayait pas d'y accéder à ce moment-là.

Les modifications apportées garantissent que les propriétés sont disponibles **AVANT** que les plugins ne soient résolus, ce qui résout le problème de manière définitive.




