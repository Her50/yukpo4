# Test du matching avec la traduction réactivée
Write-Host "🧪 Test du matching avec traduction réactivée" -ForegroundColor Cyan
Write-Host ""

# Configuration des variables d'environnement
$env:EMBEDDING_TIMEOUT_SECONDS="120"
$env:EMBEDDING_MAX_RETRIES="3"
$env:EMBEDDING_RETRY_DELAY_MS="2000"
$env:PINECONE_API_KEY="pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV="us-east-1"
$env:PINECONE_INDEX="service-embeddings"
$env:EMBEDDING_API_URL="http://localhost:8000"
$env:YUKPO_API_KEY="yukpo_embedding_key_2024"

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Configuration actuelle :" -ForegroundColor Yellow
Write-Host "  • Seuil de matching : 0.7 (qualité élevée)" -ForegroundColor White
Write-Host "  • Traduction : RÉACTIVÉE pour la recherche" -ForegroundColor Green
Write-Host "  • Timeout : 120s" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Test de recherche : 'je cherche les mèches bresiliennes'" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Processus attendu :" -ForegroundColor Yellow
Write-Host "  1. Recherche FR: 'je cherche les mèches bresiliennes'" -ForegroundColor White
Write-Host "  2. Traduction EN: 'I am looking for Brazilian braids'" -ForegroundColor White
Write-Host "  3. Service stocké EN: 'Hair extension sales boutique'" -ForegroundColor White
Write-Host "  4. Comparaison EN vs EN = Score élevé (>0.7)" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Lancement du test..." -ForegroundColor Green
Write-Host ""

# Test via l'API
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer YOUR_JWT_TOKEN_HERE"
}

$payload = @{
    "intention" = "recherche_besoin"
    "texte_libre" = "je cherche les mèches bresiliennes"
} | ConvertTo-Json

try {
    Write-Host "📡 Appel API de recherche..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/orchestration" -Method POST -Headers $headers -Body $payload
    
    Write-Host "✅ Réponse reçue :" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
    
} catch {
    Write-Host "❌ Erreur lors du test :" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "🎯 Résultat attendu : Score > 0.7 pour le service 'Boutique de vente de mèches'" -ForegroundColor Green 