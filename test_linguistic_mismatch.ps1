# Test du problème de cohérence linguistique
Write-Host "Test du problème de cohérence linguistique..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Vérifier la clé Google Translate
Write-Host "`n1️⃣ Vérification de la clé Google Translate..." -ForegroundColor Yellow
$google_key = $env:GOOGLE_TRANSLATE_API_KEY
if ($google_key) {
    Write-Host "✅ GOOGLE_TRANSLATE_API_KEY présente: $($google_key.Substring(0,10))..." -ForegroundColor Green
} else {
    Write-Host "❌ GOOGLE_TRANSLATE_API_KEY ABSENTE!" -ForegroundColor Red
    Write-Host "C'est le problème principal : la traduction échoue" -ForegroundColor Red
}

# 2. Test de création d'embedding avec texte français
Write-Host "`n2️⃣ Test création d'embedding avec texte français..." -ForegroundColor Yellow

$createRequest = @{
    value = "Je suis un mécanicien automobile à Esseaka. Je propose des services de réparation et d'entretien automobile."
    type_donnee = "texte"
    service_id = 666
    langue = "fra"
    active = $true
    type_metier = "service"
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $createRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Embedding créé avec succès!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)"
    
    if ($response.simulated) {
        Write-Host "⚠️ ATTENTION: Embedding simulé - Pinecone n'est pas configuré" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur création embedding: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test de recherche avec le même texte français
Write-Host "`n3️⃣ Test de recherche avec le même texte français..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$searchRequest = @{
    query = "Je suis un mécanicien automobile à Esseaka. Je propose des services de réparation et d'entretien automobile."
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $searchResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
    Write-Host "Recherche résultat: $($searchResponse | ConvertTo-Json)"
    
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        Write-Host "✅ Résultats trouvés avec texte français!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($searchResponse.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé avec texte français" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Test de recherche avec texte anglais équivalent
Write-Host "`n4️⃣ Test de recherche avec texte anglais équivalent..." -ForegroundColor Yellow

$searchRequestEn = @{
    query = "I am a car mechanic in Esseaka. I offer automobile repair and maintenance services."
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $searchResponseEn = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequestEn -ContentType "application/json" -Headers $headers
    Write-Host "Recherche anglais résultat: $($searchResponseEn | ConvertTo-Json)"
    
    if ($searchResponseEn.results -and $searchResponseEn.results.Count -gt 0) {
        Write-Host "✅ Résultats trouvés avec texte anglais!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($searchResponseEn.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé avec texte anglais" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur recherche anglais: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test de recherche avec termes simples
Write-Host "`n5️⃣ Test de recherche avec termes simples..." -ForegroundColor Yellow

$simpleTerms = @("mécanicien", "mechanic", "automobile", "car", "réparation", "repair")

foreach ($term in $simpleTerms) {
    Write-Host "`nTest avec: '$term'" -ForegroundColor Cyan
    
    $searchRequest = @{
        query = $term
        type_donnee = "texte"
        top_k = 5
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
        
        if ($response.results -and $response.results.Count -gt 0) {
            Write-Host "✅ Trouvé $($response.results.Count) résultats avec '$term'" -ForegroundColor Green
        } else {
            Write-Host "❌ Aucun résultat avec '$term'" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur avec '$term': $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Diagnostic du problème:" -ForegroundColor Cyan
Write-Host "1. GOOGLE_TRANSLATE_API_KEY absente = traduction impossible" -ForegroundColor Red
Write-Host "2. Texte français envoyé à Pinecone qui contient des embeddings anglais" -ForegroundColor Red
Write-Host "3. Incohérence linguistique = recherche impossible" -ForegroundColor Red
Write-Host "`n💡 Solution:" -ForegroundColor Green
Write-Host "Il faut soit:" -ForegroundColor Yellow
Write-Host "- Configurer GOOGLE_TRANSLATE_API_KEY pour traduire les requêtes" -ForegroundColor Yellow
Write-Host "- Ou stocker les embeddings dans la langue originale (français)" -ForegroundColor Yellow
Write-Host "- Ou désactiver la traduction automatique" -ForegroundColor Yellow 