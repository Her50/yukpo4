# 🚀 Comment compiler votre APK Yukpomnang

## ✅ ENVIRONNEMENT PRÊT !

Tout est installé et configuré :
- ✅ Java JDK 21
- ✅ Node.js v22  
- ✅ Android SDK (Platform 34, Build-Tools, NDK, etc.)
- ✅ Variables d'environnement configurées
- ✅ Dossier Android généré avec Expo SDK 52

---

## 🎯 MÉTHODE LA PLUS SIMPLE

### Ouvrez PowerShell et tapez :

```powershell
cd C:\Users\23767\yukpomnang2\mobile
.\BUILD-APK.bat
```

**C'EST TOUT !** Le script va :
1. Nettoyer les processus Gradle
2. Supprimer les fichiers de lock
3. Compiler l'APK
4. Vous indiquer où se trouve l'APK généré

**Temps**: 10-15 minutes (première fois)

---

## 📱 RÉSULTAT

L'APK sera ici :
```
C:\Users\23767\yukpomnang2\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Vous pourrez ensuite :
- L'installer sur votre téléphone Android
- Le partager avec votre équipe
- Le tester sur un émulateur

---

## 🔧 MÉTHODE MANUELLE (si le script batch ne marche pas)

```powershell
# 1. Aller dans le dossier Android
cd C:\Users\23767\yukpomnang2\mobile\android

# 2. Arrêter Gradle
.\gradlew --stop

# 3. Supprimer les locks
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue

# 4. Compiler
.\gradlew assembleDebug --no-daemon
```

---

## 📊 CE QUE VOUS VERREZ PENDANT LA COMPILATION

```
> Configure project
> Task :app:preBuild
> Task :app:preDebugBuild  
> Task :react-native-gradle-plugin:compileKotlin
> Task :app:generateDebugResources
> Task :app:mergeDebugResources
> Task :app:processDebugManifest
> Task :app:compileDebugJavaWithJavac
> Task :app:compileDebugKotlin
> Task :app:dexBuilderDebug
> Task :app:mergeDebugNativeLibs
> Task :app:packageDebug

BUILD SUCCESSFUL in 12m 34s
```

---

## ⚠️ SI VOUS VOYEZ UNE ERREUR

### Erreur de connexion réseau
```
Could not GET 'https://repo.maven.apache.org/...'
```
**Solution** : Vérifiez votre connexion Internet et réessayez

### Erreur de lock Gradle
```
Timeout waiting to lock build logic queue
```
**Solution** :  
```powershell
# Tuer tous les processus Java
Get-Process | Where-Object {$_.ProcessName -like "*java*"} | Stop-Process -Force

# Relancer
cd C:\Users\23767\yukpomnang2\mobile
.\BUILD-APK.bat
```

### Erreur "Out of memory"
```
OutOfMemoryError: Java heap space
```
**Solution** : Éditez `mobile\android\gradle.properties` et ajoutez :
```properties
org.gradle.jvmargs=-Xmx4096m
```

---

## 🎊 APRÈS LA COMPILATION RÉUSSIE

### Installer sur votre téléphone :

1. Connectez votre téléphone Android en USB
2. Activez le "Débogage USB" dans les options développeur
3. Dans PowerShell :
```powershell
cd C:\Users\23767\yukpomnang2\mobile\android
adb install app\build\outputs\apk\debug\app-debug.apk
```

### Tester sur émulateur :

1. Lancez un émulateur Android depuis Android Studio
2. Dans PowerShell :
```powershell
cd C:\Users\23767\yukpomnang2\mobile\android  
adb install app\build\outputs\apk\debug\app-debug.apk
```

---

## 💡 PROCHAINES COMPILATIONS

Les prochaines fois, ce sera **BEAUCOUP PLUS RAPIDE** (5-10 min au lieu de 15) car :
- Gradle aura téléchargé toutes les dépendances
- Le cache sera rempli
- Seul votre code sera recompilé

---

## 🚀 COMPILATIONS SUIVANTES

Utilisez simplement :
```powershell
cd C:\Users\23767\yukpomnang2\mobile
.\BUILD-APK.bat
```

**OU** directement dans Android :
```powershell
cd C:\Users\23767\yukpomnang2\mobile\android
.\gradlew assembleDebug
```

---

## 📝 SCRIPTS DISPONIBLES

- `BUILD-APK.bat` - Script principal de compilation
- `watch-build.ps1` - Surveiller la progression du build
- `check-build-progress.ps1` - Vérifier l'état du build

---

## 🎯 RÉCAPITULATIF

**POUR COMPILER MAINTENANT** :

```powershell
cd C:\Users\23767\yukpomnang2\mobile
.\BUILD-APK.bat
```

Attendez 10-15 minutes et votre APK sera prêt ! 🎉

---

*Environnement configuré le : 5 novembre 2025*  
*Prêt pour la compilation Android* ✅

