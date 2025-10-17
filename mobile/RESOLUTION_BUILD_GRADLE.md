# Résolution du problème de build Gradle

## Problème initial

Le build EAS échouait avec l'erreur:
```
Could not compile build file '/home/expo/workingdir/build/mobile/node_modules/expo/android/build.gradle'.
> unable to resolve class expo.modules.plugin.gradle.ExpoModuleExtension
```

## Causes identifiées

1. **Incompatibilité de version Kotlin** : Conflit entre `gradle.properties` et `build.gradle`
2. **Plugin Expo Gradle non résolu** : Configuration de `settings.gradle` inadaptée pour Windows
3. **Versions SDK incohérentes** : Tentative d'utiliser SDK 35 avec Expo 53

## Solutions appliquées

### 1. Alignement des versions Kotlin (2.0.0)

**Fichier: `android/gradle.properties`**
```properties
android.kotlinVersion=2.0.0
```

**Fichier: `android/build.gradle`**
```gradle
buildscript {
    ext {
        kotlinVersion = findProperty('android.kotlinVersion') ?: '2.0.0'
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.3.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
        classpath("com.google.devtools.ksp:symbol-processing-gradle-plugin:2.0.0-1.0.24")
    }
}
```

### 2. Correction de `settings.gradle`

Ajout de gestion d'erreurs robuste et support multi-plateforme (Windows/Linux):
```gradle
pluginManagement {
  def command
  if (System.properties['os.name'].toLowerCase().contains('windows')) {
    command = "cmd /c node --print require.resolve('expo-modules-autolinking/package.json')"
  } else {
    command = "node --print require.resolve('expo-modules-autolinking/package.json')"
  }
  
  try {
    def expoAutolinkingPath = command.execute(null, rootDir).text.trim()
    def expoModulesAutolinking = new File(expoAutolinkingPath).parentFile.toString() + "/android/expo-gradle-plugin"
    if (new File(expoModulesAutolinking).exists()) {
      includeBuild(expoModulesAutolinking)
    }
  } catch (Exception e) {
    println("ERROR: Failed to resolve expo-modules-autolinking: ${e.message}")
  }
}
```

### 3. Versions SDK cohérentes

**Fichier: `android/gradle.properties`**
```properties
android.minSdkVersion=23
android.compileSdkVersion=34
android.targetSdkVersion=34
android.buildToolsVersion=34.0.0
android.ndkVersion=26.1.10909125
```

**Fichier: `android/build.gradle`**
```gradle
buildscript {
    ext {
        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '34.0.0'
        minSdkVersion = (findProperty('android.minSdkVersion') ?: '23').toInteger()
        compileSdkVersion = (findProperty('android.compileSdkVersion') ?: '34').toInteger()
        targetSdkVersion = (findProperty('android.targetSdkVersion') ?: '34').toInteger()
        ndkVersion = "26.1.10909125"
    }
}
```

## Configuration finale

- **Kotlin**: 2.0.0
- **Android Gradle Plugin**: 8.3.0
- **Gradle**: 8.3
- **compileSdk**: 34
- **targetSdk**: 34
- **minSdk**: 23
- **NDK**: 26.1.10909125
- **KSP**: 2.0.0-1.0.24

## Scripts créés

### 1. `fix-gradle-kotlin2.ps1`
Script complet de nettoyage et réinstallation:
- Nettoie les caches Gradle
- Supprime les builds Android
- Nettoie les caches Expo/Metro
- Réinstalle les dépendances npm
- Vérifie la présence du plugin Expo Gradle

### 2. `setup-java.ps1`
Script de configuration Java (pour builds locaux uniquement):
- Détecte automatiquement les installations JDK
- Configure JAVA_HOME temporairement
- Guide pour configuration permanente

## Tester le build

### Build EAS (recommandé)
```bash
# Depuis le dossier mobile
npx eas-cli build --platform android --profile preview-debug
```

### Build local (nécessite Android Studio/JDK)
```bash
# 1. Configurer Java
powershell -ExecutionPolicy Bypass -File setup-java.ps1

# 2. Build
cd android
.\gradlew.bat assembleDebug
```

### Build avec Expo CLI
```bash
npx expo run:android
```

## Notes importantes

1. **Pour EAS**: Les corrections de configuration permettent maintenant le build cloud
2. **Pour build local**: Java/JDK 17 est requis (Android Studio recommandé)
3. **KSP**: Nécessaire pour Kotlin 2.0.0 avec les modules Expo
4. **Postinstall**: Le script `postinstall.js` applique automatiquement les patches nécessaires

## Vérification

Après avoir exécuté `fix-gradle-kotlin2.ps1`, vérifiez que:
- ✅ Plugin Expo Gradle présent: `node_modules\expo-modules-autolinking\android\expo-gradle-plugin`
- ✅ Kotlin aligné à 2.0.0 dans tous les fichiers
- ✅ Versions SDK cohérentes (34)
- ✅ Dépendances npm installées sans erreurs

## Prochaines étapes

1. **Commit les modifications**:
   ```bash
   git add android/build.gradle android/settings.gradle android/gradle.properties
   git commit -m "fix: Correction configuration Gradle pour Kotlin 2.0.0"
   ```

2. **Tester avec EAS**:
   ```bash
   npx eas-cli build --platform android --profile preview-debug
   ```

3. **Si succès**: Le build devrait se terminer sans l'erreur `ExpoModuleExtension not found`

## Support

Si le problème persiste:
1. Vérifier les logs EAS complets
2. S'assurer que `eas.json` est correctement configuré
3. Vérifier que toutes les dépendances sont à jour avec `npm update`

