# Script simplifié pour créer CloudFront via AWS Console
# La création via CLI nécessite un format JSON complexe

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREATION CLOUDFRONT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INFO] La creation CloudFront via CLI est complexe" -ForegroundColor Yellow
Write-Host "[INFO] Utilisation de l'API AWS directement..." -ForegroundColor Yellow
Write-Host ""

# Vérifier le bucket
Write-Host "[1/2] Verification du bucket S3..." -ForegroundColor Yellow
try {
    $bucketCheck = aws s3 ls s3://yukpo-backend-media --region eu-west-1 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Bucket yukpo-backend-media existe" -ForegroundColor Green
    } else {
        Write-Host "  [ERREUR] Bucket non trouve" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERREUR] Impossible de verifier le bucket: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Instructions pour créer via AWS Console
Write-Host "[2/2] Instructions pour creer CloudFront..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ETAPES POUR CREER CLOUDFRONT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Aller sur: https://console.aws.amazon.com/cloudfront/" -ForegroundColor White
Write-Host "2. Cliquer sur 'Create Distribution'" -ForegroundColor White
Write-Host "3. Configurer:" -ForegroundColor White
Write-Host "   - Origin Domain: yukpo-backend-media.s3.eu-west-1.amazonaws.com" -ForegroundColor Gray
Write-Host "   - Origin Path: (laisser vide)" -ForegroundColor Gray
Write-Host "   - Name: S3-yukpo-backend-media" -ForegroundColor Gray
Write-Host "   - Viewer Protocol Policy: Redirect HTTP to HTTPS" -ForegroundColor Gray
Write-Host "   - Allowed HTTP Methods: GET, HEAD, OPTIONS" -ForegroundColor Gray
Write-Host "   - Cache Policy: CachingOptimized" -ForegroundColor Gray
Write-Host "   - Price Class: Use only North America and Europe" -ForegroundColor Gray
Write-Host "4. Cliquer sur 'Create Distribution'" -ForegroundColor White
Write-Host "5. Attendre 5-15 minutes pour le deploiement" -ForegroundColor Gray
Write-Host "6. Copier le Domain Name (ex: d1234567890abcdef.cloudfront.net)" -ForegroundColor White
Write-Host "7. Mettre a jour production (2).json:" -ForegroundColor White
Write-Host "   EXPO_PUBLIC_CDN_CLOUDFLARE_URL = https://d1234567890abcdef.cloudfront.net" -ForegroundColor Gray
Write-Host ""

Write-Host "[INFO] Le fichier cloudfront-config-clean.json contient la configuration complete" -ForegroundColor Cyan
Write-Host "[INFO] Vous pouvez l'utiliser comme reference lors de la creation" -ForegroundColor Cyan
Write-Host ""

