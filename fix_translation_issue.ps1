# Correction du problème de traduction
Write-Host "Correction du problème de traduction..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# 1. Vérifier l'état actuel
Write-Host "`n1️⃣ État actuel de la traduction..." -ForegroundColor Yellow
$google_key = $env:GOOGLE_TRANSLATE_API_KEY
if ($google_key) {
    Write-Host "✅ GOOGLE_TRANSLATE_API_KEY présente: $($google_key.Substring(0,10))..." -ForegroundColor Green
} else {
    Write-Host "❌ GOOGLE_TRANSLATE_API_KEY ABSENTE!" -ForegroundColor Red
}

# 2. Option 1: Configurer une clé Google Translate (si disponible)
Write-Host "`n2️⃣ Option 1: Configuration d'une clé Google Translate..." -ForegroundColor Yellow
Write-Host "Avez-vous une clé Google Translate API ? (y/n)" -ForegroundColor Cyan
$response = Read-Host

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Entrez votre clé Google Translate API:" -ForegroundColor Cyan
    $api_key = Read-Host -AsSecureString
    $api_key_plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($api_key))
    
    $env:GOOGLE_TRANSLATE_API_KEY = $api_key_plain
    Write-Host "✅ Clé Google Translate configurée temporairement" -ForegroundColor Green
    
    # Redémarrer le microservice pour prendre en compte la nouvelle clé
    Write-Host "`nRedémarrage du microservice..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*"} | Stop-Process -Force
    Start-Sleep -Seconds 3
    
    Set-Location "microservice_embedding"
    $process = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -WindowStyle Hidden
    Write-Host "✅ Microservice redémarré (PID: $($process.Id))" -ForegroundColor Green
    Set-Location ".."
    
    Start-Sleep -Seconds 10
    
    # Test de la traduction
    Write-Host "`nTest de la traduction..." -ForegroundColor Yellow
    $testRequest = @{
        value = "Je suis un mécanicien"
        type_donnee = "texte"
        service_id = 999
        langue = "fra"
        active = $true
        type_metier = "service"
    } | ConvertTo-Json
    
    $headers = @{"x-api-key" = "yukpo_embedding_key_2024"}
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $testRequest -ContentType "application/json" -Headers $headers
        Write-Host "✅ Test de création d'embedding réussi!" -ForegroundColor Green
        Write-Host "Réponse: $($response | ConvertTo-Json)"
        
        if ($response.simulated) {
            Write-Host "⚠️ ATTENTION: Embedding simulé - traduction toujours en échec" -ForegroundColor Red
        } else {
            Write-Host "🎉 SUCCÈS: Traduction fonctionne maintenant!" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Erreur test: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} else {
    Write-Host "`n3️⃣ Option 2: Désactiver la traduction automatique..." -ForegroundColor Yellow
    Write-Host "Configuration de la désactivation de la traduction..." -ForegroundColor Cyan
    
    # Créer un fichier de configuration temporaire
    $config_content = @"
# Configuration temporaire pour désactiver la traduction
DISABLE_AUTO_TRANSLATION=true
EMBEDDING_LANGUAGE=fr
"@
    
    $config_content | Out-File -FilePath "temp_translation_config.env" -Encoding UTF8
    Write-Host "✅ Fichier de configuration temporaire créé" -ForegroundColor Green
    
    # Redémarrer le microservice avec la nouvelle configuration
    Write-Host "`nRedémarrage du microservice avec traduction désactivée..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*"} | Stop-Process -Force
    Start-Sleep -Seconds 3
    
    # Charger la configuration temporaire
    Get-Content "temp_translation_config.env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $env:$($matches[1]) = $matches[2]
        }
    }
    
    Set-Location "microservice_embedding"
    $process = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -WindowStyle Hidden
    Write-Host "✅ Microservice redémarré (PID: $($process.Id))" -ForegroundColor Green
    Set-Location ".."
    
    Start-Sleep -Seconds 10
    
    # Test sans traduction
    Write-Host "`nTest sans traduction..." -ForegroundColor Yellow
    $testRequest = @{
        value = "Je suis un mécanicien"
        type_donnee = "texte"
        service_id = 888
        langue = "fra"
        active = $true
        type_metier = "service"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $testRequest -ContentType "application/json" -Headers $headers
        Write-Host "✅ Test de création d'embedding réussi!" -ForegroundColor Green
        Write-Host "Réponse: $($response | ConvertTo-Json)"
        
        if ($response.simulated) {
            Write-Host "⚠️ ATTENTION: Embedding simulé - Pinecone n'est pas configuré" -ForegroundColor Red
        } else {
            Write-Host "🎉 SUCCÈS: Création d'embedding sans traduction!" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Erreur test: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 4. Test final de recherche
Write-Host "`n4️⃣ Test final de recherche..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$searchRequest = @{
    query = "Je cherche un mécanicien"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $searchResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
    Write-Host "Recherche résultat: $($searchResponse | ConvertTo-Json)"
    
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        Write-Host "🎉 SUCCÈS: Recherche fonctionne maintenant!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($searchResponse.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé de la correction:" -ForegroundColor Cyan
Write-Host "Le problème était la traduction automatique qui échouait" -ForegroundColor Yellow
Write-Host "Solutions appliquées:" -ForegroundColor Green
Write-Host "1. Configuration de la clé Google Translate OU" -ForegroundColor Green
Write-Host "2. Désactivation de la traduction automatique" -ForegroundColor Green
Write-Host "`nMaintenant les embeddings et recherches devraient fonctionner!" -ForegroundColor Green 