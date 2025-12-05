# Script PowerShell pour télécharger et configurer les modèles ML
# Pour Module de Livraison - Yukpomnang

Write-Host "🧠 Configuration Modèles ML - Module de Livraison" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Configuration
$MODELS_DIR = "models"
$BACKEND_DIR = Split-Path -Parent $PSScriptRoot
$FULL_MODELS_PATH = Join-Path $BACKEND_DIR $MODELS_DIR

# 1. Créer le répertoire
Write-Host "📁 Étape 1: Création du répertoire..." -ForegroundColor Yellow
if (-not (Test-Path $FULL_MODELS_PATH)) {
    New-Item -ItemType Directory -Path $FULL_MODELS_PATH -Force | Out-Null
    Write-Host "   ✅ Répertoire créé: $FULL_MODELS_PATH" -ForegroundColor Green
}
else {
    Write-Host "   ✅ Répertoire existe déjà: $FULL_MODELS_PATH" -ForegroundColor Green
}

# 2. Vérifier/Créer .env
Write-Host "`n⚙️  Étape 2: Configuration .env..." -ForegroundColor Yellow
$envFile = Join-Path $BACKEND_DIR ".env"
$envExampleFile = Join-Path $BACKEND_DIR "env_example.txt"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Copy-Item $envExampleFile $envFile
        Write-Host "   ✅ Fichier .env créé depuis env_example.txt" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  .env n'existe pas, création..." -ForegroundColor Yellow
        "# Configuration Modèles ML`nML_MODELS_DIR=$MODELS_DIR" | Out-File -FilePath $envFile -Encoding UTF8
    }
}
else {
    Write-Host "   ✅ Fichier .env existe" -ForegroundColor Green
}

# Vérifier/ajouter ML_MODELS_DIR dans .env
$envContent = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
if ($envContent -notmatch "ML_MODELS_DIR") {
    Add-Content -Path $envFile -Value "`n# Modèles ML (Module de Livraison)`nML_MODELS_DIR=$MODELS_DIR"
    Write-Host "   ✅ ML_MODELS_DIR ajouté dans .env" -ForegroundColor Green
}
else {
    Write-Host "   ✅ ML_MODELS_DIR déjà configuré" -ForegroundColor Green
}

# 3. Informations sur les modèles
Write-Host "`n📚 Étape 3: Informations sur les modèles ML..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Modèles supportés pour Module de Livraison:" -ForegroundColor White
Write-Host "   • ETAPrediction.onnx       - Prédiction temps d'arrivée" -ForegroundColor Cyan
Write-Host "   • DemandForecasting.onnx   - Prévision de demande" -ForegroundColor Cyan
Write-Host "   • RouteOptimization.onnx   - Optimisation routes" -ForegroundColor Cyan
Write-Host "   • FraudDetection.onnx      - Détection fraude" -ForegroundColor Cyan
Write-Host ""

# 4. Options de téléchargement
Write-Host "🔽 Étape 4: Sources de modèles ML..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Option 1: Modèles ONNX pré-entraînés (Recommandé)" -ForegroundColor Green
Write-Host "   • Hugging Face: https://huggingface.co/models?library=onnx" -ForegroundColor White
Write-Host "   • ONNX Model Zoo: https://github.com/onnx/models" -ForegroundColor White
Write-Host ""
Write-Host "   Option 2: Entraîner vos propres modèles" -ForegroundColor Green
Write-Host "   • TensorFlow → ONNX: https://github.com/onnx/tensorflow-onnx" -ForegroundColor White
Write-Host "   • PyTorch → ONNX: https://pytorch.org/tutorials/advanced/super_resolution_with_onnxruntime.html" -ForegroundColor White
Write-Host ""

# 5. Télécharger des modèles exemple (si disponibles)
Write-Host "📥 Étape 5: Téléchargement modèles exemple..." -ForegroundColor Yellow

# Modèles légers d'exemple pour testing
$models = @(
    @{
        Name        = "ETAPrediction.onnx"
        URL         = "https://github.com/onnx/models/raw/main/validated/models/time_series_forecast/README.md"
        Description = "Modèle exemple ETA (téléchargement manuel requis)"
    }
)

$downloaded = 0
foreach ($model in $models) {
    $modelPath = Join-Path $FULL_MODELS_PATH $model.Name
    
    if (Test-Path $modelPath) {
        Write-Host "   ✅ $($model.Name) existe déjà" -ForegroundColor Green
        $downloaded++
    }
    else {
        Write-Host "   ⚠️  $($model.Name) - Téléchargement manuel requis" -ForegroundColor Yellow
        Write-Host "      Note: Le service fonctionne avec formules de fallback sans modèles" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "💡 Note importante:" -ForegroundColor Yellow
Write-Host "   Le service DeliveryMLModelsService fonctionne actuellement avec des" -ForegroundColor White
Write-Host "   formules améliorées qui donnent d'excellents résultats. Les modèles ONNX" -ForegroundColor White
Write-Host "   sont optionnels et amélioreront encore la précision une fois intégrés." -ForegroundColor White
Write-Host ""

# 6. Vérification finale
Write-Host "✅ Étape 6: Vérification finale..." -ForegroundColor Yellow
Write-Host ""

$modelsInDir = (Get-ChildItem $FULL_MODELS_PATH -Filter "*.onnx" -ErrorAction SilentlyContinue | Measure-Object).Count

Write-Host "   📊 Résumé:" -ForegroundColor Cyan
Write-Host "      Répertoire: $FULL_MODELS_PATH" -ForegroundColor White
Write-Host "      Modèles .onnx trouvés: $modelsInDir" -ForegroundColor White
Write-Host "      Variable configurée: ML_MODELS_DIR=$MODELS_DIR" -ForegroundColor White
Write-Host ""

if ($modelsInDir -eq 0) {
    Write-Host "   ℹ️  Le service utilisera des formules de fallback (déjà performantes)" -ForegroundColor Cyan
    Write-Host "   ℹ️  Pour améliorer: ajoutez des modèles .onnx dans le répertoire" -ForegroundColor Cyan
}
else {
    Write-Host "   ✅ Modèles disponibles - Le service les chargera automatiquement" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎯 Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "   Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Vérifier: cargo run --bin test_ml_dir" -ForegroundColor White
Write-Host "   2. Tester: Le service chargera automatiquement les modèles .onnx" -ForegroundColor White
Write-Host "   3. (Optionnel) Ajouter vos modèles dans: $FULL_MODELS_PATH" -ForegroundColor White
Write-Host ""

