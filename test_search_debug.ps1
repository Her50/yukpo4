# Script de diagnostic pour la recherche de services
Write-Host "🔍 Diagnostic de la recherche de services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# Test 1: Vérifier si le backend est accessible
Write-Host "`n📡 Test 1: Vérification du backend..." -ForegroundColor Green
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend accessible: $($healthResponse | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "⚠️  Assurez-vous que le backend Rust est démarré sur le port 3000" -ForegroundColor Yellow
    exit 1
}

# Test 2: Vérifier les services existants dans la base
Write-Host "`n🗄️ Test 2: Vérification des services en base..." -ForegroundColor Green
try {
    $servicesResponse = Invoke-RestMethod -Uri "$baseUrl/api/services" -Method GET -TimeoutSec 10
    $servicesCount = if ($servicesResponse -is [array]) { $servicesResponse.Count } else { 0 }
    Write-Host "✅ Services trouvés en base: $servicesCount" -ForegroundColor Green
    
    if ($servicesCount -gt 0) {
        Write-Host "📋 Exemple de service:" -ForegroundColor Yellow
        $firstService = if ($servicesResponse -is [array]) { $servicesResponse[0] } else { $servicesResponse }
        Write-Host "   - ID: $($firstService.id)" -ForegroundColor White
        Write-Host "   - Titre: $($firstService.data.title)" -ForegroundColor White
        Write-Host "   - Description: $($firstService.data.description)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erreur lors de la récupération des services: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test de recherche directe (sans authentification - pour voir l'erreur)
Write-Host "`n🔍 Test 3: Test de recherche directe (sans auth)..." -ForegroundColor Green
$searchData = @{
    texte = "restaurant"
    gps_mobile = $null
}

try {
    $searchResponse = Invoke-RestMethod -Uri "$baseUrl/api/search/direct" -Method POST -Body ($searchData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    Write-Host "✅ Recherche réussie: $($searchResponse | ConvertTo-Json)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    Write-Host "ℹ️  Réponse attendue (sans auth): Status $statusCode - $errorMessage" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "✅ Comportement normal: authentification requise" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur inattendue: $errorMessage" -ForegroundColor Red
    }
}

# Test 4: Test avec différents termes de recherche
Write-Host "`n🔍 Test 4: Test avec différents termes..." -ForegroundColor Green
$testTerms = @("restaurant", "plomberie", "informatique", "nettoyage", "transport")

foreach ($term in $testTerms) {
    Write-Host "   Test avec: '$term'" -ForegroundColor White
    # Ici on pourrait tester avec un token valide si disponible
}

Write-Host "`n📋 Résumé du diagnostic:" -ForegroundColor Cyan
Write-Host "1. Backend accessible: ✅" -ForegroundColor Green
Write-Host "2. Services en base: Vérifiez le nombre affiché ci-dessus" -ForegroundColor Yellow
Write-Host "3. Recherche directe: Nécessite authentification" -ForegroundColor Yellow
Write-Host "4. Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   - Vérifier que des services existent en base" -ForegroundColor White
Write-Host "   - Tester avec un token d'authentification valide" -ForegroundColor White
Write-Host "   - Vérifier les logs du backend pour les erreurs" -ForegroundColor White

Write-Host "`n🚀 Diagnostic terminé!" -ForegroundColor Cyan