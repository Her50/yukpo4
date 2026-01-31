# Script de test pour vérifier la connexion Mobile → Backend AWS → PostgreSQL
# Date: 2026-01-30
# Usage: .\scripts\test_backend_aws.ps1

$ALB_URL = "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Test de Connexion Backend AWS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "URL: $ALB_URL/health" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$ALB_URL/health" -Method GET -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health Check: OK (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "   Réponse: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Health Check: Échec (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health Check: Erreur - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Vérifiez que l'ALB est accessible depuis Internet" -ForegroundColor Yellow
}
Write-Host ""

# Test 2: Endpoint d'inscription (sans données valides, juste pour tester la route)
Write-Host "Test 2: Endpoint d'inscription (test de route)" -ForegroundColor Yellow
Write-Host "URL: $ALB_URL/api/auth/register" -ForegroundColor Gray
try {
    $body = @{
        email = "test@example.com"
        password = "Test1234!"
        nom = "Test"
        prenom = "User"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$ALB_URL/api/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
    Write-Host "✅ Endpoint accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "   Réponse: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "✅ Endpoint accessible (400 Bad Request attendu - email déjà utilisé ou données invalides)" -ForegroundColor Green
        Write-Host "   Cela signifie que la route fonctionne, mais les données sont invalides" -ForegroundColor Gray
    } elseif ($statusCode -eq 500) {
        Write-Host "⚠️ Endpoint accessible mais erreur serveur (500)" -ForegroundColor Yellow
        Write-Host "   Problème probable: Base de données non accessible ou erreur backend" -ForegroundColor Yellow
    } elseif ($statusCode -eq 404) {
        Write-Host "❌ Endpoint non trouvé (404)" -ForegroundColor Red
        Write-Host "   La route /api/auth/register n'existe pas" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Vérifier les headers CORS
Write-Host "Test 3: Headers CORS" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ALB_URL/health" -Method OPTIONS -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ OPTIONS request: OK" -ForegroundColor Green
    Write-Host "   Headers CORS:" -ForegroundColor Gray
    if ($response.Headers['Access-Control-Allow-Origin']) {
        Write-Host "   - Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
    }
    if ($response.Headers['Access-Control-Allow-Methods']) {
        Write-Host "   - Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ OPTIONS request: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Résumé
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Résumé" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si tous les tests passent:" -ForegroundColor Green
Write-Host "  ✅ L'ALB est accessible depuis Internet" -ForegroundColor Green
Write-Host "  ✅ Le backend répond aux requêtes" -ForegroundColor Green
Write-Host "  ✅ Les routes sont correctement montées" -ForegroundColor Green
Write-Host ""
Write-Host "Si des tests échouent:" -ForegroundColor Yellow
Write-Host "  1. Vérifiez les Security Groups ALB (autoriser HTTPS 443 depuis 0.0.0.0/0)" -ForegroundColor Yellow
Write-Host "  2. Vérifiez que le Target Group pointe vers des instances ECS healthy" -ForegroundColor Yellow
Write-Host "  3. Vérifiez les logs CloudWatch du service ECS" -ForegroundColor Yellow
Write-Host "  4. Vérifiez que DATABASE_URL est correcte dans la Task Definition ECS" -ForegroundColor Yellow
Write-Host ""

