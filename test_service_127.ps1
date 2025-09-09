Write-Host "🔍 Test de recherche du service 127" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Test de recherche avec le titre du service
Write-Host "`n1️⃣ Test de recherche par titre..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNzAzMSwiaWF0IjoxNzU2Mzg5MjE1LCJleHAiOjE3NTY0NzU2MTV9.AjXWEtjjfNPKlKX_Ymtx_c747GepL0n7sfJHro11vfI"
}

$payload = @{
    message = "je cherche le service 127"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
    Write-Host "📊 Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
    
    if ($response.resultats) {
        Write-Host "🎯 Services trouvés:" -ForegroundColor Green
        foreach ($resultat in $response.resultats) {
            Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2️⃣ Test de recherche par description..." -ForegroundColor Yellow

$payload2 = @{
    message = "je cherche un service avec description"
    user_id = 1
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload2 -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
    Write-Host "📊 Nombre de résultats: $($response2.nombre_matchings)" -ForegroundColor Yellow
    
    if ($response2.resultats) {
        Write-Host "🎯 Services trouvés:" -ForegroundColor Green
        foreach ($resultat in $response2.resultats) {
            Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Test terminé !" -ForegroundColor Green
Write-Host "Le service 127 devrait maintenant apparaître dans les résultats de recherche." -ForegroundColor Cyan 