# Test simple de vectorisation d'un service de coiffure
Write-Host "Test de vectorisation d'un service de coiffure..." -ForegroundColor Green

$headers = @{
    "x-api-key" = "yukpo_embedding_key_2024"
    "Content-Type" = "application/json"
}

# Service de coiffure à vectoriser
$payload = @{
    service_id = "122"
    text = "Salon de coiffure à Bayangam Un salon de coiffure offrant divers services de coiffure et de soins capillaires à Bayangam. Beauté et soins personnels"
    type_donnee = "text"
} | ConvertTo-Json

Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $payload

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/add_embedding_pinecone" -Method POST -Headers $headers -Body $payload
    Write-Host "✅ Service vectorisé avec succès" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test terminé!" -ForegroundColor Green 