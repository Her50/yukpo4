# Script pour vectoriser les services en attente
Write-Host "Vectorisation des services en attente..." -ForegroundColor Green

# Récupérer les services en attente
$query = @"
SELECT 
    id,
    data->>'titre_service' as titre,
    (data->'description'->>'valeur') as description,
    (data->'category'->>'valeur') as category
FROM services 
WHERE embedding_status = 'pending'
ORDER BY created_at DESC
LIMIT 10
"@

# Exécuter la requête SQL
$services = psql -h localhost -U postgres -d yukpo_db -t -c $query

Write-Host "Services trouvés:" -ForegroundColor Yellow
Write-Host $services

# Vectoriser chaque service via l'API
$headers = @{
    "x-api-key" = "yukpo_embedding_key_2024"
    "Content-Type" = "application/json"
}

foreach ($service in $services) {
    if ($service -match "(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)$") {
        $id = $matches[1]
        $titre = $matches[2].Trim()
        $description = $matches[3].Trim()
        $category = $matches[4].Trim()
        
        Write-Host "Vectorisation du service $id : $titre" -ForegroundColor Cyan
        
        $textToVectorize = "$titre $description $category"
        
        $payload = @{
            service_id = $id
            text = $textToVectorize
            type_donnee = "text"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8000/add_embedding_pinecone" -Method POST -Headers $headers -Body $payload
            Write-Host "✅ Service $id vectorisé avec succès" -ForegroundColor Green
        } catch {
            Write-Host "❌ Erreur vectorisation service $id : $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "Vectorisation terminée!" -ForegroundColor Green 