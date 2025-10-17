# Script de test du build EAS pour Yukpomnang Mobile

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Test du build EAS Android" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que les fichiers corriges sont presents
Write-Host "Verification de la configuration..." -ForegroundColor Yellow

$filesToCheck = @{
    "android\build.gradle" = "8.3.0"
    "android\settings.gradle" = "expo-autolinking-settings"
    "android\gradle.properties" = "android.kotlinVersion=2.0.0"
}

$allGood = $true
foreach ($file in $filesToCheck.Keys)
{
    if (Test-Path $file)
    {
        $content = Get-Content $file -Raw
        if ($content -like "*$($filesToCheck[$file])*")
        {
            Write-Host "  OK $file contient $($filesToCheck[$file])" -ForegroundColor Green
        }
        else
        {
            Write-Host "  ATTENTION $file ne contient pas $($filesToCheck[$file])" -ForegroundColor Yellow
            $allGood = $false
        }
    }
    else
    {
        Write-Host "  ERREUR $file introuvable!" -ForegroundColor Red
        $allGood = $false
    }
}

if (-not $allGood)
{
    Write-Host ""
    Write-Host "Executez d abord: powershell -ExecutionPolicy Bypass -File fix-gradle-kotlin2.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Configuration OK" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Verifier que eas-cli est installe
Write-Host "Verification de eas-cli..." -ForegroundColor Yellow
$easVersion = npx eas-cli --version 2>$null
if ($LASTEXITCODE -eq 0)
{
    Write-Host "  OK eas-cli version: $easVersion" -ForegroundColor Green
}
else
{
    Write-Host "  Installation de eas-cli..." -ForegroundColor Yellow
    npm install -g eas-cli
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Lancement du build EAS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Profile: preview-debug" -ForegroundColor White
Write-Host "Platform: Android" -ForegroundColor White
Write-Host ""
Write-Host "Le build va demarrer. Cela peut prendre 10-15 minutes." -ForegroundColor Yellow
Write-Host "Vous pouvez suivre la progression sur https://expo.dev" -ForegroundColor Cyan
Write-Host ""

# Lancer le build EAS
npx eas-cli build --platform android --profile preview-debug

if ($LASTEXITCODE -eq 0)
{
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host " Build EAS lance avec succes!" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
}
else
{
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Red
    Write-Host " Erreur lors du lancement du build" -ForegroundColor Red
    Write-Host "====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez:" -ForegroundColor Yellow
    Write-Host "  1. Que vous etes connecte avec: eas login" -ForegroundColor White
    Write-Host "  2. Que le projet est configure: eas build:configure" -ForegroundColor White
    Write-Host "  3. Les logs complets ci-dessus" -ForegroundColor White
}

