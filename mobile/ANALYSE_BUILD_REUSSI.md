# 🔍 Analyse : Comment le Build qui a Réussi Gérait compileSdkVersion

## ✅ La Clé du Succès

Le build qui a réussi fonctionnait parce que **le patch était déjà dans le dépôt** et était appliqué automatiquement par `patch-package` pendant `npm install`, **AVANT** que `expo prebuild` ne soit exécuté.

## 📋 Le Patch Contient DEUX Modifications Critiques

### 1. **Modification de `ExpoModulesCorePlugin.gradle`** (Lignes 9-16)

```gradle
// AVANT
compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)

// APRÈS (dans le patch)
def compileSdkProp = project.findProperty("android.compileSdkVersion") 
  ?: (project.rootProject ? project.rootProject.findProperty("android.compileSdkVersion") : null)
  ?: project.ext.safeExtGet("compileSdkVersion", 35)
def compileSdk = compileSdkProp instanceof String ? Integer.parseInt(compileSdkProp) : compileSdkProp
compileSdkVersion compileSdk
```

**Pourquoi ça fonctionne :**
- Utilise `findProperty("android.compileSdkVersion")` qui lit depuis `gradle.properties`
- Si la propriété n'existe pas, utilise la valeur par défaut `35`
- **Cette modification permet au projet `:android` (expo-modules-core) de lire `compileSdkVersion` depuis `gradle.properties`**

### 2. **Modification de `build.gradle`** (Ligne 43)

```gradle
android {
+  compileSdkVersion 35
  if (rootProject.hasProperty("ndkPath")) {
```

**Pourquoi ça fonctionne :**
- Ajoute directement `compileSdkVersion 35` dans le bloc `android {}`
- **Cette modification garantit que `compileSdkVersion` est toujours défini, même si `gradle.properties` n'est pas lu**

## 🔄 Ordre d'Exécution dans le Build qui a Réussi

1. **`npm install`** → Déclenche automatiquement `postinstall.js`
2. **`postinstall.js`** → Applique les patches avec `npx patch-package`
3. **Le patch est appliqué** → `expo-modules-core/android/build.gradle` contient maintenant `compileSdkVersion 35`
4. **`expo prebuild`** → Génère les fichiers Android (ne modifie PAS `node_modules/expo-modules-core`)
5. **Gradle build** → Lit `expo-modules-core/android/build.gradle` qui contient déjà `compileSdkVersion 35`

## ⚠️ Pourquoi le Build Actuel Échoue

Le problème est que **Gradle lit le fichier AVANT que le patch ne soit appliqué**, ou que le patch n'est pas appliqué correctement.

### Causes Possibles :

1. **Le patch n'est pas appliqué pendant `npm install`**
   - `patch-package` doit être exécuté automatiquement
   - Vérifier que `postinstall.js` s'exécute correctement

2. **`expo prebuild` écrase les modifications**
   - `expo prebuild` ne devrait PAS modifier `node_modules/expo-modules-core`
   - Mais si c'est le cas, le patch doit être réappliqué APRÈS `expo prebuild`

3. **Gradle lit le fichier depuis un cache**
   - Le cache Gradle peut contenir une version obsolète
   - Solution : Nettoyer le cache Gradle

4. **L'ordre d'exécution est incorrect**
   - Le patch doit être appliqué AVANT que Gradle ne lise le fichier
   - Les init scripts Gradle s'exécutent AVANT que les projets ne soient chargés

## ✅ Solution : S'assurer que le Patch est Appliqué Correctement

### Option 1 : Vérifier que `patch-package` s'exécute automatiquement

Le script `postinstall.js` doit appliquer les patches :

```javascript
execSync('npx patch-package', { stdio: 'inherit', cwd: __dirname });
```

### Option 2 : Utiliser un init script Gradle (Backup)

L'init script `force-compilesdk.gradle` modifie le fichier AVANT que Gradle ne le lise :

```gradle
// Modifie expo-modules-core/android/build.gradle AVANT que Gradle ne le lise
def buildGradleFile = new File(expoModulesAndroidPath, "build.gradle")
if (!content.contains('compileSdkVersion')) {
    // Ajouter compileSdkVersion 35
}
```

### Option 3 : Modifier `settings.gradle` (Backup)

Modifier `settings.gradle` pour forcer `compileSdkVersion` AVANT `includeBuild` :

```gradle
// Forcer compileSdkVersion AVANT includeBuild
def buildGradleFile = new File(expoModulesAndroidPath, "build.gradle")
// Modifier le fichier
includeBuild(expoModulesAndroidPath.toString())
```

## 🎯 Conclusion

Le build qui a réussi fonctionnait parce que :
1. ✅ Le patch était dans le dépôt
2. ✅ `patch-package` l'appliquait automatiquement pendant `npm install`
3. ✅ Le patch modifiait `ExpoModulesCorePlugin.gradle` pour utiliser `findProperty()`
4. ✅ Le patch ajoutait directement `compileSdkVersion 35` dans `build.gradle`
5. ✅ Le patch était appliqué AVANT que Gradle ne lise le fichier

**La solution actuelle :**
- ✅ Le patch est dans le dépôt (`patches/expo-modules-core+2.2.3.patch`)
- ✅ `postinstall.js` applique les patches avec `patch-package`
- ✅ `settings.gradle` force `compileSdkVersion` AVANT `includeBuild` (backup)
- ✅ Init script Gradle modifie le fichier AVANT que Gradle ne le lise (backup)

Le problème est probablement que le patch n'est pas appliqué correctement, ou que Gradle lit le fichier depuis un cache.


