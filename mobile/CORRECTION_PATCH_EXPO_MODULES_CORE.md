# ✅ Correction du Patch expo-modules-core - minSdkVersion

## 🎯 Problème

Le patch `expo-modules-core+2.2.3.patch` modifiait `useDefaultAndroidSdkVersions()` pour utiliser des valeurs directes, mais le problème se produisait **AVANT** cet appel. Le plugin `expo-module-gradle-plugin` accédait à `ext.minSdkVersion` lors de sa résolution, mais cette propriété n'existait pas encore.

## ✅ Solution Appliquée

### Modification du Patch

Le patch a été amélioré pour définir `ext.minSdkVersion` **directement dans `build.gradle` d'`expo-modules-core/android`** AVANT tout accès possible :

```gradle
apply plugin: 'com.android.library'

// ✅ CRITIQUE: Définir ext.minSdkVersion AVANT tout accès possible
ext {
  minSdkVersion = 24
  compileSdkVersion = 35
  targetSdkVersion = 35
  buildToolsVersion = '35.0.0'
}

// ✅ CRITIQUE: Définir compileSdkVersion IMMÉDIATEMENT après l'application du plugin
android {
  compileSdkVersion 35
}
```

### Pourquoi Cette Solution Fonctionne

1. **Ordre d'exécution** : `ext { minSdkVersion = 24 }` est défini IMMÉDIATEMENT après `apply plugin: 'com.android.library'`, AVANT tout autre code
2. **Disponibilité** : `ext.minSdkVersion` est maintenant disponible dès le début de l'évaluation de `build.gradle`
3. **Résolution du plugin** : Lorsque Gradle résout le plugin `expo-module-gradle-plugin`, `ext.minSdkVersion` existe déjà

## 🔧 Fichier Modifié

- `mobile/patches/expo-modules-core+2.2.3.patch` : Ajout de `ext { minSdkVersion = 24 }` au début de `build.gradle`

## ✅ Vérification

Pour vérifier que le patch est correct :
1. Le patch doit contenir `ext { minSdkVersion = 24 }` au début de `build.gradle`
2. Le patch doit être appliqué via `patch-package` dans `postinstall`
3. Le build devrait maintenant réussir car `ext.minSdkVersion` existe lors de la résolution du plugin

## 🎯 Résultat Attendu

Le build devrait maintenant réussir car :
- `ext.minSdkVersion` est défini dans `expo-modules-core/android/build.gradle` AVANT tout accès
- `useDefaultAndroidSdkVersions()` utilise des valeurs directes (déjà dans le patch)
- `compileSdkVersion` et `minSdkVersion` sont définis directement dans le bloc `android {}` (déjà dans le patch)


