# Test de création d'embeddings
Write-Host "Test de création d'embeddings..." -ForegroundColor Green

$body = @{
    value = "Test embedding"
    type_donnee = "texte"
    service_id = 123
    langue = "en"
    active = $true
    type_metier = "service"
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Création réussie: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Erreur création: $($_.Exception.Message)" -ForegroundColor Red
} 