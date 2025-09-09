# Test direct de l'API de recherche
Write-Host "Test direct de l'API de recherche" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Test avec l'API du backend
Write-Host "`n1. Test de l'API de recherche..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNzY3NSwiaWF0IjoxNzU2MzgzNzA4LCJleHAiOjE3NTY0NzAxMDh9.cPDj7U1_b0nkMYqNQ-txKa5sigTK_-eDUq9YIVVpSx0"
}

$payload = @{
    message = "je cherche un pressing"
    user_id = 1
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requête de recherche..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
    Write-Host "Intention: $($response.intention)" -ForegroundColor Gray
    Write-Host "Message: $($response.message)" -ForegroundColor Gray
    
    if ($response.resultats.Count -gt 0) {
        Write-Host "`nRésultats trouvés:" -ForegroundColor Green
        foreach ($resultat in $response.resultats) {
            Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n❌ Aucun résultat trouvé" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Code d'erreur: $statusCode" -ForegroundColor Red
    }
} 