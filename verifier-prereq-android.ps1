# Script de verification des prerequis Android

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   VERIFICATION DES PREREQUIS ANDROID" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# 1. Java JDK
Write-Host "[1] Java JDK :" -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    Write-Host "    [OK] $javaVersion" -ForegroundColor Green
    
    $javaHome = [System.Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
    if ($javaHome) {
        Write-Host "    [OK] JAVA_HOME = $javaHome" -ForegroundColor Green
    } else {
        Write-Host "    [ATTENTION] JAVA_HOME non defini" -ForegroundColor Yellow
    }
} catch {
    Write-Host "    [ERREUR] Java non installe ou non accessible" -ForegroundColor Red
    $allOk = $false
}
Write-Host ""

# 2. Gradle
Write-Host "[2] Gradle :" -ForegroundColor Yellow
try {
    $gradleVersion = gradle --version 2>&1 | Select-String "Gradle"
    Write-Host "    [OK] $gradleVersion" -ForegroundColor Green
    
    $gradleHome = [System.Environment]::GetEnvironmentVariable('GRADLE_HOME', 'Machine')
    if ($gradleHome) {
        Write-Host "    [OK] GRADLE_HOME = $gradleHome" -ForegroundColor Green
    }
} catch {
    Write-Host "    [ERREUR] Gradle non installe ou non accessible" -ForegroundColor Red
    $allOk = $false
}
Write-Host ""

# 3. Android SDK
Write-Host "[3] Android SDK :" -ForegroundColor Yellow
$androidHome = [System.Environment]::GetEnvironmentVariable('ANDROID_HOME', 'Machine')
if (-not $androidHome) {
    $androidHome = [System.Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT', 'Machine')
}
if (-not $androidHome) {
    $androidHome = "$env:LOCALAPPDATA\Android\Sdk"
}

if (Test-Path $androidHome) {
    Write-Host "    [OK] Android SDK trouve : $androidHome" -ForegroundColor Green
    
    # Verifier ADB
    $adbPath = "$androidHome\platform-tools\adb.exe"
    if (Test-Path $adbPath) {
        Write-Host "    [OK] ADB disponible" -ForegroundColor Green
    } else {
        Write-Host "    [ATTENTION] ADB non trouve" -ForegroundColor Yellow
    }
    
    # Verifier SDK Manager
    $sdkmanagerPath = "$androidHome\cmdline-tools\latest\bin\sdkmanager.bat"
    if (Test-Path $sdkmanagerPath) {
        Write-Host "    [OK] SDK Manager disponible" -ForegroundColor Green
    } else {
        Write-Host "    [ATTENTION] SDK Manager non trouve" -ForegroundColor Yellow
    }
} else {
    Write-Host "    [ERREUR] Android SDK non trouve" -ForegroundColor Red
    Write-Host "    Chemin recherche : $androidHome" -ForegroundColor Gray
    $allOk = $false
}

$androidHomeEnv = [System.Environment]::GetEnvironmentVariable('ANDROID_HOME', 'Machine')
if ($androidHomeEnv) {
    Write-Host "    [OK] ANDROID_HOME = $androidHomeEnv" -ForegroundColor Green
} else {
    Write-Host "    [ATTENTION] ANDROID_HOME non defini" -ForegroundColor Yellow
}
Write-Host ""

# 4. Node.js et npm
Write-Host "[4] Node.js et npm :" -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "    [OK] Node.js $nodeVersion" -ForegroundColor Green
    
    $npmVersion = npm --version
    Write-Host "    [OK] npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "    [ERREUR] Node.js non installe" -ForegroundColor Red
    $allOk = $false
}
Write-Host ""

# 5. Verifier le projet mobile
Write-Host "[5] Projet mobile :" -ForegroundColor Yellow
if (Test-Path "mobile\package.json") {
    Write-Host "    [OK] package.json trouve" -ForegroundColor Green
    
    if (Test-Path "mobile\node_modules") {
        Write-Host "    [OK] node_modules present" -ForegroundColor Green
    } else {
        Write-Host "    [ATTENTION] node_modules absent - Executez 'npm install'" -ForegroundColor Yellow
    }
    
    if (Test-Path "mobile\android") {
        Write-Host "    [OK] Dossier android/ present" -ForegroundColor Green
        
        if (Test-Path "mobile\android\gradlew.bat") {
            Write-Host "    [OK] Gradle wrapper present" -ForegroundColor Green
        } else {
            Write-Host "    [ATTENTION] Gradle wrapper absent" -ForegroundColor Yellow
        }
    } else {
        Write-Host "    [ATTENTION] Dossier android/ absent - Executez 'npx expo prebuild'" -ForegroundColor Yellow
    }
} else {
    Write-Host "    [ERREUR] Projet mobile non trouve" -ForegroundColor Red
}
Write-Host ""

# Resume
Write-Host "============================================================" -ForegroundColor Cyan
if ($allOk) {
    Write-Host "   [SUCCES] Tous les prerequis essentiels sont installes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez compiler l'application avec :" -ForegroundColor Cyan
    Write-Host "  cd mobile\android" -ForegroundColor White
    Write-Host "  .\gradlew assembleRelease" -ForegroundColor White
} else {
    Write-Host "   [ATTENTION] Certains prerequis sont manquants" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Prochaines etapes :" -ForegroundColor Cyan
    Write-Host "  1. Installez Android SDK si absent" -ForegroundColor White
    Write-Host "  2. Executez setup-android-env.ps1" -ForegroundColor White
    Write-Host "  3. Relancez cette verification" -ForegroundColor White
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

