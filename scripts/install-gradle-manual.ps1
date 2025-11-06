# Script d'installation manuelle de Gradle 8.8
# Executer en tant qu'administrateur

param(
    [string]$ZipPath = "$env:USERPROFILE\Downloads\gradle-8.8-all.zip",
    [string]$InstallDir = "C:\Gradle"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Installation de Gradle 8.8" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier les privileges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERREUR] Ce script doit etre execute en tant qu'administrateur!" -ForegroundColor Red
    Write-Host "   Clic droit -> Executer en tant qu'administrateur" -ForegroundColor Yellow
    pause
    exit 1
}

# Rechercher le fichier ZIP
$possiblePaths = @(
    $ZipPath,
    "$env:USERPROFILE\Downloads\gradle-8.8-bin.zip",
    "$env:USERPROFILE\Downloads\gradle-8.8-all.zip",
    ".\gradle-8.8-all.zip",
    ".\gradle-8.8-bin.zip"
)

$foundPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $foundPath = $path
        break
    }
}

if (-not $foundPath) {
    Write-Host "[ERREUR] Fichier Gradle ZIP non trouve!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Chemins recherches :" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Telechargez Gradle 8.8 depuis : https://gradle.org/releases/" -ForegroundColor Cyan
    pause
    exit 1
}

Write-Host "[OK] Fichier trouve : $foundPath" -ForegroundColor Green
Write-Host ""

# Creer le dossier d'installation
Write-Host "[INFO] Creation du dossier d'installation : $InstallDir" -ForegroundColor Cyan
try {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Write-Host "[OK] Dossier cree" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Impossible de creer le dossier : $_" -ForegroundColor Red
    pause
    exit 1
}

# Extraire le ZIP
Write-Host ""
Write-Host "[INFO] Extraction de Gradle (cela peut prendre quelques minutes)..." -ForegroundColor Cyan
try {
    Expand-Archive -Path $foundPath -DestinationPath $InstallDir -Force
    Write-Host "[OK] Extraction terminee" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Erreur lors de l'extraction : $_" -ForegroundColor Red
    pause
    exit 1
}

# Verifier le dossier extrait
$gradleHome = "$InstallDir\gradle-8.8"
if (-not (Test-Path "$gradleHome\bin\gradle.bat")) {
    Write-Host "[ERREUR] Structure de Gradle invalide dans $gradleHome" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[OK] Gradle extrait dans : $gradleHome" -ForegroundColor Green

# Configuration des variables d'environnement
Write-Host ""
Write-Host "[INFO] Configuration des variables d'environnement..." -ForegroundColor Cyan

# GRADLE_HOME
try {
    [System.Environment]::SetEnvironmentVariable('GRADLE_HOME', $gradleHome, 'Machine')
    Write-Host "[OK] GRADLE_HOME = $gradleHome" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Erreur lors de la configuration de GRADLE_HOME : $_" -ForegroundColor Red
    pause
    exit 1
}

# PATH
try {
    $currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $gradleBin = "$gradleHome\bin"
    
    if ($currentPath -notlike "*$gradleBin*") {
        $newPath = $currentPath + ";" + $gradleBin
        [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
        Write-Host "[OK] Ajoute au PATH : $gradleBin" -ForegroundColor Green
    } else {
        Write-Host "[OK] Deja present dans le PATH" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERREUR] Erreur lors de la mise a jour du PATH : $_" -ForegroundColor Red
    pause
    exit 1
}

# Rafraichir les variables d'environnement pour la session actuelle
$env:GRADLE_HOME = $gradleHome
$env:Path = $env:Path + ";" + $gradleHome + "\bin"

# Verification de l'installation
Write-Host ""
Write-Host "[INFO] Verification de l'installation..." -ForegroundColor Cyan
Write-Host ""

try {
    $version = & "$gradleHome\bin\gradle.bat" --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host $version -ForegroundColor White
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "   [SUCCES] Gradle 8.8 installe avec succes!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
    } else {
        throw "Gradle n'a pas pu s'executer"
    }
} catch {
    Write-Host "[ATTENTION] Verification echouee : $_" -ForegroundColor Yellow
    Write-Host "   Les variables d'environnement ont ete configurees," -ForegroundColor Yellow
    Write-Host "   mais redemarrez votre terminal pour les utiliser." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[INFO] Prochaines etapes :" -ForegroundColor Cyan
Write-Host "   1. Fermez TOUS les terminaux ouverts" -ForegroundColor White
Write-Host "   2. Ouvrez un nouveau PowerShell" -ForegroundColor White
Write-Host "   3. Executez : gradle --version" -ForegroundColor White
Write-Host "   4. Continuez avec : GUIDE_BUILD_ANDROID_LOCAL.md" -ForegroundColor White
Write-Host ""

pause
