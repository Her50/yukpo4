# 🔍 Script de Vérification et Mise à Jour des Variables AWS Backend
# Date: 2026-02-14
# Objectif: Vérifier et mettre à jour les variables SSM pour le nouveau compte AWS

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpo",
    [string]$Environment = "production"
)

Write-Host "🔍 Vérification et Mise à Jour des Variables AWS Backend" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SSM_PREFIX = "/$ProjectName/$Environment"
$S3_BUCKET = "yukpo-backend-media"
$S3_REGION = "eu-west-1"
$UPLOAD_BASE_URL = "https://$S3_BUCKET.s3.$S3_REGION.amazonaws.com"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Région: $Region" -ForegroundColor Gray
Write-Host "  Projet: $ProjectName" -ForegroundColor Gray
Write-Host "  Environnement: $Environment" -ForegroundColor Gray
Write-Host "  Préfixe SSM: $SSM_PREFIX" -ForegroundColor Gray
Write-Host ""

# ============================================
# 1. VÉRIFIER LE BUCKET S3
# ============================================
Write-Host "1️⃣  Vérification du Bucket S3..." -ForegroundColor Yellow
try {
    $bucketExists = aws s3 ls "s3://$S3_BUCKET" --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Bucket S3 '$S3_BUCKET' existe" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Bucket S3 '$S3_BUCKET' n'existe pas ou n'est pas accessible" -ForegroundColor Yellow
        Write-Host "   💡 Création du bucket..." -ForegroundColor Cyan
        aws s3 mb "s3://$S3_BUCKET" --region $Region
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Bucket créé avec succès" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Erreur lors de la création du bucket" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ⚠️  Erreur lors de la vérification du bucket: $_" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 2. VÉRIFIER LES VARIABLES SSM EXISTANTES
# ============================================
Write-Host "2️⃣  Vérification des Variables SSM existantes..." -ForegroundColor Yellow
$variablesToCheck = @(
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "UPLOAD_BASE_URL"
)

$existingVariables = @{}
foreach ($var in $variablesToCheck) {
    $paramName = "$SSM_PREFIX/$var"
    try {
        $result = aws ssm get-parameter --name $paramName --region $Region --query 'Parameter.Value' --output text 2>&1
        if ($LASTEXITCODE -eq 0) {
            $existingVariables[$var] = $result
            Write-Host "   ✅ $var = $result" -ForegroundColor Green
        } else {
            Write-Host "   [AVERTISSEMENT] $var n'existe pas" -ForegroundColor Yellow
            $existingVariables[$var] = $null
        }
    } catch {
        Write-Host "   [AVERTISSEMENT] ${var}: Erreur lors de la verification" -ForegroundColor Yellow
        $existingVariables[$var] = $null
    }
}
Write-Host ""

# ============================================
# 3. METTRE À JOUR LES VARIABLES SSM
# ============================================
Write-Host "3️⃣  Mise à jour des Variables SSM..." -ForegroundColor Yellow

# S3_BUCKET
Write-Host "   📝 Mise à jour S3_BUCKET..." -ForegroundColor Cyan
aws ssm put-parameter `
    --name "$SSM_PREFIX/S3_BUCKET" `
    --value $S3_BUCKET `
    --type "String" `
    --region $Region `
    --overwrite | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ S3_BUCKET mis à jour: $S3_BUCKET" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erreur lors de la mise à jour de S3_BUCKET" -ForegroundColor Red
}

# S3_REGION
Write-Host "   📝 Mise à jour S3_REGION..." -ForegroundColor Cyan
aws ssm put-parameter `
    --name "$SSM_PREFIX/S3_REGION" `
    --value $S3_REGION `
    --type "String" `
    --region $Region `
    --overwrite | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ S3_REGION mis à jour: $S3_REGION" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erreur lors de la mise à jour de S3_REGION" -ForegroundColor Red
}

# UPLOAD_BASE_URL
Write-Host "   📝 Mise à jour UPLOAD_BASE_URL..." -ForegroundColor Cyan
aws ssm put-parameter `
    --name "$SSM_PREFIX/UPLOAD_BASE_URL" `
    --value $UPLOAD_BASE_URL `
    --type "String" `
    --region $Region `
    --overwrite | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ UPLOAD_BASE_URL mis à jour: $UPLOAD_BASE_URL" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erreur lors de la mise à jour de UPLOAD_BASE_URL" -ForegroundColor Red
}

# S3_ACCESS_KEY et S3_SECRET_KEY
Write-Host ""
Write-Host "   ⚠️  S3_ACCESS_KEY et S3_SECRET_KEY:" -ForegroundColor Yellow
Write-Host "   💡 Si vous utilisez un rôle IAM pour ECS, ces variables ne sont pas nécessaires" -ForegroundColor Cyan
Write-Host "   💡 Si vous utilisez des credentials explicites, mettez-les à jour manuellement:" -ForegroundColor Cyan
Write-Host "      aws ssm put-parameter --name '$SSM_PREFIX/S3_ACCESS_KEY' --value 'VOTRE_ACCESS_KEY' --type 'SecureString' --region $Region --overwrite" -ForegroundColor Gray
Write-Host "      aws ssm put-parameter --name '$SSM_PREFIX/S3_SECRET_KEY' --value 'VOTRE_SECRET_KEY' --type 'SecureString' --region $Region --overwrite" -ForegroundColor Gray
Write-Host ""

# ============================================
# 4. VÉRIFIER LA DISTRIBUTION CLOUDFRONT
# ============================================
Write-Host "4️⃣  Vérification de la Distribution CloudFront..." -ForegroundColor Yellow
try {
    $distributions = aws cloudfront list-distributions --region $Region --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' --output json 2>&1 | ConvertFrom-Json
    if ($distributions -and $distributions.Count -gt 0) {
        Write-Host "   ✅ Distributions CloudFront trouvées:" -ForegroundColor Green
        foreach ($dist in $distributions) {
            $distId = $dist[0]
            $domainName = $dist[1]
            $originDomain = $dist[2]
            Write-Host "      - ID: $distId" -ForegroundColor Gray
            Write-Host "        Domain: $domainName" -ForegroundColor Gray
            Write-Host "        Origin: $originDomain" -ForegroundColor Gray
            if ($originDomain -like "*$S3_BUCKET*") {
                Write-Host "        ✅ Pointe vers le bon bucket S3" -ForegroundColor Green
            } else {
                Write-Host "        ⚠️  Ne pointe pas vers $S3_BUCKET" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ⚠️  Aucune distribution CloudFront trouvée" -ForegroundColor Yellow
        Write-Host "   💡 Créez une distribution CloudFront pointant vers $S3_BUCKET.s3.$S3_REGION.amazonaws.com" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ⚠️  Erreur lors de la vérification CloudFront: $_" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 5. VÉRIFIER L'URL DU BACKEND
# ============================================
Write-Host "5️⃣  Vérification de l'URL du Backend..." -ForegroundColor Yellow
$backendUrl = "https://api.yukpomnang.com"
Write-Host "   🔍 Test de connectivité vers $backendUrl..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend accessible via $backendUrl" -ForegroundColor Green
        Write-Host "   📍 L'URL pointe vers le nouveau compte AWS" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Backend répond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Impossible de se connecter à $backendUrl" -ForegroundColor Yellow
    Write-Host "   💡 Vérifiez que:" -ForegroundColor Cyan
    Write-Host "      - Le domaine api.yukpomnang.com pointe vers le Load Balancer du nouveau compte" -ForegroundColor Gray
    Write-Host "      - Le service ECS est en cours d'exécution" -ForegroundColor Gray
    Write-Host "      - Le Security Group autorise le trafic HTTP/HTTPS" -ForegroundColor Gray
}

# Vérifier aussi l'IP publique mentionnée dans la config
$publicIp = "18.201.235.152"
Write-Host ""
Write-Host "   🔍 Test de connectivité vers IP publique $publicIp:8080..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$publicIp:8080/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend accessible via IP publique $publicIp:8080" -ForegroundColor Green
        Write-Host "   ⚠️  Note: Cette IP peut changer à chaque redémarrage ECS" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  IP publique répond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  IP publique non accessible (peut être normale si le service a redémarré)" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 6. RÉSUMÉ
# ============================================
Write-Host "📊 Résumé des Variables SSM:" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Variables mises à jour:" -ForegroundColor Yellow
Write-Host "  ✅ S3_BUCKET = $S3_BUCKET" -ForegroundColor Green
Write-Host "  ✅ S3_REGION = $S3_REGION" -ForegroundColor Green
Write-Host "  ✅ UPLOAD_BASE_URL = $UPLOAD_BASE_URL" -ForegroundColor Green
Write-Host ""
Write-Host "Actions requises:" -ForegroundColor Yellow
Write-Host "  ⏳ Vérifier S3_ACCESS_KEY et S3_SECRET_KEY (si utilisés)" -ForegroundColor Yellow
Write-Host "  ⏳ Vérifier/Créer distribution CloudFront" -ForegroundColor Yellow
Write-Host "  ⏳ Vérifier que api.yukpomnang.com pointe vers le nouveau compte" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Script terminé!" -ForegroundColor Green

