Write-Host "Test du parcours complet : Création → Recherche" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Créer un service de test
Write-Host "`n1️⃣ Création d'un service de test..." -ForegroundColor Yellow

$testService = @{
    user_id = 1
    data = @{
        titre = @{
            type_donnee = "string"
            valeur = "Pressing Express Test"
            origine_champs = "texte_libre"
        }
        description = @{
            type_donnee = "string"
            valeur = "Service de pressing rapide pour test de synchronisation"
            origine_champs = "texte_libre"
        }
        prix = @{
            type_donnee = "string"
            valeur = "3000 FCFA"
            origine_champs = "texte_libre"
        }
        intention = "service"
    }
    category = "Services de nettoyage"
    gps = "Douala, Cameroun"
    is_active = $true
}

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"
}

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/services" -Method POST -Headers $headers -Body ($testService | ConvertTo-Json -Depth 10) -TimeoutSec 30
    
    Write-Host "✅ Service créé avec succès" -ForegroundColor Green
    Write-Host "Service ID: $($createResponse.service_id)" -ForegroundColor Gray
    Write-Host "Message: $($createResponse.message)" -ForegroundColor Gray
    
    $serviceId = $createResponse.service_id
    
    # 2. Attendre que les embeddings soient traités
    Write-Host "`n2️⃣ Attente du traitement des embeddings..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # 3. Vérifier que le service existe dans PostgreSQL
    Write-Host "`n3️⃣ Vérification dans PostgreSQL..." -ForegroundColor Yellow
    
    try {
        $pgResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/services/$serviceId" -Method GET -Headers $headers -TimeoutSec 30
        Write-Host "✅ Service trouvé dans PostgreSQL" -ForegroundColor Green
        Write-Host "Titre: $($pgResponse.titre)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Service non trouvé dans PostgreSQL" -ForegroundColor Red
        Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 4. Vérifier que le service existe dans Pinecone
    Write-Host "`n4️⃣ Vérification dans Pinecone..." -ForegroundColor Yellow
    
    $pineconeHeaders = @{
        "Content-Type" = "application/json"
        "x-api-key" = "yukpo_embedding_key_2024"
    }
    
    $searchPayload = @{
        query = "Pressing Express Test"
        type_donnee = "texte"
        top_k = 5
    } | ConvertTo-Json
    
    try {
        $pineconeResponse = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $pineconeHeaders -Body $searchPayload -TimeoutSec 30
        
        $foundInPinecone = $false
        foreach ($result in $pineconeResponse.results) {
            if ($result.id -eq "$serviceId`_texte") {
                $foundInPinecone = $true
                Write-Host "✅ Service trouvé dans Pinecone" -ForegroundColor Green
                Write-Host "ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
                break
            }
        }
        
        if (-not $foundInPinecone) {
            Write-Host "❌ Service non trouvé dans Pinecone" -ForegroundColor Red
            Write-Host "Résultats trouvés:" -ForegroundColor Gray
            foreach ($result in $pineconeResponse.results) {
                Write-Host "  - $($result.id) (score: $($result.score))" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "❌ Erreur lors de la vérification Pinecone" -ForegroundColor Red
        Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 5. Test de recherche via l'API backend
    Write-Host "`n5️⃣ Test de recherche via l'API backend..." -ForegroundColor Yellow
    
    $searchPayload = @{
        message = "je cherche un pressing express"
        user_id = 1
    } | ConvertTo-Json
    
    try {
        $searchResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $searchPayload -TimeoutSec 30
        
        Write-Host "✅ Recherche effectuée" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($searchResponse.nombre_matchings)" -ForegroundColor Yellow
        Write-Host "Message: $($searchResponse.message)" -ForegroundColor Gray
        
        if ($searchResponse.resultats -and $searchResponse.resultats.Count -gt 0) {
            Write-Host "Résultats trouvés:" -ForegroundColor Green
            foreach ($result in $searchResponse.resultats) {
                Write-Host "  - ID: $($result.id), Titre: $($result.titre)" -ForegroundColor Gray
            }
        } else {
            Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lors de la recherche" -ForegroundColor Red
        Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors de la création du service" -ForegroundColor Red
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Test du parcours complet terminé" -ForegroundColor Green 