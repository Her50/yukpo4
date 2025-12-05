# Script pour télécharger des modèles ONNX depuis Hugging Face
# Pour Module de Livraison - Prédictions ETA et Forecasting

param(
    [switch]$SkipDownload = $false
)

Write-Host "🧠 Téléchargement Modèles ONNX - Module de Livraison" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$MODELS_DIR = "models"
$BACKEND_DIR = Split-Path -Parent $PSScriptRoot
$FULL_MODELS_PATH = Join-Path $BACKEND_DIR $MODELS_DIR

# S'assurer que le répertoire existe
if (-not (Test-Path $FULL_MODELS_PATH)) {
    New-Item -ItemType Directory -Path $FULL_MODELS_PATH -Force | Out-Null
}

# Informations sur les modèles recommandés
$recommendedModels = @(
    @{
        Name = "ETAPrediction"
        Description = "Prédiction Temps d'Arrivée (ETA)"
        Source = "Hugging Face"
        SearchTerms = "time series forecasting regression onnx"
        Note = "Chercher: 'time-series-forecast', 'regression', 'lightweight'"
    },
    @{
        Name = "DemandForecasting"
        Description = "Prévision de Demande"
        Source = "Hugging Face"
        SearchTerms = "demand forecast time series onnx"
        Note = "Chercher: 'demand-forecast', 'time-series', 'sales-forecast'"
    },
    @{
        Name = "RouteOptimization"
        Description = "Optimisation Routes (VRP)"
        Source = "ONNX Model Zoo"
        SearchTerms = "optimization routing onnx"
        Note = "Plus complexe - peut nécessiter modèle personnalisé"
    },
    @{
        Name = "FraudDetection"
        Description = "Détection Fraude"
        Source = "Hugging Face"
        SearchTerms = "anomaly detection classification onnx"
        Note = "Chercher: 'anomaly-detection', 'fraud-detection', 'classification'"
    }
)

Write-Host "📋 Modèles recommandés pour Module de Livraison:" -ForegroundColor Yellow
Write-Host ""

foreach ($model in $recommendedModels) {
    Write-Host "   📦 $($model.Name)" -ForegroundColor Cyan
    Write-Host "      Description: $($model.Description)" -ForegroundColor White
    Write-Host "      Source: $($model.Source)" -ForegroundColor Gray
    Write-Host "      Recherche: $($model.SearchTerms)" -ForegroundColor Gray
    Write-Host "      Note: $($model.Note)" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "🔗 Liens directs:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Hugging Face ONNX Models:" -ForegroundColor Green
Write-Host "      https://huggingface.co/models?library=onnx" -ForegroundColor White
Write-Host ""
Write-Host "   2. ONNX Model Zoo:" -ForegroundColor Green
Write-Host "      https://github.com/onnx/models" -ForegroundColor White
Write-Host ""
Write-Host "   3. Recherche spécifique:" -ForegroundColor Green
Write-Host "      • Time Series: https://huggingface.co/models?search=time+series+onnx" -ForegroundColor White
Write-Host "      • Forecasting: https://huggingface.co/models?search=forecast+onnx" -ForegroundColor White
Write-Host "      • Regression: https://huggingface.co/models?search=regression+onnx" -ForegroundColor White
Write-Host ""

if (-not $SkipDownload) {
    Write-Host "⚠️  Mode automatique limité" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Pour télécharger automatiquement, vous devez:" -ForegroundColor White
    Write-Host "   1. Installer: pip install huggingface-hub" -ForegroundColor Cyan
    Write-Host "   2. Utiliser Python pour télécharger les modèles" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Exemple Python:" -ForegroundColor Yellow
    Write-Host @"
   from huggingface_hub import hf_hub_download
   import os
   
   models_dir = r'$FULL_MODELS_PATH'
   os.makedirs(models_dir, exist_ok=True)
   
   # Exemple: Télécharger un modèle
   # hf_hub_download(
   #     repo_id='model-repo-id',
   #     filename='model.onnx',
   #     local_dir=models_dir
   # )
"@ -ForegroundColor Gray
    Write-Host ""
}

Write-Host "💡 Alternative: Formules améliorées (Actuellement actives)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Le service DeliveryMLModelsService utilise actuellement des formules" -ForegroundColor White
Write-Host "   mathématiques optimisées qui donnent d'excellents résultats pour:" -ForegroundColor White
Write-Host "   • Prédiction ETA basée sur distance, trafic, météo" -ForegroundColor Gray
Write-Host "   • Prévision demande avec tendances historiques" -ForegroundColor Gray
Write-Host "   • Optimisation avec heuristiques avancées" -ForegroundColor Gray
Write-Host ""
Write-Host "   Ces formules fonctionnent SANS modèles ML et sont déjà en production!" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Instructions complètes dans: GUIDE_ML_MODELS_DIR.md" -ForegroundColor Green
Write-Host ""

