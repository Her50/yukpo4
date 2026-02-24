# Script de test pour l'endpoint de création de service
# Usage: .\scripts\test-endpoint-creation-service.ps1

param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app",
    [string]$Token = ""
)

Write-Host "=== TEST ENDPOINT CREATION SERVICE ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1. Test Health Check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$BackendUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Health check OK (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Health check FAILED: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: OPTIONS (preflight CORS)
Write-Host "2. Test OPTIONS (preflight CORS)..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = "https://yukpomnang.netlify.app"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type,authorization"
    }
    $optionsResponse = Invoke-WebRequest -Uri "$BackendUrl/api/ia/creation-service" -Method OPTIONS -Headers $headers -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ OPTIONS OK (Status: $($optionsResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Headers CORS:" -ForegroundColor Cyan
    $optionsResponse.Headers | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} catch {
    Write-Host "   ⚠️ OPTIONS FAILED: $_" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Test 3: POST vers /api/ia/creation-service
Write-Host "3. Test POST /api/ia/creation-service..." -ForegroundColor Yellow
$testBody = @{
    prompt = "Test création service - Réparation smartphone"
    user_id = "test-user-123"
} | ConvertTo-Json

$postHeaders = @{
    "Content-Type" = "application/json"
    "Origin" = "https://yukpomnang.netlify.app"
}

if ($Token) {
    $postHeaders["Authorization"] = "Bearer $Token"
}

try {
    $postResponse = Invoke-WebRequest -Uri "$BackendUrl/api/ia/creation-service" -Method POST -Headers $postHeaders -Body $testBody -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ POST OK (Status: $($postResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Cyan
    $responseContent = $postResponse.Content | ConvertFrom-Json
    $responseContent | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
} catch {
    Write-Host "   ❌ POST FAILED: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "   Status: $statusCode" -ForegroundColor Yellow
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Error Body: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "   Impossible de lire le body d'erreur" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== FIN DU TEST ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour surveiller les logs en temps reel:" -ForegroundColor Yellow
Write-Host "  gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend`" --project=yukpo-project" -ForegroundColor Gray

