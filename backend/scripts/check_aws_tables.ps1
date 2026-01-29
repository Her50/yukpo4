# Script pour vérifier les tables via le backend AWS
param(
    [string]$BackendURL = "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1"
)

Write-Host "🔍 Vérification des tables via le backend AWS..." -ForegroundColor Cyan
Write-Host ""

# Méthode 1: Via l'endpoint /health ou /api/debug/tables si disponible
Write-Host "1️⃣ Tentative de connexion au backend via ALB..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$BackendURL/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Backend accessible - Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    
    # Essayer un endpoint de debug si disponible
    try {
        $debugResponse = Invoke-WebRequest -Uri "$BackendURL/api/debug/tables" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "   ✅ Endpoint debug disponible" -ForegroundColor Green
        Write-Host $debugResponse.Content
    } catch {
        Write-Host "   ⚠️  Endpoint /api/debug/tables non disponible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "2️⃣ Vérification de l'état ECS..." -ForegroundColor Yellow
    
    # Vérifier l'état ECS
    try {
        $serviceInfo = aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $Region --query 'services[0]' --output json 2>&1 | ConvertFrom-Json
        
        if ($serviceInfo) {
            Write-Host "   Service: $($serviceInfo.serviceName)" -ForegroundColor Cyan
            Write-Host "   Statut: $($serviceInfo.status)" -ForegroundColor $(if ($serviceInfo.status -eq "ACTIVE") { "Green" } else { "Yellow" })
            Write-Host "   Tâches désirées: $($serviceInfo.desiredCount)" -ForegroundColor Cyan
            Write-Host "   Tâches en cours: $($serviceInfo.runningCount)" -ForegroundColor $(if ($serviceInfo.runningCount -gt 0) { "Green" } else { "Red" })
            
            if ($serviceInfo.runningCount -eq 0) {
                Write-Host ""
                Write-Host "   ⚠️  Aucune tâche ECS en cours - le backend n'est pas démarré" -ForegroundColor Yellow
                Write-Host "   💡 Pour démarrer le service:" -ForegroundColor Cyan
                Write-Host "      aws ecs update-service --cluster $ClusterName --service $ServiceName --desired-count 1 --region $Region --force-new-deployment" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "   ❌ Impossible de vérifier l'état ECS: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "3️⃣ Vérification directe de la base de données RDS..." -ForegroundColor Yellow
    Write-Host "   💡 Pour vérifier directement la DB, utilisez:" -ForegroundColor Cyan
    Write-Host "      psql `$DATABASE_URL -f backend/scripts/check_migration_status.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Ou via AWS Systems Manager Session Manager si configuré" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Green

