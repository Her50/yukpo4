# 🔍 Script PowerShell de vérification du statut Cloud Run et connexion PostgreSQL
# Usage: .\scripts\verify-cloud-run-status.ps1

Write-Host "🔍 Vérification du statut Cloud Run et connexion PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$PROJECT_ID = "yukpo-project"
$REGION = "europe-west1"
$SERVICE_NAME = "yukpo-backend"

# URL probable du service (à vérifier dans la console GCP)
# Format: https://yukpo-backend-xxxxx-ew.a.run.app
$SERVICE_URL = "https://yukpo-backend-xxxxx-ew.a.run.app"  # À remplacer par l'URL réelle

Write-Host "📊 1. Test de l'endpoint HTTP..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Test health check
Write-Host "Test de l'endpoint /health..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-WebRequest -Uri "$SERVICE_URL/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Health check: OK (HTTP $($healthResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Réponse: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Health check: Échec" -ForegroundColor Yellow
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test de l'endpoint racine..." -ForegroundColor Cyan
try {
    $rootResponse = Invoke-WebRequest -Uri "$SERVICE_URL/" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Endpoint racine: OK (HTTP $($rootResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Endpoint racine: Échec" -ForegroundColor Yellow
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 2. Instructions pour vérifier via la console GCP..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Ouvrez la console Cloud Run:" -ForegroundColor Cyan
$consoleUrl = 'https://console.cloud.google.com/run?project=yukpo-project'
Write-Host "   $consoleUrl" -ForegroundColor White
Write-Host ""
Write-Host "2. Cliquez sur le service '$SERVICE_NAME'" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Vérifiez l'onglet 'LOGS' pour voir:" -ForegroundColor Cyan
Write-Host "   ✅ 'Connexion PostgreSQL établie'" -ForegroundColor Green
Write-Host "   ✅ 'Serveur lance sur http://0.0.0.0:8080'" -ForegroundColor Green
Write-Host "   ✅ 'Cloud Run: Migrations SQLx lancées en arrière-plan'" -ForegroundColor Green
Write-Host ""
Write-Host "4. Vérifiez l'onglet 'METRICS' pour voir:" -ForegroundColor Cyan
Write-Host "   - Requêtes par seconde" -ForegroundColor White
Write-Host "   - Latence" -ForegroundColor White
Write-Host "   - Erreurs" -ForegroundColor White
Write-Host ""
Write-Host "5. Vérifiez l'onglet 'REVISIONS' pour voir:" -ForegroundColor Cyan
Write-Host "   - Révision active" -ForegroundColor White
Write-Host "   - Statut: Ready" -ForegroundColor White
Write-Host "   - Image utilisée" -ForegroundColor White

Write-Host ""
Write-Host "🗄️ 3. Vérification de la connexion PostgreSQL..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "Dans les logs Cloud Run, recherchez:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Messages de succès:" -ForegroundColor Green
Write-Host "   - '✅ Connexion PostgreSQL établie'" -ForegroundColor White
Write-Host "   - '✅ [MIGRATIONS SQLX Cloud Run] Migrations SQLx standard appliquées avec succès'" -ForegroundColor White
Write-Host ""
Write-Host "❌ Messages d'erreur (à éviter):" -ForegroundColor Red
Write-Host "   - '❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL'" -ForegroundColor White
Write-Host "   - 'error communicating with database'" -ForegroundColor White
Write-Host "   - 'connection timeout'" -ForegroundColor White

Write-Host ""
Write-Host "📊 4. Test de connexion à la base de données (si gcloud est installé)..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "Si gcloud est installé, exécutez:" -ForegroundColor Cyan
Write-Host "  gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "Pour voir les logs:" -ForegroundColor Cyan
$logCommand = "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit 50 --project $PROJECT_ID"
Write-Host "  $logCommand" -ForegroundColor White

Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Résumé:" -ForegroundColor Cyan
Write-Host "  - Service: $SERVICE_NAME" -ForegroundColor White
Write-Host "  - Région: $REGION" -ForegroundColor White
Write-Host "  - Projet: $PROJECT_ID" -ForegroundColor White
Write-Host "  - Console: $consoleUrl" -ForegroundColor White
