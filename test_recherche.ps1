# Script de test pour la recherche de services
Write-Host "🧪 Test de recherche de services" -ForegroundColor Green

$baseUrl = "http://localhost:3001"
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MzU0NzI4MDB9.2QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8QJ8"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

$body = @{
    "texte" = "Je cherche un salon de coiffure"
} | ConvertTo-Json

Write-Host "Envoi de la requête..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/yukpo" -Method POST -Headers $headers -Body $body
    Write-Host "✅ Réponse reçue:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Erreur:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Corps de la réponse:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
} 