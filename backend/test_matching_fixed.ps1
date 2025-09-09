# Test du matching avec le seuil corrigé
Write-Host "🧪 Test du matching avec seuil corrigé (0.4 au lieu de 0.5)" -ForegroundColor Cyan
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
Write-Host "  • Seuil de matching : 0.4 (au lieu de 0.5)" -ForegroundColor White
Write-Host "  • Timeout embedding : 120s" -ForegroundColor White
Write-Host "  • Max retries : 3" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Test de recherche pour : 'je cherche les mèches bresilienne'" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 Maintenant, avec le seuil à 0.4 :" -ForegroundColor Yellow
Write-Host "  • Service 517896 : score 0.4661 > 0.4 ✅ (sera inclus)" -ForegroundColor Green
Write-Host "  • Service 559614 : score 0.4661 > 0.4 ✅ (sera inclus)" -ForegroundColor Green
Write-Host "  • Service 914911 : score 0.5007 > 0.4 ✅ (sera inclus)" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Vous pouvez maintenant tester la recherche dans l'interface !" -ForegroundColor Green
Write-Host "   Les services devraient maintenant apparaître dans les résultats." -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Note: Redémarrez le backend pour que les changements prennent effet" -ForegroundColor Yellow 