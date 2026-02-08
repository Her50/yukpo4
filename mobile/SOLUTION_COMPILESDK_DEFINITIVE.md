# ✅ Solution Définitive - compileSdkVersion pour expo-modules-core/android

## 🎯 Problème

Le build EAS échoue avec l'erreur :
```
Error resolving plugin [id: 'expo-module-gradle-plugin']
> A problem occurred configuring project ':android'.
   > compileSdkVersion is not specified. Please add it to build.gradle
```

Le projet `:android` (expo-modules-core/android) est inclus via `includeBuild` dans `settings.gradle`, mais son `build.gradle` n'a pas de `compileSdkVersion` défini au moment où Gradle essaie de résoudre le plugin `expo-module-gradle-plugin`.

## ✅ Solution Appliquée

### 1. **Patch expo-modules-core** (`mobile/patches/expo-modules-core+2.2.3.patch`)

Le patch modifie deux fichiers :

**a) `ExpoModulesCorePlugin.gradle`** : Utilise `findProperty()` pour lire `compileSdkVersion` depuis `gradle.properties`

**b) `build.gradle`** : Ajoute `compileSdkVersion findProperty("android.compileSdkVersion") ?: 35` dans le bloc `android {}`

### 2. **Script de correction** (`mobile/fix-expo-modules-core-compilesdk.js`)

Script Node.js qui force l'ajout de `compileSdkVersion` dans `expo-modules-core/android/build.gradle` si le patch n'a pas été appliqué.

**Exécution :**
- Dans `postinstall.js` (local et EAS Build)
- Dans `eas-build-post-install.sh` (EAS Build uniquement, en premier)

### 3. **Modification dans settings.gradle** (`mobile/android/settings.gradle`)

Le `settings.gradle` modifie le fichier `build.gradle` de `expo-modules-core/android` **AVANT** `includeBuild` :

```gradle
def buildGradleFile = new File(expoModulesAndroidPath, "build.gradle")
if (buildGradleFile.exists()) {
    def content = buildGradleFile.text
    if (!content.contains('compileSdkVersion') && !content.contains('compileSdk')) {
        // Ajouter compileSdkVersion
        def modified = content.replaceFirst(/(android\s*\{)/, 
            '$1\n  compileSdkVersion findProperty("android.compileSdkVersion") ?: 35')
        buildGradleFile.text = modified
    }
}
includeBuild(expoModulesAndroidPath.toString())
```

### 4. **gradle.properties** (`mobile/android/gradle.properties`)

Définit les propriétés Android SDK qui seront lues par `findProperty()` :

```properties
android.compileSdkVersion=35
android.targetSdkVersion=35
android.minSdkVersion=24
android.buildToolsVersion=35.0.0
```

## 🔄 Ordre d'Exécution

1. **`npm install`** → Déclenche `postinstall` dans `package.json`
2. **`patch-package`** → Applique le patch `expo-modules-core+2.2.3.patch`
3. **`postinstall.js`** → Exécute `fix-expo-modules-core-compilesdk.js` (vérification/backup)
4. **`eas-build-post-install.sh`** → Exécute `fix-expo-modules-core-compilesdk.js` (EAS Build uniquement)
5. **`expo prebuild`** → Génère les fichiers Android
6. **Gradle build** → `settings.gradle` vérifie/modifie `build.gradle` AVANT `includeBuild`
7. **Gradle build** → Lit `expo-modules-core/android/build.gradle` qui contient maintenant `compileSdkVersion`

## ✅ Vérification

Le build devrait maintenant réussir car :

1. ✅ Le patch ajoute `compileSdkVersion` dans `build.gradle`
2. ✅ Le script de correction force l'ajout si le patch n'est pas appliqué
3. ✅ `settings.gradle` modifie le fichier AVANT `includeBuild` comme backup
4. ✅ `gradle.properties` définit les propriétés nécessaires

## 🚀 Prochaines Étapes

1. Tester le build EAS : `eas build --platform android --profile preview`
2. Vérifier les logs pour confirmer que `compileSdkVersion` est présent
3. Si le problème persiste, vérifier que le patch est bien appliqué avec `npx patch-package --check`




