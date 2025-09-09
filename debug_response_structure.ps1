# Debug de la structure de réponse
Write-Host "Debug de la structure de réponse..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# 1. Test direct du microservice
Write-Host "`n1️⃣ Test direct du microservice..." -ForegroundColor Yellow

$searchRequest = @{
    query = "Je cherche un mécanicien"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Réponse du microservice reçue" -ForegroundColor Green
    Write-Host "Structure de la réponse:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    if ($response.results -and $response.results.Count -gt 0) {
        Write-Host "`n📊 Résultats trouvés:" -ForegroundColor Green
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`n❌ Aucun résultat dans la réponse du microservice" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Test de la réponse du backend
Write-Host "`n2️⃣ Test de la réponse du backend..." -ForegroundColor Yellow

$backendRequest = @{
    texte = "Je cherche un mécanicien"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

$backendHeaders = @{
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
    "Content-Type" = "application/json"
}

try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $backendRequest -Headers $backendHeaders
    Write-Host "✅ Réponse du backend reçue" -ForegroundColor Green
    Write-Host "Structure de la réponse backend:" -ForegroundColor Cyan
    $backendResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    # Analyser la structure
    if ($backendResponse.resultats) {
        Write-Host "`n🔍 Analyse de 'resultats':" -ForegroundColor Yellow
        $resultats = $backendResponse.resultats
        
        if ($resultats.detail) {
            Write-Host "  ❌ 'detail' trouvé: $($resultats.detail)" -ForegroundColor Red
        }
        
        if ($resultats.results) {
            Write-Host "  ✅ 'results' trouvé avec $($resultats.results.Count) éléments" -ForegroundColor Green
        }
        
        # Vérifier tous les champs
        $resultats.PSObject.Properties | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n❌ Pas de champ 'resultats' dans la réponse" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Comparaison des structures
Write-Host "`n3️⃣ Comparaison des structures..." -ForegroundColor Yellow
Write-Host "Microservice retourne: {'results': [...]}" -ForegroundColor Cyan
Write-Host "Backend devrait retourner: {'resultats': {'results': [...]}}" -ForegroundColor Cyan
Write-Host "Backend retourne actuellement: {'resultats': {'detail': 'Not Found'}}" -ForegroundColor Red

Write-Host "`n🎯 Diagnostic:" -ForegroundColor Cyan
Write-Host "Le problème est que le backend remplace la réponse du microservice" -ForegroundColor Red
Write-Host "par {'detail': 'Not Found'} quelque part dans le code" -ForegroundColor Red
Write-Host "Il faut chercher où cette substitution se produit" -ForegroundColor Yellow 