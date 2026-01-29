# Script pour tester l'endpoint backend AWS
param(
    [string]$BaseUrl = "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
)

Write-Host "🔍 Test de l'endpoint backend AWS..." -ForegroundColor Cyan
Write-Host "URL de base: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health check
Write-Host "1️⃣ Test du health check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$BaseUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Health check OK" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.StatusCode)" -ForegroundColor Gray
    Write-Host "   Content: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Health check échoué" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Endpoint de création de compte
Write-Host "2️⃣ Test de l'endpoint de création de compte..." -ForegroundColor Yellow
$registerBody = @{
    email = "test-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    password = "Test123!@#"
    name = "Test User"
} | ConvertTo-Json

Write-Host "   Données de test:" -ForegroundColor Cyan
Write-Host "   Email: $($registerBody.email)" -ForegroundColor Gray
Write-Host ""

try {
    $registerResponse = Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method POST -Body $registerBody -ContentType "application/json" -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Création de compte réussie!" -ForegroundColor Green
    Write-Host "   Status: $($registerResponse.StatusCode)" -ForegroundColor Gray
    Write-Host "   Response: $($registerResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Création de compte échouée" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        # Lire le contenu de l'erreur si disponible
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorContent = $reader.ReadToEnd()
            Write-Host "   Error Content: $errorContent" -ForegroundColor Red
        } catch {
            Write-Host "   Impossible de lire le contenu de l'erreur" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# Test 3: Vérifier si l'endpoint existe (OPTIONS pour CORS)
Write-Host "3️⃣ Test CORS (OPTIONS)..." -ForegroundColor Yellow
try {
    $optionsResponse = Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method OPTIONS -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ OPTIONS OK" -ForegroundColor Green
    Write-Host "   Status: $($optionsResponse.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  OPTIONS non disponible (normal si CORS n'est pas configuré)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Tests terminés" -ForegroundColor Green

