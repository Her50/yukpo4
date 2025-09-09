# Test d'ajout d'embedding à Pinecone
Write-Host "Test d'ajout d'embedding à Pinecone..." -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    value = "Mécanicien automobile à Esseaka"
    type_donnee = "texte"
    service_id = 999
    gps_lat = $null
    gps_lon = $null
    langue = "fra"
    unite = $null
    devise = $null
    active = $true
    type_metier = "service"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Headers $headers -Body $payload
    Write-Host "Réponse ajout embedding:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Erreur:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} 