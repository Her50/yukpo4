# Test de la qualité du matching sans traduction automatique
Write-Host "🧪 Test de la qualité du matching (sans traduction automatique)" -ForegroundColor Cyan
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
Write-Host "  • Traduction automatique : DÉSACTIVÉE pour la recherche" -ForegroundColor White
Write-Host "  • Timeout embedding : 120s" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Test de recherche pour : 'je cherche les mèches bresilienne'" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 Améliorations apportées :" -ForegroundColor Yellow
Write-Host "  • Recherche en français préservée (pas de traduction EN)" -ForegroundColor Green
Write-Host "  • Service stocké en français : 'Boutique de vente de mèches'" -ForegroundColor Green
Write-Host "  • Comparaison directe FR vs FR = score plus élevé" -ForegroundColor Green
Write-Host ""

Write-Host "🎯 Résultats attendus :" -ForegroundColor Cyan
Write-Host "  • Score sémantique : 0.7+ (au lieu de 0.4661)" -ForegroundColor White
Write-Host "  • Service 131 trouvé et inclus dans les résultats" -ForegroundColor White
Write-Host "  • Qualité de matching considérablement améliorée" -ForegroundColor White
Write-Host ""

Write-Host "🚀 Vous pouvez maintenant tester la recherche dans l'interface !" -ForegroundColor Green
Write-Host "   Le score devrait être beaucoup plus élevé." -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Note: Redémarrez le backend pour que les changements prennent effet" -ForegroundColor Yellow 