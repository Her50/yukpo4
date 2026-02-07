# Script PowerShell simplifie pour lancer le build EAS
# Usage: .\lancer-build-eas-simple.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG - LANCEMENT BUILD EAS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier qu'on est dans le bon dossier
if (-not (Test-Path "package.json")) {
    Write-Host "ERREUR : package.json non trouve" -ForegroundColor Red
    Write-Host "Executez ce script depuis le dossier mobile/" -ForegroundColor Yellow
    exit 1
}

# Verifier la connexion EAS
Write-Host "Verification de la connexion EAS..." -ForegroundColor Yellow
$whoamiOutput = & eas whoami 2>&1
$isConnected = $LASTEXITCODE -eq 0

if (-not $isConnected) {
    Write-Host ""
    Write-Host "Vous n'etes pas connecte a EAS" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pour vous connecter, executez :" -ForegroundColor Yellow
    Write-Host "  eas login" -ForegroundColor White
    Write-Host ""
    Write-Host "Ou utilisez le script BUILD-EAS.bat (option 2)" -ForegroundColor Cyan
    Write-Host ""
    $connect = Read-Host "Voulez-vous vous connecter maintenant ? (O/N)"
    if ($connect -eq "O" -or $connect -eq "o") {
        Write-Host ""
        Write-Host "Connexion a EAS..." -ForegroundColor Yellow
        & eas login
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "ERREUR de connexion" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "Connectez-vous d'abord avec 'eas login', puis relancez ce script" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "Connecte en tant que : $whoamiOutput" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CONFIGURATION DU BUILD" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Plateforme : Android" -ForegroundColor White
Write-Host "Profil : preview (APK telechargeable)" -ForegroundColor White
Write-Host "Temps estime : 15-25 minutes" -ForegroundColor White
Write-Host ""
Write-Host "Vous recevrez :" -ForegroundColor Cyan
Write-Host "  - Un lien pour suivre la progression" -ForegroundColor Gray
Write-Host "  - Un lien de telechargement de l'APK une fois termine" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Voulez-vous lancer le build maintenant ? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o") {
    Write-Host ""
    Write-Host "Build annule" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Lancement du build EAS..." -ForegroundColor Green
Write-Host ""

# Lancer le build
& npx eas build --platform android --profile preview

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build lance avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour suivre la progression :" -ForegroundColor Cyan
    Write-Host "  eas build:list" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERREUR lors du lancement du build" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez :" -ForegroundColor Yellow
    Write-Host "  - Votre connexion internet" -ForegroundColor Gray
    Write-Host "  - Que vous etes bien connecte : eas whoami" -ForegroundColor Gray
    Write-Host "  - Les logs : eas build:list" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

