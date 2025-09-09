# Création d'un service de pressing de test
Write-Host "Création d'un service de pressing de test" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Test direct du microservice pour obtenir les IDs
Write-Host "`n1. Récupération des IDs depuis Pinecone..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 5
    active = $true
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Réponse Pinecone reçue" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    # Extraire les IDs numériques
    $service_ids = @()
    foreach ($result in $response.results) {
        $pinecone_id = $result.id
        $score = $result.score
        
        # Extraire l'ID numérique (partie avant le underscore)
        if ($pinecone_id -match "^(\d+)_") {
            $numeric_id = $matches[1]
            $service_ids += $numeric_id
            Write-Host "ID Pinecone: $pinecone_id -> ID numérique: $numeric_id (score: $score)" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n2. Création d'un service de pressing de test..." -ForegroundColor Cyan
    
    # Créer un service de pressing avec l'ID 280093 (trouvé dans Pinecone)
    $test_service_id = 280093
    
    Write-Host "Création du service ID: $test_service_id" -ForegroundColor Yellow
    
    # Utiliser psql pour créer le service
    $sql_create = @"
INSERT INTO services (id, user_id, data, category, is_active, created_at, gps)
VALUES (
    $test_service_id,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Pressing à Douala", "origine_champs": "manuel"}, "description": {"type_donnee": "string", "valeur": "Service de pressing offrant nettoyage et repassage de vêtements à Douala. Service professionnel et rapide.", "origine_champs": "manuel"}, "prix": {"type_donnee": "string", "valeur": "5000 FCFA", "origine_champs": "manuel"}}'::jsonb,
    'Services de nettoyage',
    true,
    NOW(),
    'Douala, Cameroun'
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    gps = EXCLUDED.gps;
"@
    
    try {
        # Utiliser psql si disponible
        $result = & psql -h localhost -U postgres -d yukpomnang -c $sql_create 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Service $test_service_id créé/mis à jour dans PostgreSQL" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la création du service" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur psql: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   → psql non disponible ou erreur de connexion" -ForegroundColor Gray
    }
    
    Write-Host "`n3. Test de la recherche après création..." -ForegroundColor Cyan
    
    # Test avec l'API du backend (utiliser un token existant)
    $backend_headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNzY3NSwiaWF0IjoxNzU2MzgzNzA4LCJleHAiOjE3NTY0NzAxMDh9.cPDj7U1_b0nkMYqNQ-txKa5sigTK_-eDUq9YIVVpSx0"
    }
    
    $search_payload = @{
        message = "je cherche un pressing"
        user_id = 1
    } | ConvertTo-Json -Depth 10
    
    try {
        Write-Host "Envoi de la requête de recherche..." -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $backend_headers -Body $search_payload -TimeoutSec 30
        
        Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
        Write-Host "Intention: $($response.intention)" -ForegroundColor Gray
        Write-Host "Message: $($response.message)" -ForegroundColor Gray
        
        if ($response.resultats.Count -gt 0) {
            Write-Host "`nRésultats trouvés:" -ForegroundColor Green
            foreach ($resultat in $response.resultats) {
                Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Gray
            }
        } else {
            Write-Host "`n❌ Aucun résultat trouvé" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "Code d'erreur: $statusCode" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
} 