# Script pour verifier la configuration S3 pour les medias
# Verifie le bucket, les permissions, CORS, et teste upload/download

$ErrorActionPreference = "Stop"

Write-Host "[S3] Verification de la configuration S3 pour les medias..." -ForegroundColor Cyan
Write-Host ""

$region = "eu-west-1"
$projectName = "yukpo"
$environment = "production"

# 1. Recuperer les variables S3 depuis SSM
Write-Host "[1] Recuperation des variables S3..." -ForegroundColor Yellow
Write-Host ""

$s3Bucket = aws ssm get-parameter --name "/$projectName/$environment/S3_BUCKET" --region $region --query 'Parameter.Value' --output text 2>&1
$s3Region = aws ssm get-parameter --name "/$projectName/$environment/S3_REGION" --region $region --query 'Parameter.Value' --output text 2>&1
$s3AccessKey = aws ssm get-parameter --name "/$projectName/$environment/S3_ACCESS_KEY" --region $region --query 'Parameter.Value' --output text --with-decryption 2>&1
$s3SecretKey = aws ssm get-parameter --name "/$projectName/$environment/S3_SECRET_KEY" --region $region --query 'Parameter.Value' --output text --with-decryption 2>&1
$uploadBaseUrl = aws ssm get-parameter --name "/$projectName/$environment/UPLOAD_BASE_URL" --region $region --query 'Parameter.Value' --output text 2>&1

if ($LASTEXITCODE -ne 0 -or $s3Bucket -like "*error*" -or $s3Bucket -eq "") {
    Write-Host "[ERREUR] Impossible de recuperer S3_BUCKET depuis SSM" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] S3_BUCKET = $s3Bucket" -ForegroundColor Green
Write-Host "  [OK] S3_REGION = $s3Region" -ForegroundColor Green
Write-Host "  [OK] UPLOAD_BASE_URL = $uploadBaseUrl" -ForegroundColor Green
Write-Host "  [OK] S3_ACCESS_KEY = $($s3AccessKey.Substring(0, [Math]::Min(10, $s3AccessKey.Length)))..." -ForegroundColor Green
Write-Host "  [OK] S3_SECRET_KEY = ***" -ForegroundColor Green
Write-Host ""

# 2. Verifier l'existence du bucket
Write-Host "[2] Verification de l'existence du bucket..." -ForegroundColor Yellow
Write-Host ""

$bucketExists = aws s3 ls "s3://$s3Bucket" --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Bucket '$s3Bucket' existe et est accessible" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] Bucket '$s3Bucket' introuvable ou inaccessible" -ForegroundColor Red
    Write-Host "     Erreur: $bucketExists" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Verifier les permissions publiques
Write-Host "[3] Verification des permissions publiques..." -ForegroundColor Yellow
Write-Host ""

$publicAccessBlock = aws s3api get-public-access-block --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $blockConfig = $publicAccessBlock | ConvertFrom-Json
    Write-Host "  [INFO] Configuration Public Access Block:" -ForegroundColor Cyan
    Write-Host "     BlockPublicAcls: $($blockConfig.PublicAccessBlockConfiguration.BlockPublicAcls)" -ForegroundColor White
    Write-Host "     IgnorePublicAcls: $($blockConfig.PublicAccessBlockConfiguration.IgnorePublicAcls)" -ForegroundColor White
    Write-Host "     BlockPublicPolicy: $($blockConfig.PublicAccessBlockConfiguration.BlockPublicPolicy)" -ForegroundColor White
    Write-Host "     RestrictPublicBuckets: $($blockConfig.PublicAccessBlockConfiguration.RestrictPublicBuckets)" -ForegroundColor White
} else {
    Write-Host "  [ATTENTION] Public Access Block non configure (acces public possible)" -ForegroundColor Yellow
}

Write-Host ""

# 4. Verifier la politique du bucket
Write-Host "[4] Verification de la politique du bucket..." -ForegroundColor Yellow
Write-Host ""

$bucketPolicy = aws s3api get-bucket-policy --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    try {
        $policyJson = $bucketPolicy | ConvertFrom-Json
        $policy = $policyJson.Policy | ConvertFrom-Json
        Write-Host "  [OK] Politique du bucket configuree" -ForegroundColor Green
        Write-Host "     Statements: $($policy.Statement.Count)" -ForegroundColor White
    } catch {
        Write-Host "  [OK] Politique du bucket configuree (format non standard)" -ForegroundColor Green
    }
} else {
    Write-Host "  [ATTENTION] Aucune politique de bucket configuree" -ForegroundColor Yellow
}

Write-Host ""

# 5. Verifier CORS
Write-Host "[5] Verification de la configuration CORS..." -ForegroundColor Yellow
Write-Host ""

$corsConfig = aws s3api get-bucket-cors --bucket $s3Bucket --region $s3Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $cors = $corsConfig | ConvertFrom-Json
    Write-Host "  [OK] Configuration CORS presente" -ForegroundColor Green
    Write-Host "     CORSRules: $($cors.CORSRules.Count)" -ForegroundColor White
} else {
    Write-Host "  [ATTENTION] Configuration CORS absente (peut causer des problemes avec le frontend)" -ForegroundColor Yellow
}

Write-Host ""

# 6. Tester l'upload
Write-Host "[6] Test d'upload d'un fichier de test..." -ForegroundColor Yellow
Write-Host ""

$testFile = "test-media-upload-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$testContent = "Test upload S3 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testContent | Out-File -FilePath $testFile -Encoding UTF8

$testKey = "uploads/test/$testFile"

try {
    aws s3 cp $testFile "s3://$s3Bucket/$testKey" --region $s3Region 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Upload reussi: s3://$s3Bucket/$testKey" -ForegroundColor Green
        
        # 7. Tester le download
        Write-Host ""
        Write-Host "[7] Test de telechargement du fichier..." -ForegroundColor Yellow
        Write-Host ""
        
        $downloadFile = "test-media-download-$testFile"
        aws s3 cp "s3://$s3Bucket/$testKey" $downloadFile --region $s3Region 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $downloadedContent = Get-Content $downloadFile -Raw
            if ($downloadedContent -eq $testContent) {
                Write-Host "  [OK] Telechargement reussi et contenu verifie" -ForegroundColor Green
            } else {
                Write-Host "  [ATTENTION] Telechargement reussi mais contenu different" -ForegroundColor Yellow
            }
            Remove-Item $downloadFile -Force
        } else {
            Write-Host "  [ERREUR] Echec du telechargement" -ForegroundColor Red
        }
        
        # 8. Tester l'acces public (si configure)
        Write-Host ""
        Write-Host "[8] Test d'acces public via URL..." -ForegroundColor Yellow
        Write-Host ""
        
        if ($uploadBaseUrl -and $uploadBaseUrl -ne "") {
            $publicUrl = "$uploadBaseUrl/$testKey"
            Write-Host "  [INFO] URL publique: $publicUrl" -ForegroundColor Cyan
            
            try {
                $response = Invoke-WebRequest -Uri $publicUrl -Method GET -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Host "  [OK] Acces public fonctionnel (HTTP 200)" -ForegroundColor Green
                } else {
                    Write-Host "  [ATTENTION] Acces public retourne HTTP $($response.StatusCode)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "  [ATTENTION] Acces public non disponible: $_" -ForegroundColor Yellow
                Write-Host "     (Cela peut etre normal si CloudFront/CDN est requis)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  [ATTENTION] UPLOAD_BASE_URL non configure, test d'acces public ignore" -ForegroundColor Yellow
        }
        
        # Nettoyer le fichier de test
        Remove-Item $testFile -Force
        Write-Host ""
        Write-Host "  [NETTOYAGE] Fichier de test supprime localement" -ForegroundColor Gray
        Write-Host "  [INFO] Fichier de test sur S3: s3://$s3Bucket/$testKey (peut etre supprime manuellement)" -ForegroundColor Gray
        
    } else {
        Write-Host "  [ERREUR] Echec de l'upload" -ForegroundColor Red
        Remove-Item $testFile -Force
        exit 1
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors du test d'upload: $_" -ForegroundColor Red
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force
    }
    exit 1
}

Write-Host ""
Write-Host "[OK] Verification S3 terminee avec succes !" -ForegroundColor Green

