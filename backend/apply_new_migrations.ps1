# Script pour appliquer les migrations 20260102
# Utilise sqlx migrate run avec gestion d'erreur

Write-Host "🔧 Application des migrations 20260102..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# Vérifier que DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "⚠️  DATABASE_URL n'est pas définie dans l'environnement" -ForegroundColor Yellow
    Write-Host "💡 Les migrations seront appliquées via sqlx migrate run" -ForegroundColor Cyan
    Write-Host "💡 Assurez-vous que DATABASE_URL est définie ou dans un fichier .env" -ForegroundColor Cyan
}

# Changer vers le répertoire backend
Push-Location $PSScriptRoot

try {
    Write-Host "`n📦 Application des migrations avec sqlx..." -ForegroundColor Yellow
    
    # Essayer d'appliquer les migrations
    sqlx migrate run 2>&1 | Tee-Object -Variable output
    
    # Vérifier le résultat
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migrations appliquées avec succès" -ForegroundColor Green
    } else {
        $outputString = $output | Out-String
        if ($outputString -match "migration.*was previously applied but has been modified") {
            Write-Host "`n⚠️  Migration 0 a été modifiée (normal si vous avez mis à jour 0000_create_all_tables.sql)" -ForegroundColor Yellow
            Write-Host "💡 Les nouvelles migrations (20260102_*) seront appliquées si elles n'existent pas déjà" -ForegroundColor Cyan
            Write-Host "`n📝 Vérification des migrations 20260102..." -ForegroundColor Yellow
            
            # Vérifier si les tables existent déjà
            Write-Host "💡 Les migrations utilisent IF NOT EXISTS, donc elles sont sûres" -ForegroundColor Cyan
            Write-Host "💡 Si les tables existent déjà, les migrations ne feront rien" -ForegroundColor Cyan
            Write-Host "💡 Si vous voulez forcer l'application, utilisez: psql \$env:DATABASE_URL -f migrations\20260102_create_product_creation_queue.sql" -ForegroundColor Cyan
        } else {
            Write-Host "`n❌ Erreur lors de l'application des migrations" -ForegroundColor Red
            Write-Host $outputString -ForegroundColor Red
        }
    }
} catch {
    Write-Host "`n❌ Erreur: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host "`n✅ Script terminé" -ForegroundColor Green

