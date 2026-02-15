# ✅ Script de vérification des variables GPU dans GCP Cloud Run
# Usage: .\scripts\verify-gpu-variables-gcp.ps1

param(
    [string]$ServiceName = "yukpomnang-backend",
    [string]$Region = "europe-west1"
)

Write-Host "🔍 Vérification des variables GPU dans GCP Cloud Run..." -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Gray
Write-Host "Region: $Region" -ForegroundColor Gray
Write-Host ""

# Variables GPU requises
$requiredVars = @(
    "GPU_ENABLED",
    "GPU_ENDPOINT",
    "GPU_ZONE",
    "GPU_INSTANCE_NAME",
    "GCP_PROJECT_ID",
    "GPU_MONTHLY_BUDGET",
    "GPU_SCALE_UP_THRESHOLD",
    "GPU_SCALE_DOWN_THRESHOLD",
    "GPU_MAX_INSTANCES",
    "GPU_MIN_INSTANCES"
)

# Variables GPU optionnelles
$optionalVars = @(
    "GCP_SERVICE_ACCOUNT",
    "GPU_SCALE_DOWN_COOLDOWN",
    "GPU_REQUEST_TIMEOUT"
)

Write-Host "📋 Variables GPU requises:" -ForegroundColor Yellow
$missingVars = @()
$foundVars = @()

foreach ($var in $requiredVars) {
    try {
        $value = gcloud run services describe $ServiceName `
            --region=$Region `
            --format="value(spec.template.spec.containers[0].env[?(@.name=='$var')].value)" `
            2>$null
        
        if ($value) {
            Write-Host "  ✅ $var = $value" -ForegroundColor Green
            $foundVars += $var
        } else {
            Write-Host "  ❌ $var = NON DÉFINIE" -ForegroundColor Red
            $missingVars += $var
        }
    } catch {
        Write-Host "  ❌ $var = ERREUR LECTURE" -ForegroundColor Red
        $missingVars += $var
    }
}

Write-Host ""
Write-Host "📋 Variables GPU optionnelles:" -ForegroundColor Yellow
foreach ($var in $optionalVars) {
    try {
        $value = gcloud run services describe $ServiceName `
            --region=$Region `
            --format="value(spec.template.spec.containers[0].env[?(@.name=='$var')].value)" `
            2>$null
        
        if ($value) {
            Write-Host "  ✅ $var = $value" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $var = Non définie (optionnel)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ⚠️  $var = Non définie (optionnel)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Cyan
Write-Host "  Variables trouvées: $($foundVars.Count)/$($requiredVars.Count)" -ForegroundColor $(if ($foundVars.Count -eq $requiredVars.Count) { "Green" } else { "Yellow" })
Write-Host "  Variables manquantes: $($missingVars.Count)" -ForegroundColor $(if ($missingVars.Count -eq 0) { "Green" } else { "Red" })

if ($missingVars.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Variables manquantes:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 Pour activer les variables, utilisez:" -ForegroundColor Yellow
    Write-Host "   gcloud run services update $ServiceName --region=$Region --update-env-vars=`"GPU_ENABLED=true`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Ou consultez VARIABLES_GPU_GCP_ALIGNEMENT.md pour les instructions complètes" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "✅ Toutes les variables GPU sont configurées !" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Vérifiez les logs au démarrage pour confirmer:" -ForegroundColor Yellow
    Write-Host "   gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName`" --limit=50 --format=json" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔍 Vérification du statut GPU via API:" -ForegroundColor Cyan
Write-Host "   curl https://your-backend-url/api/gpu/status" -ForegroundColor Gray

