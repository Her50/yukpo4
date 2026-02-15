# 🔍 Script de Vérification Service GPU
# Date: 2026-02-15
# Objectif: Vérifier l'initialisation, tester les endpoints et vérifier le monitoring GPU

param(
    [string]$ServiceUrl = "https://yukpo-backend-376093909298.europe-west1.run.app",
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "🔍 Vérification Service GPU" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# 1. Vérifier les logs d'initialisation GPU
Write-Host "📋 Étape 1/4: Vérification logs d'initialisation GPU..." -ForegroundColor Yellow
Write-Host ""

$logQuery = "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName AND (textPayload=~'GPU' OR textPayload=~'Service GPU' OR textPayload=~'GpuService' OR textPayload=~'initialisé' OR textPayload=~'Monitoring GPU')"

Write-Host "   Recherche des logs GPU..." -ForegroundColor Cyan
$logs = gcloud logging read $logQuery --limit=50 --format="value(timestamp,severity,textPayload)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $logs) {
    Write-Host "   ✅ Logs trouvés:" -ForegroundColor Green
    $gpuLogs = $logs | Select-String -Pattern "GPU|Service GPU|GpuService|initialisé|Monitoring" | Select-Object -First 10
    foreach ($log in $gpuLogs) {
        Write-Host "   $log" -ForegroundColor White
    }
    
    # Vérifier les messages clés
    $hasInit = $logs | Select-String -Pattern "Service GPU initialisé|GpuService.*Initialisé"
    $hasMonitoring = $logs | Select-String -Pattern "Monitoring GPU démarré|scaling automatique"
    
    if ($hasInit) {
        Write-Host "   ✅ Service GPU initialisé détecté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Service GPU initialisé non détecté dans les logs" -ForegroundColor Yellow
    }
    
    if ($hasMonitoring) {
        Write-Host "   ✅ Monitoring GPU démarré détecté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Monitoring GPU non détecté dans les logs" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Aucun log GPU trouvé (le service peut ne pas être encore démarré)" -ForegroundColor Yellow
}

Write-Host ""

# 2. Tester les endpoints GPU
Write-Host "📋 Étape 2/4: Test des endpoints GPU..." -ForegroundColor Yellow
Write-Host ""

# Test /api/gpu/metrics
Write-Host "   Test GET /api/gpu/metrics..." -ForegroundColor Cyan
try {
    $metricsResponse = Invoke-RestMethod -Uri "$ServiceUrl/api/gpu/metrics" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ Endpoint /api/gpu/metrics accessible" -ForegroundColor Green
    Write-Host "   Réponse:" -ForegroundColor Cyan
    $metricsResponse | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White
    
    if ($metricsResponse.enabled -eq $true) {
        Write-Host "   ✅ Service GPU activé" -ForegroundColor Green
        Write-Host "   Métriques:" -ForegroundColor Cyan
        Write-Host "     - Instances actives: $($metricsResponse.metrics.active_instances)" -ForegroundColor White
        Write-Host "     - Utilisation: $($metricsResponse.metrics.current_utilization)%" -ForegroundColor White
        Write-Host "     - Coût mensuel estimé: `$$($metricsResponse.metrics.monthly_cost_estimate)" -ForegroundColor White
        Write-Host "     - Requêtes totales: $($metricsResponse.metrics.total_requests)" -ForegroundColor White
    } else {
        Write-Host "   ⚠️  Service GPU désactivé" -ForegroundColor Yellow
        Write-Host "   Message: $($metricsResponse.message)" -ForegroundColor White
    }
} catch {
    Write-Host "   ❌ ERREUR: Impossible d'accéder à /api/gpu/metrics" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test /api/gpu/status
Write-Host "   Test GET /api/gpu/status..." -ForegroundColor Cyan
try {
    $statusResponse = Invoke-RestMethod -Uri "$ServiceUrl/api/gpu/status" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ Endpoint /api/gpu/status accessible" -ForegroundColor Green
    Write-Host "   Réponse:" -ForegroundColor Cyan
    $statusResponse | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White
    
    if ($statusResponse.enabled -eq $true) {
        Write-Host "   ✅ Service GPU opérationnel" -ForegroundColor Green
        Write-Host "   Statut:" -ForegroundColor Cyan
        Write-Host "     - Instances actives: $($statusResponse.active_instances)" -ForegroundColor White
        Write-Host "     - Utilisation: $($statusResponse.current_utilization)%" -ForegroundColor White
        Write-Host "     - Requêtes réussies: $($statusResponse.successful_requests)" -ForegroundColor White
        Write-Host "     - Requêtes échouées: $($statusResponse.failed_requests)" -ForegroundColor White
    } else {
        Write-Host "   ⚠️  Service GPU désactivé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ ERREUR: Impossible d'accéder à /api/gpu/status" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. Vérifier le monitoring automatique
Write-Host "📋 Étape 3/4: Vérification monitoring automatique..." -ForegroundColor Yellow
Write-Host ""

# Vérifier les logs de monitoring
$monitoringQuery = "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName AND (textPayload=~'Monitoring GPU' OR textPayload=~'scaling' OR textPayload=~'budget' OR textPayload=~'scale')"

Write-Host "   Recherche des logs de monitoring..." -ForegroundColor Cyan
$monitoringLogs = gcloud logging read $monitoringQuery --limit=20 --format="value(timestamp,textPayload)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $monitoringLogs) {
    Write-Host "   ✅ Logs de monitoring trouvés:" -ForegroundColor Green
    $monitoringLogs | Select-Object -First 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor White
    }
} else {
    Write-Host "   ⚠️  Aucun log de monitoring trouvé (le monitoring peut ne pas être encore démarré)" -ForegroundColor Yellow
}

# Vérifier la table gpu_scale_actions dans la base de données
Write-Host "   Vérification table gpu_scale_actions..." -ForegroundColor Cyan
Write-Host "   (Cette vérification nécessite un accès à la base de données)" -ForegroundColor Yellow

Write-Host ""

# 4. Vérifier les instances GPU déployées
Write-Host "📋 Étape 4/4: Vérification instances GPU déployées..." -ForegroundColor Yellow
Write-Host ""

Write-Host "   Recherche des instances GPU Compute Engine..." -ForegroundColor Cyan
$gpuInstances = gcloud compute instances list --filter="name~yukpo-gpu-worker" --format="table(name,zone,status,machineType)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    if ($gpuInstances -match "yukpo-gpu-worker") {
        Write-Host "   ✅ Instances GPU trouvées:" -ForegroundColor Green
        Write-Host $gpuInstances -ForegroundColor White
    } else {
        Write-Host "   ⚠️  Aucune instance GPU trouvée" -ForegroundColor Yellow
        Write-Host "   Les instances GPU doivent être déployées via Terraform" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Impossible de vérifier les instances GPU" -ForegroundColor Yellow
}

Write-Host ""

# Résumé
Write-Host "📊 Résumé de la Vérification" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Endpoints GPU testés:" -ForegroundColor Green
Write-Host "   - GET $ServiceUrl/api/gpu/metrics" -ForegroundColor White
Write-Host "   - GET $ServiceUrl/api/gpu/status" -ForegroundColor White
Write-Host ""
Write-Host "📋 Prochaines Étapes:" -ForegroundColor Yellow
Write-Host "   1. Vérifier les logs Cloud Run pour confirmer l'initialisation" -ForegroundColor White
Write-Host "   2. Déployer les instances GPU via Terraform si nécessaire" -ForegroundColor White
Write-Host "   3. Vérifier le monitoring automatique dans les logs" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Commandes Utiles:" -ForegroundColor Cyan
Write-Host "   # Vérifier les logs GPU" -ForegroundColor White
Write-Host "   gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName AND textPayload=~'GPU'`" --limit=50 --project=$ProjectId" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Lister les instances GPU" -ForegroundColor White
Write-Host "   gcloud compute instances list --filter=`"name~yukpo-gpu-worker`" --project=$ProjectId" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Déployer via Terraform" -ForegroundColor White
Write-Host "   cd gcp/gpu-infrastructure/terraform" -ForegroundColor Gray
Write-Host "   terraform init" -ForegroundColor Gray
Write-Host "   terraform plan" -ForegroundColor Gray
Write-Host "   terraform apply" -ForegroundColor Gray
Write-Host ""

