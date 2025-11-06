# Installation manuelle de Gradle 8.8

## Étapes d'installation

### 1. Extraction du fichier ZIP
1. Localisez le fichier `gradle-8.8-all.zip` (ou `gradle-8.8-bin.zip`) dans vos téléchargements
2. Créez un dossier pour Gradle :
   ```
   C:\Gradle
   ```
3. Extrayez le contenu du ZIP dans ce dossier
4. Vous devriez avoir : `C:\Gradle\gradle-8.8\`

### 2. Configuration des variables d'environnement

#### Option A : Via PowerShell (Administrateur)
Ouvrez PowerShell en tant qu'administrateur et exécutez :

```powershell
# Définir GRADLE_HOME
[System.Environment]::SetEnvironmentVariable('GRADLE_HOME', 'C:\Gradle\gradle-8.8', 'Machine')

# Ajouter Gradle au PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$newPath = "$currentPath;C:\Gradle\gradle-8.8\bin"
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')

Write-Host "✅ Gradle configuré avec succès!" -ForegroundColor Green
```

#### Option B : Via l'interface Windows
1. **Ouvrir les variables d'environnement** :
   - Clic droit sur "Ce PC" → Propriétés
   - Paramètres système avancés
   - Variables d'environnement

2. **Créer GRADLE_HOME** :
   - Dans "Variables système", cliquez sur "Nouvelle"
   - Nom : `GRADLE_HOME`
   - Valeur : `C:\Gradle\gradle-8.8`
   - OK

3. **Ajouter au PATH** :
   - Dans "Variables système", trouvez `Path`
   - Cliquez sur "Modifier"
   - Cliquez sur "Nouveau"
   - Ajoutez : `%GRADLE_HOME%\bin`
   - OK sur toutes les fenêtres

### 3. Vérification de l'installation

Ouvrez un **NOUVEAU** terminal PowerShell et exécutez :

```powershell
gradle --version
```

Vous devriez voir :

```
------------------------------------------------------------
Gradle 8.8
------------------------------------------------------------

Build time:   2024-05-31 21:46:56 UTC
Revision:     4bd1b3d3fc3f31db5a26eecb416a165b8cc36082

Kotlin:       1.9.22
Groovy:       3.0.21
Ant:          Apache Ant(TM) version 1.10.13 compiled on January 4 2023
JVM:          17.0.x (Oracle Corporation 17.0.x+x-LTS)
OS:           Windows 10 10.0 amd64
```

### 4. Configuration pour React Native

Après l'installation, vérifiez que Gradle est accessible depuis le projet mobile :

```powershell
cd mobile
gradle --version
```

### 5. Mise à jour du wrapper Gradle (optionnel)

Si vous voulez que votre projet utilise cette version de Gradle :

```powershell
cd mobile/android
gradle wrapper --gradle-version 8.8
```

Cela mettra à jour `gradle/wrapper/gradle-wrapper.properties`.

## Dépannage

### ❌ "gradle n'est pas reconnu"
- **Cause** : Le PATH n'est pas configuré ou le terminal n'a pas été redémarré
- **Solution** : 
  1. Fermez TOUS les terminaux ouverts
  2. Rouvrez un nouveau PowerShell
  3. Vérifiez avec `$env:Path` que Gradle est dans le PATH

### ❌ Version incorrecte affichée
- **Cause** : Une ancienne version de Gradle existe déjà dans le PATH
- **Solution** :
  1. Vérifiez `where.exe gradle` pour voir quelle version est trouvée
  2. Assurez-vous que `C:\Gradle\gradle-8.8\bin` est AVANT les autres entrées dans le PATH

### ❌ Erreur JVM non trouvé
- **Cause** : Java n'est pas installé ou pas dans le PATH
- **Solution** : Installez Java JDK 17 et configurez JAVA_HOME

## Script PowerShell automatique

Si vous préférez, voici un script qui fait tout automatiquement :

```powershell
# Chemin du fichier ZIP téléchargé
$zipPath = "$env:USERPROFILE\Downloads\gradle-8.8-all.zip"

# Vérifier que le fichier existe
if (-not (Test-Path $zipPath)) {
    Write-Host "❌ Fichier non trouvé : $zipPath" -ForegroundColor Red
    exit 1
}

# Créer le dossier d'installation
$installDir = "C:\Gradle"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "📦 Extraction de Gradle..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force

# Configuration des variables d'environnement
$gradleHome = "C:\Gradle\gradle-8.8"
[System.Environment]::SetEnvironmentVariable('GRADLE_HOME', $gradleHome, 'Machine')

$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($currentPath -notlike "*$gradleHome\bin*") {
    $newPath = "$currentPath;$gradleHome\bin"
    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
}

Write-Host "✅ Gradle 8.8 installé avec succès!" -ForegroundColor Green
Write-Host "⚠️  Redémarrez votre terminal pour utiliser Gradle" -ForegroundColor Yellow
```

Enregistrez ce script sous `install-gradle.ps1` et exécutez-le en tant qu'administrateur.

## Prochaines étapes

Après avoir installé Gradle, vous pouvez :
1. Vérifier les autres prérequis Android (Android SDK, Java JDK)
2. Compiler votre application : `cd mobile/android && ./gradlew assembleRelease`
3. Suivre le guide : `GUIDE_BUILD_ANDROID_LOCAL.md`

## Liens utiles

- [Documentation officielle Gradle](https://docs.gradle.org/8.8/userguide/installation.html)
- [Gradle Releases](https://gradle.org/releases/)
- [Troubleshooting Gradle](https://docs.gradle.org/current/userguide/troubleshooting.html)

