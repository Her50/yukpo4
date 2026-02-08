# 📋 Ordre d'Exécution EAS Build et Nettoyage des Caches

## 🔄 Ordre d'Exécution dans le Build qui a Réussi

D'après les logs du build qui a fonctionné, voici l'ordre d'exécution exact :

### 1. **Initialisation de l'environnement EAS Build**
```
- Création du worker instance
- Installation des outils (Node.js, Java, Android SDK, etc.)
- Configuration des variables d'environnement
```

### 2. **Installation des dépendances**
```bash
npm install
```
- Télécharge et installe tous les packages depuis `package.json`
- **IMPORTANT** : Déclenche automatiquement le script `postinstall` après l'installation

### 3. **Script postinstall.js** (CRITIQUE)
```bash
node postinstall.js
```
**Ordre d'exécution dans postinstall.js :**
1. Fix @expo/cli module manquant
2. Fix react-native-worklets-core plugin.js
3. Fix metro-cache-key default export
4. Fix react-native-reanimated worklets
5. Fix Metro exports (CRITIQUE)
6. Création des liens symboliques Metro
7. Création de `gradle.properties` dans `expo-modules-core/android`
8. **Modification directe de `expo-modules-core/android/build.gradle`** pour ajouter `compileSdkVersion 35`
9. **Application des patches avec `patch-package`** (inclut le patch `expo-modules-core+2.2.3.patch`)

### 4. **Script eas-build-post-install.sh** (si configuré)
```bash
./eas-build-post-install.sh
```
**Ordre d'exécution :**
1. Fix react-native-worklets-core plugin.js
2. Fix Metro exports
3. Création de `gradle.properties` dans `expo-modules-core/android`
4. **Modification de `expo-modules-core/android/build.gradle`** pour ajouter `compileSdkVersion`
5. Fix Kotlin plugin dans expo-modules-core
6. **Application des patches avec `patch-package`**

### 5. **Expo Prebuild**
```bash
npx expo prebuild --platform android
```
- Génère les dossiers `android/` et `ios/` natifs
- Applique les config plugins Expo
- Configure les fichiers Gradle natifs

### 6. **Build Gradle**
```bash
./gradlew :app:assembleRelease
```
- Gradle lit les fichiers `build.gradle`
- **À ce moment, `compileSdkVersion` doit déjà être présent dans `expo-modules-core/android/build.gradle`**
- Compilation de l'application Android

---

## 🧹 Comment Nettoyer les Caches

### ⚠️ Pourquoi Nettoyer les Caches ?

Les caches peuvent contenir des versions obsolètes de fichiers, ce qui peut causer :
- Erreurs "compileSdkVersion is not specified"
- Problèmes de résolution de dépendances
- Builds qui échouent sans raison apparente

---

## 🎯 Nettoyage Complet (Recommandé)

### Option 1 : Script Automatique (Windows PowerShell)

```powershell
cd mobile

# Script de nettoyage complet
.\fix-gradle-build.ps1
```

### Option 2 : Nettoyage Manuel Étape par Étape

#### 1. **Nettoyer le Cache Gradle** (CRITIQUE)

**Windows :**
```powershell
# Arrêter tous les daemons Gradle
cd mobile\android
.\gradlew.bat --stop
cd ..

# Supprimer le cache Gradle
Remove-Item -Path "$env:USERPROFILE\.gradle\caches" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.gradle\daemon" -Recurse -Force -ErrorAction SilentlyContinue
```

**Linux/Mac :**
```bash
cd mobile/android
./gradlew --stop
cd ..

# Supprimer le cache Gradle
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon
```

#### 2. **Nettoyer les Builds Android Locaux**

**Windows :**
```powershell
cd mobile
Remove-Item -Path "android\.gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "android\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "android\app\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "android\app\.cxx" -Recurse -Force -ErrorAction SilentlyContinue
```

**Linux/Mac :**
```bash
cd mobile
rm -rf android/.gradle
rm -rf android/build
rm -rf android/app/build
rm -rf android/app/.cxx
```

#### 3. **Nettoyer le Cache npm**

**Windows :**
```powershell
cd mobile
npm cache clean --force
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
```

**Linux/Mac :**
```bash
cd mobile
npm cache clean --force
rm -rf node_modules
rm -f package-lock.json
```

#### 4. **Nettoyer le Cache Expo**

**Windows :**
```powershell
cd mobile
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
```

**Linux/Mac :**
```bash
cd mobile
rm -rf node_modules/.cache
rm -rf .expo
```

#### 5. **Nettoyer le Cache Metro**

**Windows :**
```powershell
Remove-Item -Path "$env:LOCALAPPDATA\Temp\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Temp\haste-map-*" -Recurse -Force -ErrorAction SilentlyContinue
```

**Linux/Mac :**
```bash
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*
```

#### 6. **Nettoyer le Cache EAS Build** (sur les serveurs Expo)

Le cache EAS Build est géré automatiquement par Expo. Pour forcer un build sans cache :

```bash
cd mobile
npx eas build --platform android --profile preview --clear-cache
```

---

## 🔄 Réinstallation Propre Après Nettoyage

Après avoir nettoyé tous les caches :

```bash
cd mobile

# Réinstaller les dépendances
npm install

# Vérifier que les patches sont appliqués
npx patch-package

# Vérifier que compileSdkVersion est présent
# (Windows PowerShell)
Select-String -Path "node_modules\expo-modules-core\android\build.gradle" -Pattern "compileSdkVersion"

# (Linux/Mac)
grep -n "compileSdkVersion" node_modules/expo-modules-core/android/build.gradle
```

---

## 🎯 Nettoyage Rapide (Avant Chaque Build)

Si vous voulez juste nettoyer rapidement avant un build :

```powershell
cd mobile\android
.\gradlew.bat clean
.\gradlew.bat --stop
cd ..
```

---

## 📋 Checklist de Nettoyage Complet

Avant de lancer un build EAS après des modifications importantes :

- [ ] Arrêter tous les daemons Gradle (`gradlew --stop`)
- [ ] Supprimer le cache Gradle (`~/.gradle/caches`)
- [ ] Supprimer les builds Android locaux (`android/.gradle`, `android/build`)
- [ ] Nettoyer le cache npm (`npm cache clean --force`)
- [ ] Supprimer `node_modules` et réinstaller
- [ ] Vérifier que les patches sont appliqués (`npx patch-package`)
- [ ] Vérifier que `compileSdkVersion` est présent dans `expo-modules-core/android/build.gradle`
- [ ] Lancer le build avec `--clear-cache` si nécessaire

---

## 🚀 Commandes Rapides

### Nettoyage Complet (Windows)
```powershell
cd mobile
.\fix-gradle-build.ps1
npm install
npx patch-package
```

### Nettoyage Complet (Linux/Mac)
```bash
cd mobile
./fix-gradle-build.sh  # Si le script existe
npm install
npx patch-package
```

### Build EAS avec Cache Nettoyé
```bash
cd mobile
npx eas build --platform android --profile preview --clear-cache
```

---

## ⚠️ Notes Importantes

1. **Le cache Gradle est le plus critique** - Il peut contenir des versions obsolètes de `build.gradle`
2. **Les patches doivent être réappliqués** après chaque `npm install`
3. **Le cache EAS Build** est géré par Expo - Utilisez `--clear-cache` pour forcer un build propre
4. **Ne supprimez pas `patches/`** - Ce dossier contient les patches nécessaires

---

## 🔍 Vérification Après Nettoyage

Vérifiez que tout est correct :

```bash
cd mobile

# 1. Vérifier que compileSdkVersion est présent
grep -n "compileSdkVersion" node_modules/expo-modules-core/android/build.gradle

# 2. Vérifier que les patches sont appliqués
npx patch-package --check

# 3. Vérifier que Gradle peut lire le fichier
cd android
./gradlew tasks --dry-run
```

---

## 📚 Références

- [Gradle Cache Documentation](https://docs.gradle.org/current/userguide/build_cache.html)
- [EAS Build Cache](https://docs.expo.dev/build/building-on-ci/#cache)
- [patch-package Documentation](https://github.com/ds300/patch-package)




