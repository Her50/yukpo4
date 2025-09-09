# Script de test pour la recherche SQL
Write-Host "🧪 Test de la recherche SQL..." -ForegroundColor Green

# Token JWT valide (utilisateur 1)
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxOTkxMiwiaWF0IjoxNzU2MzcxNDQ2LCJleHAiOjE3NTY0NTc4NDZ9.wr9OeNDKq4pQ45Ttzj6cUQF2AMF5ZDEezawiBZD_a0I"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    "message" = "Je cherche un salon de coiffure"
} | ConvertTo-Json

Write-Host "📡 Envoi de la requête de recherche..." -ForegroundColor Cyan
Write-Host "🔍 Recherche: 'Je cherche un salon de coiffure'" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue!" -ForegroundColor Green
    Write-Host "📊 Intention détectée: $($response.intention)" -ForegroundColor Cyan
    Write-Host "💬 Message: $($response.message)" -ForegroundColor Yellow
    
    if ($response.resultats) {
        Write-Host "🎯 Services trouvés: $($response.resultats.Count)" -ForegroundColor Green
        foreach ($service in $response.resultats) {
            Write-Host "   - ID: $($service.id), Titre: $($service.titre), Catégorie: $($service.category)" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Aucun service trouvé" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "📄 Détails: $responseBody" -ForegroundColor Red
    }
} 