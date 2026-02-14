# Script pour créer une distribution CloudFront
# Date: 2026-02-14

param(
    [string]$Region = "eu-west-1",
    [string]$BucketName = "yukpo-backend-media",
    [string]$OriginDomain = "yukpo-backend-media.s3.eu-west-1.amazonaws.com"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREATION DISTRIBUTION CLOUDFRONT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INFO] Ce script prepare la configuration CloudFront" -ForegroundColor Yellow
Write-Host "[INFO] La creation doit etre faite via AWS Console ou AWS CLI" -ForegroundColor Yellow
Write-Host ""

# Vérifier que le bucket existe
Write-Host "[1/3] Verification du bucket S3..." -ForegroundColor Yellow
try {
    $bucketCheck = aws s3 ls s3://$BucketName --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Bucket $BucketName existe" -ForegroundColor Green
    } else {
        Write-Host "  [ATTENTION] Bucket $BucketName non trouve" -ForegroundColor Yellow
        Write-Host "  [ACTION] Creer le bucket d'abord:" -ForegroundColor Cyan
        Write-Host "    aws s3 mb s3://$BucketName --region $Region" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERREUR] Impossible de verifier le bucket: $_" -ForegroundColor Red
}
Write-Host ""

# Vérifier les distributions existantes
Write-Host "[2/3] Verification des distributions existantes..." -ForegroundColor Yellow
try {
    $distributions = aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' --output json 2>&1 | ConvertFrom-Json
    
    if ($distributions -and $distributions.Count -gt 0) {
        Write-Host "  [INFO] $($distributions.Count) distribution(s) trouvee(s):" -ForegroundColor Gray
        foreach ($dist in $distributions) {
            Write-Host "    - ID: $($dist[0]), Domain: $($dist[1]), Origin: $($dist[2]), Status: $($dist[3])" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [INFO] Aucune distribution trouvee" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERREUR] Impossible de lister les distributions: $_" -ForegroundColor Red
}
Write-Host ""

# Créer le fichier de configuration JSON
Write-Host "[3/3] Creation du fichier de configuration..." -ForegroundColor Yellow
$cloudfrontConfig = @{
    CallerReference = "yukpo-backend-media-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Comment = "CloudFront distribution for yukpo-backend-media S3 bucket"
    Origins = @{
        Quantity = 1
        Items = @(
            @{
                Id = "S3-yukpo-backend-media"
                DomainName = $OriginDomain
                S3OriginConfig = @{
                    OriginAccessIdentity = ""
                }
            }
        )
    }
    DefaultCacheBehavior = @{
        TargetOriginId = "S3-yukpo-backend-media"
        ViewerProtocolPolicy = "redirect-to-https"
        AllowedMethods = @{
            Quantity = 3
            Items = @("GET", "HEAD", "OPTIONS")
            CachedMethods = @{
                Quantity = 2
                Items = @("GET", "HEAD")
            }
        }
        ForwardedValues = @{
            QueryString = $false
            Cookies = @{
                Forward = "none"
            }
        }
        MinTTL = 0
        DefaultTTL = 86400
        MaxTTL = 31536000
        Compress = $true
    }
    Enabled = $true
    PriceClass = "PriceClass_100"  # North America and Europe seulement (économique)
} | ConvertTo-Json -Depth 10

$configFile = "cloudfront-config.json"
$cloudfrontConfig | Out-File -FilePath $configFile -Encoding UTF8
Write-Host "  [OK] Fichier de configuration cree: $configFile" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSTRUCTIONS POUR CREER LA DISTRIBUTION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Option 1: Via AWS Console (Recommandé)" -ForegroundColor Yellow
Write-Host "  1. Aller sur https://console.aws.amazon.com/cloudfront/" -ForegroundColor White
Write-Host "  2. Cliquer sur 'Create Distribution'" -ForegroundColor White
Write-Host "  3. Origin Domain: $OriginDomain" -ForegroundColor Gray
Write-Host "  4. Viewer Protocol Policy: Redirect HTTP to HTTPS" -ForegroundColor Gray
Write-Host "  5. Allowed HTTP Methods: GET, HEAD, OPTIONS" -ForegroundColor Gray
Write-Host "  6. Cache Policy: CachingOptimized" -ForegroundColor Gray
Write-Host "  7. Price Class: Use only North America and Europe" -ForegroundColor Gray
Write-Host "  8. Cliquer sur 'Create Distribution'" -ForegroundColor White
Write-Host "  9. Attendre 5-15 minutes pour le deploiement" -ForegroundColor Gray
Write-Host "  10. Copier le Domain Name et mettre a jour production (2).json" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Via AWS CLI" -ForegroundColor Yellow
Write-Host "  aws cloudfront create-distribution --distribution-config file://$configFile" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 3: Utiliser le fichier JSON cree" -ForegroundColor Yellow
Write-Host "  Le fichier $configFile contient la configuration complete" -ForegroundColor Gray
Write-Host "  Vous pouvez l'utiliser avec AWS CLI ou AWS Console" -ForegroundColor Gray
Write-Host ""

Write-Host "Apres creation, mettre a jour:" -ForegroundColor Cyan
Write-Host "  production (2).json -> EXPO_PUBLIC_CDN_CLOUDFLARE_URL" -ForegroundColor White
Write-Host ""

