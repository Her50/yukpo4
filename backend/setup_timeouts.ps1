# Script de configuration des timeouts pour Yukpo
# Usage: .\setup_timeouts.ps1

Write-Host "Configuration des timeouts pour Yukpo" -ForegroundColor Cyan
Write-Host ""

# Configuration des variables d'environnement pour les timeouts
$envVars = @{
    "EMBEDDING_TIMEOUT_SECONDS" = "120"
    "EMBEDDING_MAX_RETRIES" = "3"
    "EMBEDDING_RETRY_DELAY_MS" = "2000"
    "PINECONE_API_KEY" = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
    "PINECONE_ENV" = "us-east-1"
    "PINECONE_INDEX" = "service-embeddings"
    "EMBEDDING_API_URL" = "http://localhost:8000"
    "YUKPO_API_KEY" = "yukpo_embedding_key_2024"
}

Write-Host "Configuration des variables d'environnement :" -ForegroundColor Yellow
foreach ($var in $envVars.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($var.Key, $var.Value, "Process")
    Write-Host "  OK $($var.Key) = $($var.Value)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configuration terminee !" -ForegroundColor Green
Write-Host ""
Write-Host "Nouveaux timeouts configures :" -ForegroundColor Cyan
Write-Host "  - Embedding timeout: 120 secondes (au lieu de 60)" -ForegroundColor White
Write-Host "  - Max retries: 3" -ForegroundColor White
Write-Host "  - Retry delay: 2000ms" -ForegroundColor White
Write-Host ""
Write-Host "Vous pouvez maintenant lancer le backend avec :" -ForegroundColor Yellow
Write-Host "   cargo run" -ForegroundColor White
Write-Host ""
Write-Host "Note: Ces variables sont temporaires pour cette session PowerShell" -ForegroundColor Yellow
Write-Host "   Pour les rendre permanentes, ajoutez-les à votre fichier .env" -ForegroundColor White 