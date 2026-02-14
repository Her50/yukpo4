# Script d'installation automatique de gcloud CLI pour Windows
# Télécharge et installe Google Cloud SDK

Write-Host "📥 Installation de Google Cloud SDK (gcloud CLI)..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si gcloud est déjà installé
if (Get-Command gcloud -ErrorAction SilentlyContinue) {
    Write-Host "✅ gcloud CLI est déjà installé" -ForegroundColor Green
    gcloud version
    exit 0
}

# Chemin d'installation par défaut
$installPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk"
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

# Vérifier si déjà installé mais pas dans le PATH
if (Test-Path $installPath) {
    Write-Host "⚠️  gcloud semble être installé mais pas dans le PATH" -ForegroundColor Yellow
    Write-Host "   Chemin: $installPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Ajoutez au PATH manuellement ou réinstallez:" -ForegroundColor Yellow
    Write-Host "   $installPath\bin" -ForegroundColor White
    exit 1
}

Write-Host "📥 Téléchargement de l'installateur Google Cloud SDK..." -ForegroundColor Yellow
Write-Host "   Cela peut prendre quelques minutes..." -ForegroundColor Gray

try {
    # Télécharger l'installateur
    $downloadUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    
    Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Lancement de l'installateur..." -ForegroundColor Yellow
    Write-Host "   Suivez les instructions dans la fenêtre qui s'ouvre" -ForegroundColor Gray
    Write-Host ""
    
    # Lancer l'installateur
    Start-Process -FilePath $installerPath -Wait
    
    Write-Host ""
    Write-Host "✅ Installation terminée!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Fermez et rouvrez PowerShell pour que gcloud soit disponible" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Fermez ce PowerShell" -ForegroundColor White
    Write-Host "   2. Ouvrez un nouveau PowerShell" -ForegroundColor White
    Write-Host "   3. Exécutez: gcloud auth login" -ForegroundColor White
    Write-Host "   4. Exécutez: gcloud config set project yukpo-project" -ForegroundColor White
    
} catch {
    Write-Host "❌ Erreur lors du téléchargement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Installation manuelle:" -ForegroundColor Yellow
    Write-Host "   1. Téléchargez depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor White
    Write-Host "   2. Exécutez l'installateur téléchargé" -ForegroundColor White
    exit 1
}

# Nettoyer
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
}

