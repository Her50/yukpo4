# Création d'embedding anglais sur la mécanique
Write-Host "Création d'embedding anglais sur la mécanique..." -ForegroundColor Green

$body = @{
    value = "Car Mechanic in Esseaka. I offer automobile repair and maintenance services in the city of Esseaka. My expertise covers a wide range of vehicles and I ensure to provide quality service to guarantee customer satisfaction."
    type_donnee = "texte"
    service_id = 161
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