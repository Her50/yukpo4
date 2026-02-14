# Script pour tester les endpoints de l'application
# Date: 2026-02-13

Write-Host "🔍 Test des Endpoints de l'Application Yukpomnang" -ForegroundColor Cyan
Write-Host ""

# 1. Récupérer l'URL du Load Balancer
Write-Host "📡 Récupération de l'URL du Load Balancer..." -ForegroundColor Yellow
$lbDns = aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`)].DNSName' `
    --output text

if ([string]::IsNullOrEmpty($lbDns)) {
    Write-Host "❌ Aucun Load Balancer trouvé" -ForegroundColor Red
    Write-Host "   Vérifiez que le Load Balancer est configuré dans Terraform" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Load Balancer trouvé: $lbDns" -ForegroundColor Green
Write-Host ""

# 2. Tester le Health Check
Write-Host "🏥 Test du Health Check..." -ForegroundColor Yellow
$healthUrl = "http://$lbDns/health"
try {
    $healthResponse = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Health Check réussi!" -ForegroundColor Green
    Write-Host "   Status Code: $($healthResponse.StatusCode)" -ForegroundColor Gray
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check échoué" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   URL: $healthUrl" -ForegroundColor Yellow
}

Write-Host ""

# 3. Tester l'endpoint root
Write-Host "🏠 Test de l'endpoint root..." -ForegroundColor Yellow
$rootUrl = "http://$lbDns/"
try {
    $rootResponse = Invoke-WebRequest -Uri $rootUrl -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Endpoint root accessible!" -ForegroundColor Green
    Write-Host "   Status Code: $($rootResponse.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Endpoint root non accessible (peut être normal si pas de route définie)" -ForegroundColor Yellow
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# 4. Vérifier le statut ECS
Write-Host "📊 Vérification du statut ECS..." -ForegroundColor Yellow
$ecsStatus = aws ecs describe-services `
    --cluster yukpo-cluster `
    --services yukpo-backend-service `
    --region eu-west-1 `
    --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount}' `
    --output json | ConvertFrom-Json

Write-Host "   Status: $($ecsStatus.Status)" -ForegroundColor $(if ($ecsStatus.Status -eq "ACTIVE") { "Green" } else { "Red" })
Write-Host "   Running Count: $($ecsStatus.RunningCount)" -ForegroundColor $(if ($ecsStatus.RunningCount -gt 0) { "Green" } else { "Red" })
Write-Host "   Desired Count: $($ecsStatus.DesiredCount)" -ForegroundColor Gray

if ($ecsStatus.RunningCount -eq 0) {
    Write-Host ""
    Write-Host "⚠️ Aucune tâche en cours d'exécution!" -ForegroundColor Yellow
    Write-Host "   Le service doit être redémarré" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Tests terminés" -ForegroundColor Cyan

