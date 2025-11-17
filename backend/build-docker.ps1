# Script de build Docker avec cache SQLx offline (Option A) - PowerShell

Write-Host "🔍 Vérification du cache SQLx..." -ForegroundColor Cyan

if (-not (Test-Path ".sqlx")) {
    Write-Host "❌ Erreur: Le dossier .sqlx n'existe pas!" -ForegroundColor Red
    Write-Host "   Exécutez d'abord: cargo sqlx prepare -- --lib" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Cache SQLx trouvé dans .sqlx/" -ForegroundColor Green

Write-Host ""
Write-Host "🏗️  Construction de l'image Docker..." -ForegroundColor Cyan

docker build -f Dockerfile -t yukpo-backend:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build terminé avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Image créée: yukpo-backend:latest" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pour tester l'image:" -ForegroundColor Yellow
    Write-Host "  docker run --rm -p 3001:3001 -e DATABASE_URL='...' yukpo-backend:latest" -ForegroundColor Gray
}
else {
    Write-Host ""
    Write-Host "❌ Échec du build Docker" -ForegroundColor Red
    exit 1
}


