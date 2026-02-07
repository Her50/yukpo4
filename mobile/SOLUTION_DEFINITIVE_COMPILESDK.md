# ✅ Solution Définitive - compileSdkVersion pour expo-modules-core/android

## 🎯 Le Vrai Problème

L'erreur dit :
```
Build file '/home/expo/workingdir/build/mobile/node_modules/expo-crypto/android/build.gradle' line: 3
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > compileSdkVersion is not specified. Please add it to build.gradle
```

**Le problème réel** : Quand Gradle essaie de résoudre le plugin `expo-module-gradle-plugin` (défini dans `expo-modules-core/android`), il doit configurer le projet `:android` AVANT que le bloc `android {}` ne soit évalué. Même si `compileSdkVersion` est défini dans le bloc `android {}`, Gradle a besoin qu'il soit configuré AVANT.

## ✅ Solution Définitive

### Configuration de `compileSdkVersion` AVANT `useDefaultAndroidSdkVersions()`

Le fichier `expo-modules-core/android/build.gradle` appelle `useDefaultAndroidSdkVersions()` à la ligne 30, AVANT le bloc `android {}` (ligne 77). La solution est de configurer `project.android.compileSdkVersion` **AVANT** cet appel.

**Modification dans `build.gradle`** :
```gradle
if (KOTLIN_MAJOR_VERSION >= 2) {
  apply plugin: 'org.jetbrains.kotlin.plugin.compose'
}

// ✅ CRITIQUE: Configuration de compileSdkVersion AVANT useDefaultAndroidSdkVersions()
// Cette configuration est nécessaire pour que Gradle reconnaisse compileSdkVersion lors de la résolution du plugin
project.android {
  compileSdkVersion findProperty("android.compileSdkVersion") ?: 35
}
useDefaultAndroidSdkVersions()
useExpoPublishing()
```

**ET dans le bloc `android {}`** (pour cohérence) :
```gradle
android {
  compileSdkVersion findProperty("android.compileSdkVersion") ?: 35
  // ... reste du bloc
}
```

## 🔧 Implémentation

### 1. **Patch** (`mobile/patches/expo-modules-core+2.2.3.patch`)
Le patch modifie `build.gradle` pour ajouter la configuration AVANT `useDefaultAndroidSdkVersions()`.

### 2. **Script Radical** (`mobile/fix-expo-modules-core-build-gradle-radical.js`)
Script Node.js qui force cette configuration si le patch n'a pas été appliqué.

**Exécution** :
- Dans `postinstall.js` (local et EAS Build)
- Dans `eas-build-post-install.sh` (EAS Build uniquement, en premier)

### 3. **Autres Mécanismes de Backup**
- `settings.gradle` : Crée `gradle.properties` et modifie `build.gradle` AVANT `includeBuild`
- `withExpoModulesCoreCompileSdkFix.js` : Plugin Expo qui modifie `build.gradle` pendant `expo prebuild`
- `gradle/init.d/force-compilesdk-before-plugin-resolution.gradle` : Script Gradle init qui force `compileSdkVersion` très tôt

## 🚀 Pourquoi Cette Solution Fonctionne

1. **Configuration précoce** : `project.android.compileSdkVersion` est configuré AVANT que Gradle ne résolve le plugin
2. **Disponibilité immédiate** : La valeur est disponible dès que le plugin Android est appliqué (ligne 3)
3. **Cohérence** : La même valeur est aussi définie dans le bloc `android {}` pour la cohérence

## 📝 Notes

- Cette solution est **définitive** car elle configure `compileSdkVersion` au bon moment dans le cycle de vie Gradle
- Toutes les autres solutions (patches, scripts, plugins) sont des backups au cas où cette configuration principale échouerait
- La valeur par défaut est `35`, mais peut être surchargée via `gradle.properties` avec `android.compileSdkVersion=XX`


