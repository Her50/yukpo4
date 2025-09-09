# Script pour forcer l'embedding du service électrique 155
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDk0NiwiaWF0IjoxNzU2NTEwODc0LCJleHAiOjE3NTY1OTcyNzR9.4x7j--DGV5L-bGqudXvwF-WArpe8FpO8mFHVLhdDE-0"

Write-Host "🔌 Forçage de l'embedding du service électrique 155..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/services/155/embed" -Method POST -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    Write-Host "✅ Service 155 vectorisé avec succès!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Erreur lors de la vectorisation: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "🔍 Vérification du statut d'embedding..." -ForegroundColor Yellow

try {
    $statusResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/services/155" -Method GET -Headers @{
        "Authorization" = "Bearer $token"
    }
    
    Write-Host "📊 Statut du service 155:" -ForegroundColor Cyan
    Write-Host "ID: $($statusResponse.id)" -ForegroundColor White
    Write-Host "Catégorie: $($statusResponse.category)" -ForegroundColor White
    Write-Host "Titre: $($statusResponse.data.titre_service.valeur)" -ForegroundColor White
    Write-Host "Statut embedding: $($statusResponse.embedding_status)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Erreur lors de la vérification: $($_.Exception.Message)" -ForegroundColor Red
} 