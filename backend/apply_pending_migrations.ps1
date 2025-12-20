# Script pour appliquer les migrations en attente
$DATABASE_URL = "postgresql://user:password@host:port/database"

Write-Host "=== Application des migrations en attente ===" -ForegroundColor Cyan

# D'abord corriger le checksum de la migration 0
Write-Host "`n1️⃣ Correction du checksum de la migration 0..." -ForegroundColor Yellow
& .\fix_migration_checksum.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de la correction du checksum" -ForegroundColor Red
    exit 1
}

# Ensuite appliquer les migrations en attente
Write-Host "`n2️⃣ Application des migrations en attente..." -ForegroundColor Yellow
$env:DATABASE_URL = $DATABASE_URL
cargo sqlx migrate run

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Toutes les migrations appliquées avec succès" -ForegroundColor Green
    
    # Vérifier l'état final
    Write-Host "`n📊 État final des migrations:" -ForegroundColor Cyan
    cargo sqlx migrate info
} else {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== FIN ===" -ForegroundColor Cyan

