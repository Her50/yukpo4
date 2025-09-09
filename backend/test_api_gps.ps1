# Script PowerShell pour tester l'API GPS directement
# =================================================

Write-Host "🔍 Test de l'API GPS via le backend..." -ForegroundColor Cyan

# URL du backend (d'apres les logs)
$baseUrl = "http://127.0.0.1:3001"

# Test 1: Vérifier que le backend répond
Write-Host "`n📡 Test 1: Vérification de la connectivité du backend..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend accessible: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Test de recherche GPS simple (sans authentification pour voir l'erreur)
Write-Host "`n🔍 Test 2: Test de recherche GPS simple (sans auth)..." -ForegroundColor Green
try {
    $searchData = @{
        query = "restaurant"
        gps_zone = "4.0511,9.7679"
        radius_km = 50
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/search/direct" -Method POST -Body ($searchData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✅ Recherche GPS réussie: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    Write-Host "ℹ️ Réponse attendue (sans auth): Status $statusCode - $errorMessage" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "✅ Comportement normal: authentification requise" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur inattendue: $errorMessage" -ForegroundColor Red
    }
}

# Test 3: Vérifier les logs du backend pour voir les erreurs GPS
Write-Host "`n📋 Test 3: Analyse des logs du backend..." -ForegroundColor Green
Write-Host "Regardez les logs du backend pour voir les erreurs GPS détaillées" -ForegroundColor Yellow
Write-Host "Les logs devraient montrer:" -ForegroundColor White
Write-Host "  - Si les fonctions SQL existent" -ForegroundColor White
Write-Host "  - Si extract_gps_from_json fonctionne" -ForegroundColor White
Write-Host "  - Si search_services_gps_final retourne des résultats" -ForegroundColor White

# Test 4: Vérifier la base de données via le backend
Write-Host "`n🗄️ Test 4: Vérification de la base via l'API..." -ForegroundColor Green
Write-Host "Pour tester complètement, vous devez:" -ForegroundColor Yellow
Write-Host "1. Vous connecter au frontend" -ForegroundColor White
Write-Host "2. Faire une recherche avec restaurant" -ForegroundColor White
Write-Host "3. Observer les logs du backend pour voir les erreurs SQL" -ForegroundColor White

Write-Host "`n🏁 Tests terminés!" -ForegroundColor Cyan
Write-Host "Consultez les logs du backend pour le diagnostic complet" -ForegroundColor Yellow 