# Script pour copier une image Docker entre deux régions ECR
# Usage: .\scripts\copy-ecr-image-cross-region.ps1

param(
    [string]$SourceRegion = "eu-west-1",
    [string]$TargetRegion = "us-east-1",
    [string]$RepositoryName = "yukpomnang-backend",
    [string]$ImageTag = "latest",
    [string]$AccountId = "108964700972"
)

$SourceURI = "$AccountId.dkr.ecr.$SourceRegion.amazonaws.com/$RepositoryName"
$TargetURI = "$AccountId.dkr.ecr.$TargetRegion.amazonaws.com/$RepositoryName"

Write-Host "Copie de l'image Docker entre regions ECR" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Source: ${SourceURI}:${ImageTag}" -ForegroundColor Yellow
Write-Host "Target: ${TargetURI}:${ImageTag}" -ForegroundColor Yellow
Write-Host ""

# Méthode 1: Utiliser docker pull/push (plus simple mais nécessite Docker)
Write-Host "Methode: Docker pull/push" -ForegroundColor Cyan
Write-Host ""

# 1. Se connecter à ECR source
Write-Host "1. Connexion à ECR $SourceRegion..." -ForegroundColor Yellow
$loginSource = aws ecr get-login-password --region $SourceRegion | docker login --username AWS --password-stdin $SourceURI 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [ERREUR] Impossible de se connecter à ECR $SourceRegion" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Connecté à ECR $SourceRegion" -ForegroundColor Green
Write-Host ""

# 2. Pull l'image
Write-Host "2. Pull de l'image depuis $SourceRegion..." -ForegroundColor Yellow
docker pull "${SourceURI}:${ImageTag}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [ERREUR] Impossible de pull l'image" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Image pullée avec succès" -ForegroundColor Green
Write-Host ""

# 3. Se connecter à ECR target
Write-Host "3. Connexion à ECR $TargetRegion..." -ForegroundColor Yellow
$loginTarget = aws ecr get-login-password --region $TargetRegion | docker login --username AWS --password-stdin $TargetURI 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [ERREUR] Impossible de se connecter à ECR $TargetRegion" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Connecté à ECR $TargetRegion" -ForegroundColor Green
Write-Host ""

# 4. Tag l'image pour la région target
Write-Host "4. Tag de l'image pour $TargetRegion..." -ForegroundColor Yellow
docker tag "${SourceURI}:${ImageTag}" "${TargetURI}:${ImageTag}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [ERREUR] Impossible de tag l'image" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Image taguée" -ForegroundColor Green
Write-Host ""

# 5. Push vers ECR target
Write-Host "5. Push de l'image vers $TargetRegion..." -ForegroundColor Yellow
docker push "${TargetURI}:${ImageTag}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [ERREUR] Impossible de push l'image" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Image poussée avec succès" -ForegroundColor Green
Write-Host ""

# 6. Vérifier que l'image existe dans la région target
Write-Host "6. Verification de l'image dans $TargetRegion..." -ForegroundColor Yellow
$imageInfo = aws ecr describe-images --repository-name $RepositoryName --region $TargetRegion --image-ids imageTag=$ImageTag --output json 2>&1 | ConvertFrom-Json
if ($imageInfo.imageDetails) {
    Write-Host "   [OK] Image verifiee dans $TargetRegion" -ForegroundColor Green
    Write-Host "   Digest: $($imageInfo.imageDetails[0].imageDigest)" -ForegroundColor Gray
    Write-Host "   Pushed: $($imageInfo.imageDetails[0].imagePushedAt)" -ForegroundColor Gray
}
else {
    Write-Host "   [ATTENTION] Impossible de verifier l'image" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "[OK] Copie terminee avec succes!" -ForegroundColor Green
Write-Host "Image disponible dans $TargetRegion" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan

