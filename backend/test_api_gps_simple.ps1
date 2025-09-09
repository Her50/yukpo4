# Script PowerShell pour tester l'API GPS
# ======================================

Write-Host "Test de l'API GPS via le backend..." -ForegroundColor Cyan

# URL du backend
$baseUrl = "http://127.0.0.1:3001"

# Test 1: Vérifier que le backend répond (test avec un endpoint existant)
Write-Host "Test 1: Verification de la connectivite du backend..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method GET -TimeoutSec 5
    Write-Host "Backend accessible: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    Write-Host "Reponse du backend: Status $statusCode - $errorMessage" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "Comportement normal: authentification requise" -ForegroundColor Green
    } else {
        Write-Host "Erreur inattendue: $errorMessage" -ForegroundColor Red
    }
}

# Test 2: Test de recherche GPS simple (sans authentification)
Write-Host "Test 2: Test de recherche GPS simple (sans auth)..." -ForegroundColor Green
try {
    $searchData = @{
        query = "restaurant"
        gps_zone = "4.0511,9.7679"
        radius_km = 50
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/search/direct" -Method POST -Body ($searchData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "Recherche GPS reussie: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    Write-Host "Reponse attendue (sans auth): Status $statusCode - $errorMessage" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "Comportement normal: authentification requise" -ForegroundColor Green
    } else {
        Write-Host "Erreur inattendue: $errorMessage" -ForegroundColor Red
    }
}

Write-Host "Tests termines!" -ForegroundColor Cyan
Write-Host "Consultez les logs du backend pour le diagnostic complet" -ForegroundColor Yellow 