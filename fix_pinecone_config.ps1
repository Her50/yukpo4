# Correction de la configuration Pinecone
Write-Host "Correction de la configuration Pinecone..." -ForegroundColor Green

# 1. Arrêter le microservice actuel
Write-Host "`n1️⃣ Arrêt du microservice actuel..." -ForegroundColor Yellow
try {
    Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*"} | Stop-Process -Force
    Write-Host "✅ Microservice arrêté" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Aucun microservice à arrêter" -ForegroundColor Yellow
}

# 2. Définir les variables d'environnement Pinecone
Write-Host "`n2️⃣ Configuration des variables d'environnement Pinecone..." -ForegroundColor Yellow
$env:PINECONE_API_KEY = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV = "us-east-1"
$env:PINECONE_INDEX = "service-embeddings"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
$env:MATCHING_SCORE_THRESHOLD = "0.5"

Write-Host "✅ Variables d'environnement configurées:" -ForegroundColor Green
Write-Host "PINECONE_API_KEY: $($env:PINECONE_API_KEY.Substring(0,10))..." -ForegroundColor Cyan
Write-Host "PINECONE_ENV: $env:PINECONE_ENV" -ForegroundColor Cyan
Write-Host "PINECONE_INDEX: $env:PINECONE_INDEX" -ForegroundColor Cyan

# 3. Redémarrer le microservice
Write-Host "`n3️⃣ Redémarrage du microservice..." -ForegroundColor Yellow
Set-Location "microservice_embedding"

try {
    $process = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -WindowStyle Hidden
    Write-Host "✅ Microservice redémarré (PID: $($process.Id))" -ForegroundColor Green
    
    # Attendre que le microservice soit prêt
    Write-Host "⏳ Attente du démarrage..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
} catch {
    Write-Host "❌ Erreur redémarrage: $($_.Exception.Message)" -ForegroundColor Red
}

Set-Location ".."

# 4. Tester la configuration
Write-Host "`n4️⃣ Test de la configuration corrigée..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $testRequest = @{
        value = "Test embedding creation"
        type_donnee = "texte"
        service_id = 999
        langue = "en"
        active = $true
        type_metier = "service"
    } | ConvertTo-Json
    
    $headers = @{"x-api-key" = "yukpo_embedding_key_2024"}
    
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $testRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Test de création d'embedding réussi!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)"
    
    if ($response.simulated) {
        Write-Host "⚠️ ATTENTION: Embedding simulé - Pinecone n'est toujours pas configuré" -ForegroundColor Red
    } else {
        Write-Host "🎉 SUCCÈS: Pinecone est maintenant configuré correctement!" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ Erreur test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé:" -ForegroundColor Cyan
Write-Host "Si 'simulated: true' apparaît, Pinecone n'est toujours pas configuré" -ForegroundColor Yellow
Write-Host "Si 'simulated' n'apparaît pas, Pinecone fonctionne correctement" -ForegroundColor Green 