Write-Host "Test de recherche du service 127" -ForegroundColor Cyan

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
    
    Write-Host "Reponse recue du backend" -ForegroundColor Green
    Write-Host "Nombre de resultats: $($response.nombre_matchings)" -ForegroundColor Yellow
    
    if ($response.resultats) {
        Write-Host "Services trouves:" -ForegroundColor Green
        foreach ($resultat in $response.resultats) {
            Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "Aucun resultat trouve" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test termine!" -ForegroundColor Green 