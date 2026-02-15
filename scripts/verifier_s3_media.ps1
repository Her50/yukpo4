# Script pour vérifier la configuration S3 pour les médias
# Vérifie le bucket, les permissions, CORS, et teste upload/download

$ErrorActionPreference = "Stop"

Write-Host "🪣 Vérification de la configuration S3 pour les médias..." -ForegroundColor Cyan
Write-Host ""

$region = "eu-west-1"
$projectName = "yukpo"
$environment = "production"

# 1. Récupérer les variables S3 depuis SSM
Write-Host "📋 1. Récupération des variables S3..." -ForegroundColor Yellow
Write-Host ""

$s3Bucket = aws ssm get-parameter --name "/$projectName/$environment/S3_BUCKET" --region $region --query 'Parameter.Value' --output text 2>&1
$s3Region = aws ssm get-parameter --name "/$projectName/$environment/S3_REGION" --region $region --query 'Parameter.Value' --output text 2>&1
$s3AccessKey = aws ssm get-parameter --name "/$projectName/$environment/S3_ACCESS_KEY" --region $region --query 'Parameter.Value' --output text --with-decryption 2>&1
$s3SecretKey = aws ssm get-parameter --name "/$projectName/$environment/S3_SECRET_KEY" --region $region --query 'Parameter.Value' --output text --with-decryption 2>&1
$uploadBaseUrl = aws ssm get-parameter --name "/$projectName/$environment/UPLOAD_BASE_URL" --region $region --query 'Parameter.Value' --output text 2>&1

if ($LASTEXITCODE -ne 0 -or $s3Bucket -like "*error*" -or $s3Bucket -eq "") {
    Write-Host "❌ Impossible de récupérer S3_BUCKET depuis SSM" -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ S3_BUCKET = $s3Bucket" -ForegroundColor Green
Write-Host "  ✅ S3_REGION = $s3Region" -ForegroundColor Green
Write-Host "  ✅ UPLOAD_BASE_URL = $uploadBaseUrl" -ForegroundColor Green
Write-Host "  ✅ S3_ACCESS_KEY = $($s3AccessKey.Substring(0, [Math]::Min(10, $s3AccessKey.Length)))..." -ForegroundColor Green
Write-Host "  ✅ S3_SECRET_KEY = ***" -ForegroundColor Green
Write-Host ""

# 2. Vérifier l'existence du bucket
Write-Host "📋 2. Vérification de l'existence du bucket..." -ForegroundColor Yellow
Write-Host ""

$bucketExists = aws s3 ls "s3://$s3Bucket" --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Bucket '$s3Bucket' existe et est accessible" -ForegroundColor Green
} else {
    Write-Host "  ❌ Bucket '$s3Bucket' introuvable ou inaccessible" -ForegroundColor Red
    Write-Host "     Erreur: $bucketExists" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Vérifier les permissions publiques
Write-Host "📋 3. Vérification des permissions publiques..." -ForegroundColor Yellow
Write-Host ""

$publicAccessBlock = aws s3api get-public-access-block --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $blockConfig = $publicAccessBlock | ConvertFrom-Json
    Write-Host "  ℹ️ Configuration Public Access Block:" -ForegroundColor Cyan
    Write-Host "     BlockPublicAcls: $($blockConfig.PublicAccessBlockConfiguration.BlockPublicAcls)" -ForegroundColor White
    Write-Host "     IgnorePublicAcls: $($blockConfig.PublicAccessBlockConfiguration.IgnorePublicAcls)" -ForegroundColor White
    Write-Host "     BlockPublicPolicy: $($blockConfig.PublicAccessBlockConfiguration.BlockPublicPolicy)" -ForegroundColor White
    Write-Host "     RestrictPublicBuckets: $($blockConfig.PublicAccessBlockConfiguration.RestrictPublicBuckets)" -ForegroundColor White
} else {
    Write-Host "  ⚠️ Public Access Block non configuré (accès public possible)" -ForegroundColor Yellow
}

Write-Host ""

# 4. Vérifier la politique du bucket
Write-Host "📋 4. Vérification de la politique du bucket..." -ForegroundColor Yellow
Write-Host ""

$bucketPolicy = aws s3api get-bucket-policy --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $policy = $bucketPolicy | ConvertFrom-Json | ConvertFrom-Json
    Write-Host "  ✅ Politique du bucket configurée" -ForegroundColor Green
    Write-Host "     Statements: $($policy.Statement.Count)" -ForegroundColor White
} else {
    Write-Host "  ⚠️ Aucune politique de bucket configurée" -ForegroundColor Yellow
}

Write-Host ""

# 5. Vérifier CORS
Write-Host "📋 5. Vérification de la configuration CORS..." -ForegroundColor Yellow
Write-Host ""

$corsConfig = aws s3api get-bucket-cors --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $cors = $corsConfig | ConvertFrom-Json
    Write-Host "  ✅ Configuration CORS présente" -ForegroundColor Green
    Write-Host "     CORSRules: $($cors.CORSRules.Count)" -ForegroundColor White
} else {
    Write-Host "  ⚠️ Configuration CORS absente (peut causer des problèmes avec le frontend)" -ForegroundColor Yellow
}

Write-Host ""

# 6. Tester l'upload
Write-Host "📋 6. Test d'upload d'un fichier de test..." -ForegroundColor Yellow
Write-Host ""

$testFile = "test-media-upload-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$testContent = "Test upload S3 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testContent | Out-File -FilePath $testFile -Encoding UTF8

$testKey = "uploads/test/$testFile"

try {
    aws s3 cp $testFile "s3://$s3Bucket/$testKey" --region $s3Region 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Upload réussi: s3://$s3Bucket/$testKey" -ForegroundColor Green
        
        # 7. Tester le download
        Write-Host ""
        Write-Host "📋 7. Test de téléchargement du fichier..." -ForegroundColor Yellow
        Write-Host ""
        
        $downloadFile = "test-media-download-$testFile"
        aws s3 cp "s3://$s3Bucket/$testKey" $downloadFile --region $s3Region 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $downloadedContent = Get-Content $downloadFile -Raw
            if ($downloadedContent -eq $testContent) {
                Write-Host "  ✅ Téléchargement réussi et contenu vérifié" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ Téléchargement réussi mais contenu différent" -ForegroundColor Yellow
            }
            Remove-Item $downloadFile -Force
        } else {
            Write-Host "  ❌ Échec du téléchargement" -ForegroundColor Red
        }
        
        # 8. Tester l'accès public (si configuré)
        Write-Host ""
        Write-Host "📋 8. Test d'accès public via URL..." -ForegroundColor Yellow
        Write-Host ""
        
        if ($uploadBaseUrl -and $uploadBaseUrl -ne "") {
            $publicUrl = "$uploadBaseUrl/$testKey"
            Write-Host "  ℹ️ URL publique: $publicUrl" -ForegroundColor Cyan
            
            try {
                $response = Invoke-WebRequest -Uri $publicUrl -Method GET -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Host "  ✅ Accès public fonctionnel (HTTP 200)" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️ Accès public retourne HTTP $($response.StatusCode)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "  ⚠️ Accès public non disponible: $_" -ForegroundColor Yellow
                Write-Host "     (Cela peut être normal si CloudFront/CDN est requis)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ⚠️ UPLOAD_BASE_URL non configuré, test d'accès public ignoré" -ForegroundColor Yellow
        }
        
        # Nettoyer le fichier de test
        Remove-Item $testFile -Force
        Write-Host ""
        Write-Host "  🗑️ Fichier de test supprimé localement" -ForegroundColor Gray
        Write-Host "  ℹ️ Fichier de test sur S3: s3://$s3Bucket/$testKey (peut être supprimé manuellement)" -ForegroundColor Gray
        
    } else {
        Write-Host "  ❌ Échec de l'upload" -ForegroundColor Red
        Remove-Item $testFile -Force
        exit 1
    }
} catch {
    Write-Host "  ❌ Erreur lors du test d'upload: $_" -ForegroundColor Red
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force
    }
    exit 1
}

Write-Host ""
Write-Host "✅ Vérification S3 terminée avec succès !" -ForegroundColor Green


