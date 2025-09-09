# Création d'embedding français sur la mécanique
Write-Host "Création d'embedding français sur la mécanique..." -ForegroundColor Green

$body = @{
    value = "Mécanicien Automobile à Esseaka. Je propose des services de réparation et d'entretien automobile dans la ville d'Esseaka. Mon expertise couvre une large gamme de véhicules et je m'assure de fournir un service de qualité pour garantir la satisfaction de mes clients."
    type_donnee = "texte"
    service_id = 160
    langue = "fra"
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