# Test de la recherche après correction
Write-Host "Test de la recherche après correction..." -ForegroundColor Green

$searchRequest = @{
    texte = "Je cherche un mécanicien"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $searchRequest -Headers $headers
    Write-Host "Recherche réussie!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 2)"
    
    if ($response.resultats -and $response.resultats.results -and $response.resultats.results.Count -gt 0) {
        Write-Host "🎉 SUCCÈS: Résultats trouvés!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.resultats.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
} 