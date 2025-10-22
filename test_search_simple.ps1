# Script de diagnostic simple pour la recherche de services
Write-Host "🔍 Diagnostic de la recherche de services" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# Test 1: Vérifier si le backend est accessible
Write-Host "`n📡 Test 1: Vérification du backend..." -ForegroundColor Green
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend accessible" -ForegroundColor Green
}
catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Vérifier les services existants
Write-Host "`n🗄️ Test 2: Vérification des services en base..." -ForegroundColor Green
try {
    $servicesResponse = Invoke-RestMethod -Uri "$baseUrl/api/services" -Method GET -TimeoutSec 10
    $servicesCount = if ($servicesResponse -is [array]) { $servicesResponse.Count } else { 0 }
    Write-Host "✅ Services trouvés en base: $servicesCount" -ForegroundColor Green
}
catch {
    Write-Host "❌ Erreur services: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test de recherche directe
Write-Host "`n🔍 Test 3: Test de recherche directe..." -ForegroundColor Green
$searchData = @{
    texte      = "restaurant"
    gps_mobile = $null
}

try {
    $searchResponse = Invoke-RestMethod -Uri "$baseUrl/api/search/direct" -Method POST -Body ($searchData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✅ Recherche réussie" -ForegroundColor Green
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "ℹ️ Status: $statusCode (attendu sans auth)" -ForegroundColor Yellow
}

Write-Host "`n🚀 Diagnostic terminé!" -ForegroundColor Cyan









