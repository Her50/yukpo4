# Redémarrage du backend avec le bon seuil de matching
Write-Host "Redémarrage du backend avec le bon seuil..." -ForegroundColor Green

# 1. Arrêter le backend actuel
Write-Host "`n1️⃣ Arrêt du backend actuel..." -ForegroundColor Yellow
try {
    Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"} | Stop-Process -Force
    Write-Host "✅ Backend arrêté" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Aucun backend à arrêter" -ForegroundColor Yellow
}

# 2. Configurer les variables d'environnement
Write-Host "`n2️⃣ Configuration des variables d'environnement..." -ForegroundColor Yellow
$env:MATCHING_SCORE_THRESHOLD = "0.1"
$env:PINECONE_API_KEY = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV = "us-east-1"
$env:PINECONE_INDEX = "service-embeddings"

Write-Host "✅ Variables configurées:" -ForegroundColor Green
Write-Host "MATCHING_SCORE_THRESHOLD: $env:MATCHING_SCORE_THRESHOLD" -ForegroundColor Cyan

# 3. Redémarrer le backend
Write-Host "`n3️⃣ Redémarrage du backend..." -ForegroundColor Yellow
Set-Location "backend"

try {
    $process = Start-Process -FilePath "cargo" -ArgumentList "run" -PassThru -WindowStyle Hidden
    Write-Host "✅ Backend redémarré (PID: $($process.Id))" -ForegroundColor Green
    
    # Attendre que le backend soit prêt
    Write-Host "⏳ Attente du démarrage du backend..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
} catch {
    Write-Host "❌ Erreur redémarrage: $($_.Exception.Message)" -ForegroundColor Red
}

Set-Location ".."

# 4. Tester la recherche sémantique
Write-Host "`n4️⃣ Test de la recherche sémantique..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $searchRequest = @{
        texte = "Je cherche un mecanicien"
        base64_image = @()
        doc_base64 = @()
        excel_base64 = @()
    } | ConvertTo-Json
    
    $headers = @{
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $searchRequest -Headers $headers
    Write-Host "✅ Recherche réussie!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 2)"
    
    if ($response.resultats -and $response.resultats.results -and $response.resultats.results.Count -gt 0) {
        Write-Host "🎉 SUCCÈS: Résultats trouvés dans la recherche sémantique!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.resultats.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé:" -ForegroundColor Cyan
Write-Host "Si des résultats sont trouvés, la recherche sémantique fonctionne!" -ForegroundColor Green
Write-Host "Si aucun résultat n'est trouvé, il y a encore un problème" -ForegroundColor Yellow 