# Script pour monitorer le build Docker en temps réel
Write-Host "🔍 Monitoring du build Docker..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si Docker Desktop est en cours d'exécution
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker Desktop n'est pas en cours d'exécution" -ForegroundColor Red
        Write-Host "   Démarrez Docker Desktop et réessayez" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Impossible de se connecter à Docker" -ForegroundColor Red
    Write-Host "   Vérifiez que Docker Desktop est démarré" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker est accessible" -ForegroundColor Green
Write-Host ""

# Afficher les processus Docker en cours
Write-Host "📊 Processus Docker en cours:" -ForegroundColor Cyan
docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}"

Write-Host ""

# Afficher les images en cours de build (si possible)
Write-Host "🐳 Images Docker:" -ForegroundColor Cyan
docker images --filter "reference=yukpomnang-backend" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

Write-Host ""
Write-Host "💡 Astuces:" -ForegroundColor Yellow
Write-Host "   - Le build Rust peut prendre 15-30 minutes (c'est normal)" -ForegroundColor White
Write-Host "   - Surveillez l'activité CPU dans le gestionnaire de tâches" -ForegroundColor White
Write-Host "   - Le build semble bloqué mais Docker continue en arrière-plan" -ForegroundColor White
Write-Host ""
Write-Host "📈 Pour voir la progression en temps réel:" -ForegroundColor Cyan
Write-Host "   docker build --progress=plain -t yukpomnang-backend:latest -f backend/Dockerfile.cloud backend" -ForegroundColor Gray




