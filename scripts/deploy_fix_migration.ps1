# Script pour déployer la migration de correction
# La migration sera exécutée automatiquement au démarrage du backend via sqlx::migrate!
# Usage: .\scripts\deploy_fix_migration.ps1

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DÉPLOIEMENT DE LA MIGRATION DE CORRECTION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que la migration existe
$migrationFile = "backend/migrations/20260206_fix_all_critical_errors_complete.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "[ERROR] Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Migration trouvée: $migrationFile" -ForegroundColor Green
Write-Host ""

# La migration sera exécutée automatiquement par sqlx::migrate! au démarrage
# Il suffit de forcer le redéploiement du service ECS

Write-Host "[INFO] Forçage du redéploiement du service ECS..." -ForegroundColor Yellow
Write-Host "   La migration sera exécutée automatiquement au démarrage" -ForegroundColor Cyan
Write-Host ""

try {
    $updateResult = aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --force-new-deployment `
        --region $REGION `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($updateResult.service) {
        Write-Host "[OK] Service ECS en cours de redéploiement..." -ForegroundColor Green
        Write-Host ""
        Write-Host "[INFO] La migration sera exécutée automatiquement au démarrage du backend" -ForegroundColor Cyan
        Write-Host "[INFO] Vérifiez les logs pour confirmer l'exécution:" -ForegroundColor Yellow
        Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $REGION --follow" -ForegroundColor White
        Write-Host ""
        Write-Host "[INFO] Recherchez dans les logs:" -ForegroundColor Yellow
        Write-Host "   - 'Applying migration 20260206_fix_all_critical_errors_complete.sql'" -ForegroundColor White
        Write-Host "   - '✅ Index unique créé pour services_search_optimized_v2'" -ForegroundColor White
        Write-Host "   - '✅ Vue product_comments_view: OK'" -ForegroundColor White
    } else {
        Write-Host "[ERROR] Erreur lors du redéploiement" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Redéploiement lancé!" -ForegroundColor Green
Write-Host "[INFO] Attendez 2-3 minutes que le service redémarre" -ForegroundColor Yellow

