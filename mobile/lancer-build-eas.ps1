# Script PowerShell pour lancer le build EAS
# Usage: .\lancer-build-eas.ps1

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║        🚀 YUKPOMNANG - LANCEMENT BUILD EAS              ║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérifier qu'on est dans le bon dossier
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur : package.json non trouvé" -ForegroundColor Red
    Write-Host "   Exécutez ce script depuis le dossier mobile/" -ForegroundColor Yellow
    exit 1
}

# Vérifier la connexion EAS
Write-Host "🔍 Vérification de la connexion EAS..." -ForegroundColor Yellow
$whoami = & eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Vous n'êtes pas connecté à EAS" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Pour vous connecter, exécutez :" -ForegroundColor Yellow
    Write-Host "   eas login" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Ou utilisez le script BUILD-EAS.bat (option 2)" -ForegroundColor Cyan
    Write-Host ""
    $connect = Read-Host "Voulez-vous vous connecter maintenant ? (O/N)"
    if ($connect -eq "O" -or $connect -eq "o") {
        Write-Host ""
        Write-Host "🔐 Connexion à EAS..." -ForegroundColor Yellow
        & eas login
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "❌ Erreur de connexion" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "ℹ️  Connectez-vous d'abord avec 'eas login', puis relancez ce script" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✅ Connecté en tant que : $whoami" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CONFIGURATION DU BUILD" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Plateforme : Android" -ForegroundColor White
Write-Host '📦 Profil : preview (APK téléchargeable)' -ForegroundColor White
Write-Host "⏱️  Temps estimé : 15-25 minutes" -ForegroundColor White
Write-Host ""
Write-Host "💡 Vous recevrez :" -ForegroundColor Cyan
Write-Host "   - Un lien pour suivre la progression" -ForegroundColor Gray
Write-Host '   - Un lien de téléchargement de l''APK une fois terminé' -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Voulez-vous lancer le build maintenant ? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o") {
    Write-Host ""
    Write-Host "❌ Build annulé" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 Lancement du build EAS..." -ForegroundColor Green
Write-Host ""

# Lancer le build
& npx eas build --platform android --profile preview

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build lancé avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Pour suivre la progression :" -ForegroundColor Cyan
    Write-Host "   eas build:list" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors du lancement du build" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vérifiez :" -ForegroundColor Yellow
    Write-Host "   - Votre connexion internet" -ForegroundColor Gray
    Write-Host "   - Que vous êtes bien connecté : eas whoami" -ForegroundColor Gray
    Write-Host "   - Les logs : eas build:list" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

