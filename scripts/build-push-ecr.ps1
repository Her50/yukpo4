# Script minimal pour build et push Docker vers ECR
param(
    [string]$Version = "latest",
    [string]$Region = "eu-west-1"
)

$ErrorActionPreference = "Stop"

$AWS_ACCOUNT_ID = "108964700972"
$ECR_REPO_NAME = "yukpomnang-backend"
$ECR_REPO_URI = "$AWS_ACCOUNT_ID.dkr.ecr.$Region.amazonaws.com/$ECR_REPO_NAME"

Write-Host "🔨 Build et Push Docker vers ECR" -ForegroundColor Cyan
Write-Host "Repository: $ECR_REPO_URI" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host ""

# 1. Authentification ECR
Write-Host "📦 Authentification ECR..." -ForegroundColor Yellow
$ecrPassword = aws ecr get-login-password --region $Region
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur authentification ECR" -ForegroundColor Red
    exit 1
}
$ecrPassword | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$Region.amazonaws.com"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur connexion Docker à ECR" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Authentifié ECR" -ForegroundColor Green
Write-Host ""

# 2. Build de l'image
Write-Host "🔨 Build de l'image Docker..." -ForegroundColor Yellow
Push-Location backend
try {
    docker build -f Dockerfile.cloud -t "$ECR_REPO_NAME`:$Version" .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur build Docker" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Image buildée" -ForegroundColor Green
}
finally {
    Pop-Location
}
Write-Host ""

# 3. Tag pour ECR
Write-Host "🏷️  Tag de l'image..." -ForegroundColor Yellow
docker tag "$ECR_REPO_NAME`:$Version" "${ECR_REPO_URI}:$Version"
docker tag "$ECR_REPO_NAME`:$Version" "${ECR_REPO_URI}:latest"
Write-Host "✅ Image taguée" -ForegroundColor Green
Write-Host ""

# 4. Push vers ECR
Write-Host "📤 Push vers ECR..." -ForegroundColor Yellow
docker push "${ECR_REPO_URI}:$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur push version $Version" -ForegroundColor Red
    exit 1
}

docker push "${ECR_REPO_URI}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur push latest" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Push terminé avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Image disponible sur ECR:" -ForegroundColor Green
Write-Host "   ${ECR_REPO_URI}:$Version" -ForegroundColor Cyan
Write-Host "   ${ECR_REPO_URI}:latest" -ForegroundColor Cyan


