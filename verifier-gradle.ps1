# Script de verification de l'installation de Gradle

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Verification de Gradle" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier GRADLE_HOME
Write-Host "[1] Variable GRADLE_HOME :" -ForegroundColor Yellow
$gradleHome = [System.Environment]::GetEnvironmentVariable('GRADLE_HOME', 'Machine')
if ($gradleHome) {
    Write-Host "    [OK] $gradleHome" -ForegroundColor Green
} else {
    Write-Host "    [ERREUR] Non definie" -ForegroundColor Red
}
Write-Host ""

# Verifier PATH
Write-Host "[2] Gradle dans le PATH :" -ForegroundColor Yellow
$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($machinePath -like "*gradle*") {
    Write-Host "    [OK] Gradle trouve dans le PATH systeme" -ForegroundColor Green
} else {
    Write-Host "    [ERREUR] Gradle absent du PATH systeme" -ForegroundColor Red
}
Write-Host ""

# Verifier si gradle.bat existe
Write-Host "[3] Fichier gradle.bat :" -ForegroundColor Yellow
if ($gradleHome -and (Test-Path "$gradleHome\bin\gradle.bat")) {
    Write-Host "    [OK] $gradleHome\bin\gradle.bat" -ForegroundColor Green
} elseif (Test-Path "C:\Gradle\gradle-8.8\bin\gradle.bat") {
    Write-Host "    [OK] C:\Gradle\gradle-8.8\bin\gradle.bat" -ForegroundColor Green
} else {
    Write-Host "    [ERREUR] Fichier gradle.bat introuvable" -ForegroundColor Red
}
Write-Host ""

# Verifier la version de Gradle
Write-Host "[4] Version de Gradle :" -ForegroundColor Yellow
try {
    $version = gradle --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host $version -ForegroundColor White
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "   [SUCCES] Gradle est correctement installe !" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
    } else {
        throw "Erreur d'execution"
    }
} catch {
    Write-Host "    [ERREUR] Gradle non accessible depuis ce terminal" -ForegroundColor Red
    Write-Host ""
    Write-Host "    Solutions :" -ForegroundColor Yellow
    Write-Host "    1. Fermez ce terminal et ouvrez-en un nouveau" -ForegroundColor Cyan
    Write-Host "    2. Reexecutez ce script dans le nouveau terminal" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host ""
pause

