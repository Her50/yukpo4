# Script pour synchroniser les secrets depuis Secrets Manager vers SSM Parameter Store
# Usage: .\scripts\sync-secrets-ssm.ps1

$ErrorActionPreference = "Stop"

Write-Host "Synchronisation des secrets depuis Secrets Manager vers SSM Parameter Store..." -ForegroundColor Cyan
Write-Host ""

# Récupérer tous les secrets depuis Secrets Manager
Write-Host "Recuperation des secrets depuis Secrets Manager..." -ForegroundColor Yellow
try {
    $secretsJson = aws secretsmanager get-secret-value `
        --secret-id yukpomnang/backend/secrets `
        --region eu-west-1 `
        --query "SecretString" `
        --output text
    
    $secrets = $secretsJson | ConvertFrom-Json
    Write-Host "Secrets recuperes avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de la recuperation des secrets : $_" -ForegroundColor Red
    exit 1
}

# Liste des secrets à synchroniser (selon la task definition)
$secretNames = @(
    "DATABASE_URL", "REDIS_URL", "JWT_SECRET", "OPENAI_API_KEY",
    "SORA_API_KEY", "LIVEKIT_API_SECRET", "S3_SECRET_KEY", "S3_ACCESS_KEY",
    "MONGODB_URL", "SENDGRID_API_KEY", "TWILIO_AUTH_TOKEN", "AUPHONIC_API_KEY",
    "VIDEO_RENDERER_RPC_TOKEN", "EMBEDDING_API_KEY", "YUKPO_API_KEY",
    "GOOGLE_MAPS_API_KEY", "GOOGLE_TRANSLATE_API_KEY", "PEXELS_API_KEY",
    "PIXABAY_API_KEY", "UNSPLASH_ACCESS_KEY", "OPENWEATHERMAP_API_KEY",
    "YOUTUBE_CLIENT_SECRET"
)

Write-Host ""
Write-Host "Synchronisation de $($secretNames.Count) secrets..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$skipCount = 0
$errorCount = 0

foreach ($name in $secretNames) {
    if ($secrets.$name) {
        try {
            Write-Host "  $name..." -ForegroundColor Gray -NoNewline
            aws ssm put-parameter `
                --name "/yukpomnang/production/$name" `
                --value $secrets.$name `
                --type SecureString `
                --overwrite `
                --region eu-west-1 `
                --no-cli-pager | Out-Null
            Write-Host " OK" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host " ERREUR: $_" -ForegroundColor Red
            $errorCount++
        }
    } else {
        Write-Host "  SKIP $name (non trouve dans Secrets Manager)" -ForegroundColor Yellow
        $skipCount++
    }
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "Resume de la synchronisation" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "Synchronises : $successCount" -ForegroundColor Green
Write-Host "Ignores : $skipCount" -ForegroundColor Yellow
Write-Host "Erreurs : $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($errorCount -eq 0) {
    Write-Host "Synchronisation terminee avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes :" -ForegroundColor Yellow
    Write-Host "   1. Redémarrer le service ECS :" -ForegroundColor White
    Write-Host "      aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region eu-west-1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Surveiller les tâches :" -ForegroundColor White
    Write-Host "      aws ecs list-tasks --cluster yukpomnang-cluster --service-name yukpomnang-backend-service --region eu-west-1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Vérifier les logs pour les migrations :" -ForegroundColor White
    Write-Host "      aws logs tail /ecs/yukpomnang-backend --region eu-west-1 --since 10m --filter-pattern 'Migrations'" -ForegroundColor Gray
} else {
    Write-Host "Certains secrets n'ont pas pu etre synchronises. Verifiez les erreurs ci-dessus." -ForegroundColor Yellow
}

