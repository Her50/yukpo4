# Script de build Docker avec vérifications SQLx offline

Write-Host "=== BUILD DOCKER - SQLx Offline Mode ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Docker est installé
try {
    docker --version | Out-Null
    Write-Host "✅ Docker trouvé" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez Docker Desktop pour Windows: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le cache SQLx existe
Write-Host ""
Write-Host "1. Vérification du cache SQLx..." -ForegroundColor Yellow
if (-not (Test-Path "backend/.sqlx")) {
    Write-Host "   ❌ Le dossier backend/.sqlx n'existe pas!" -ForegroundColor Red
    Write-Host "   Génération du cache SQLx..." -ForegroundColor Yellow
    
    $env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
    $env:SQLX_OFFLINE = "false"
    
    Set-Location backend
    cargo sqlx prepare -- --lib
    Set-Location ..
    
    if (-not (Test-Path "backend/.sqlx")) {
        Write-Host "   ❌ Échec de la génération du cache SQLx" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Cache SQLx généré" -ForegroundColor Green
}
else {
    $cacheCount = (Get-ChildItem -Path "backend/.sqlx" -File | Measure-Object).Count
    Write-Host "   ✅ Cache SQLx trouvé: $cacheCount fichiers" -ForegroundColor Green
}

# Vérifier que le Dockerfile existe
Write-Host ""
Write-Host "2. Vérification du Dockerfile..." -ForegroundColor Yellow
if (-not (Test-Path "backend/Dockerfile")) {
    Write-Host "   ❌ Le fichier backend/Dockerfile n'existe pas!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Dockerfile trouvé" -ForegroundColor Green

# Lancer le build Docker
Write-Host ""
Write-Host "3. Lancement du build Docker..." -ForegroundColor Yellow
Write-Host "   Cela peut prendre plusieurs minutes (10-30 min selon la machine)..." -ForegroundColor Gray
Write-Host ""

$buildStartTime = Get-Date

docker build -f backend/Dockerfile -t yukpo-backend:latest ./backend

$buildExitCode = $LASTEXITCODE
$buildEndTime = Get-Date
$buildDuration = $buildEndTime - $buildStartTime

Write-Host ""
if ($buildExitCode -eq 0) {
    Write-Host "=== BUILD RÉUSSI ===" -ForegroundColor Green
    Write-Host "Durée: $($buildDuration.ToString('mm\:ss'))" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Image créée: yukpo-backend:latest" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pour tester l'image:" -ForegroundColor Yellow
    Write-Host "  docker run --rm -p 3001:3001 -e DATABASE_URL='...' yukpo-backend:latest" -ForegroundColor Gray
}
else {
    Write-Host "=== BUILD ÉCHOUÉ ===" -ForegroundColor Red
    Write-Host "Durée: $($buildDuration.ToString('mm\:ss'))" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vérifiez les logs ci-dessus pour identifier le problème." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Problèmes courants:" -ForegroundColor Yellow
    Write-Host "  - Cache SQLx manquant ou incomplet" -ForegroundColor Gray
    Write-Host "  - SQLX_OFFLINE=true non défini dans Dockerfile" -ForegroundColor Gray
    Write-Host "  - Erreurs de compilation Rust" -ForegroundColor Gray
}


