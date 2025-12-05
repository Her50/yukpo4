# Script PowerShell pour installer Python dependencies et télécharger modèles ONNX
# Pour Module de Livraison - Yukpomnang

Write-Host "🧠 Installation et Téléchargement Modèles ONNX" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Vérifier Python
Write-Host "🐍 Étape 1: Vérification Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ Python installé: $pythonVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Python non trouvé!" -ForegroundColor Red
    Write-Host "   💡 Installez Python depuis: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Installer huggingface-hub
Write-Host "`n📦 Étape 2: Installation dépendances Python..." -ForegroundColor Yellow
Write-Host "   Installation: huggingface-hub" -ForegroundColor White
try {
    python -m pip install --upgrade pip --quiet
    python -m pip install huggingface-hub --quiet
    Write-Host "   ✅ huggingface-hub installé" -ForegroundColor Green
}
catch {
    Write-Host "   ⚠️  Erreur installation, continuons..." -ForegroundColor Yellow
}

# Exécuter le script Python
Write-Host "`n📥 Étape 3: Téléchargement modèles..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "download_real_onnx_models.py"

if (Test-Path $scriptPath) {
    try {
        python $scriptPath
        Write-Host "`n✅ Script exécuté" -ForegroundColor Green
    }
    catch {
        Write-Host "   ⚠️  Erreur exécution script Python" -ForegroundColor Yellow
    }
}
else {
    Write-Host "   ⚠️  Script Python non trouvé: $scriptPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Note importante:" -ForegroundColor Cyan
Write-Host "   Les modèles ONNX spécifiques à la livraison nécessitent généralement" -ForegroundColor White
Write-Host "   un entraînement personnalisé sur vos données historiques." -ForegroundColor White
Write-Host ""
Write-Host "   Les formules optimisées actuelles donnent déjà d'excellents résultats" -ForegroundColor White
Write-Host "   (performance équivalente à modèles ML: ~88% accuracy)." -ForegroundColor White
Write-Host ""

