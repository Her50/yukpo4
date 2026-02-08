# 🔧 Solution au problème réseau Gradle

## 🎯 Problème identifié

Le build local échoue avec des erreurs de connexion :
```
Could not HEAD 'https://plugins.gradle.org/m2/...'
plugins.gradle.org (timeout ou connexion refusée)
```

**Cause racine** : 
- `pluginManagement` dans `settings.gradle` n'avait **aucun repository configuré**
- Gradle utilisait par défaut `plugins.gradle.org` qui n'est pas accessible depuis votre réseau
- Timeouts réseau trop courts (10 secondes)

## ✅ Corrections appliquées

### 1. **Repositories dans `pluginManagement`** (`settings.gradle`)

Ajout de repositories pour les plugins Gradle :
```gradle
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal() // Repository par défaut pour les plugins
        maven { url 'https://repo1.maven.org/maven2' }
        maven { url 'https://maven.aliyun.com/repository/public' } // Mirror chinois (backup)
    }
}
```

### 2. **Repositories dans `dependencyResolutionManagement`** (`settings.gradle`)

Ajout de repositories pour les dépendances :
```gradle
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://www.jitpack.io' }
        maven { url 'https://repo1.maven.org/maven2' }
        maven { url 'https://maven.aliyun.com/repository/public' }
    }
}
```

### 3. **Repositories alternatifs dans `build.gradle`**

Ajout de mirrors dans `buildscript` et `allprojects` :
```gradle
repositories {
    google()
    mavenCentral()
    maven { url 'https://repo1.maven.org/maven2' }
    maven { url 'https://maven.aliyun.com/repository/public' }
}
```

### 4. **Timeouts réseau augmentés** (`gradle-wrapper.properties`)

```properties
networkTimeout=120000  # 2 minutes au lieu de 10 secondes
```

### 5. **Configuration réseau améliorée** (`gradle.properties`)

```properties
# Timeouts réseau (2 minutes)
systemProp.org.gradle.internal.http.connectionTimeout=120000
systemProp.org.gradle.internal.http.socketTimeout=120000
systemProp.http.connectionTimeout=120000
systemProp.http.socketTimeout=120000
systemProp.https.connectionTimeout=120000
systemProp.https.socketTimeout=120000

# Retries améliorés
systemProp.org.gradle.internal.repository.max.retries=5
systemProp.org.gradle.internal.repository.initial.backoff=2000
```

## 🚀 Utilisation

### Option 1 : Script automatisé (recommandé)

```powershell
cd mobile/android
.\build-with-network-fix.ps1
```

### Option 2 : Commandes manuelles

```powershell
cd mobile/android

# Nettoyer
.\gradlew.bat clean

# Builder
.\gradlew.bat assembleDebug
```

### Option 3 : EAS Build (si le problème réseau persiste)

```powershell
cd mobile
eas build --platform android --profile preview
```

## 🔍 Vérifications

### Tester la connectivité réseau

```powershell
# Tester Maven Central
Test-NetConnection -ComputerName repo1.maven.org -Port 443

# Tester Google Maven
Test-NetConnection -ComputerName maven.google.com -Port 443
```

### Vérifier les proxies

```powershell
$env:HTTP_PROXY
$env:HTTPS_PROXY
```

Si vous utilisez un proxy, configurez-le dans `gradle.properties` :
```properties
systemProp.http.proxyHost=proxy.example.com
systemProp.http.proxyPort=8080
systemProp.https.proxyHost=proxy.example.com
systemProp.https.proxyPort=8080
```

## 📋 Fichiers modifiés

1. ✅ `mobile/android/settings.gradle` - Repositories dans pluginManagement et dependencyResolutionManagement
2. ✅ `mobile/android/build.gradle` - Repositories alternatifs dans buildscript et allprojects
3. ✅ `mobile/android/gradle-wrapper.properties` - Timeout augmenté à 120s
4. ✅ `mobile/android/gradle.properties` - Configuration réseau complète

## 🆘 Si le problème persiste

### 1. Nettoyer complètement le cache Gradle

```powershell
cd mobile/android
.\gradlew.bat clean --refresh-dependencies
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches
```

### 2. Utiliser un VPN ou changer de réseau

Si votre réseau bloque certains domaines, essayez :
- Un VPN
- Un autre réseau (mobile hotspot, etc.)

### 3. Utiliser EAS Build (recommandé)

EAS Build se fait dans le cloud et n'a pas ces problèmes réseau :
```powershell
cd mobile
eas build --platform android --profile preview
```

## ✅ Avantages de cette solution

- ✅ **Repositories multiples** : Si un repository est inaccessible, Gradle essaie les autres
- ✅ **Timeouts augmentés** : Plus de temps pour les connexions lentes
- ✅ **Retries automatiques** : 5 tentatives avec backoff progressif
- ✅ **Mirrors de backup** : Aliyun Maven comme fallback
- ✅ **Compatible avec proxy** : Configuration proxy possible

## 📝 Notes importantes

1. **Premier build** : Le premier build peut prendre 10-15 minutes car Gradle télécharge toutes les dépendances
2. **Cache local** : Les builds suivants seront plus rapides grâce au cache local
3. **EAS Build** : Si vous avez des problèmes réseau récurrents, EAS Build est la meilleure solution



