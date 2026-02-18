# Script pour appliquer les migrations d'optimisation directement
# Date: 2026-02-18
# Migrations: 
#   - 20260218_optimize_delivery_matching_queue_final.sql
#   - 20260218_optimize_delivery_proximity_suggestions.sql
#   - 20260218_optimize_product_orders_validation_deadline.sql

param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Host "❌ ERREUR: DATABASE_URL n'est pas défini" -ForegroundColor Red
    Write-Host "Usage: .\scripts\apply-optimization-migrations.ps1 -DatabaseUrl 'postgresql://...'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Application des migrations d'optimisation..." -ForegroundColor Green
Write-Host ""

$migrations = @(
    @{
        Name = "Optimisation delivery_matching_queue"
        File = "backend\migrations\20260218_optimize_delivery_matching_queue_final.sql"
    },
    @{
        Name = "Optimisation delivery_proximity_suggestions"
        File = "backend\migrations\20260218_optimize_delivery_proximity_suggestions.sql"
    },
    @{
        Name = "Optimisation product_orders"
        File = "backend\migrations\20260218_optimize_product_orders_validation_deadline.sql"
    }
)

foreach ($migration in $migrations) {
    Write-Host "📋 Migration: $($migration.Name)" -ForegroundColor Cyan
    Write-Host "   Fichier: $($migration.File)" -ForegroundColor Gray
    
    if (-not (Test-Path $migration.File)) {
        Write-Host "   ⚠️ Fichier non trouvé, ignoré" -ForegroundColor Yellow
        continue
    }
    
    $sql = Get-Content $migration.File -Raw
    
    try {
        # Utiliser psql si disponible
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            Write-Host "   🔄 Application via psql..." -ForegroundColor Gray
            $sql | psql $DatabaseUrl
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Migration appliquée avec succès" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Erreur lors de l'application (code: $LASTEXITCODE)" -ForegroundColor Red
            }
        } else {
            Write-Host "   ⚠️ psql non disponible, utilisation de sqlx-cli..." -ForegroundColor Yellow
            
            # Essayer sqlx-cli
            if (Get-Command sqlx -ErrorAction SilentlyContinue) {
                Write-Host "   🔄 Application via sqlx..." -ForegroundColor Gray
                $env:DATABASE_URL = $DatabaseUrl
                sqlx migrate run --source backend/migrations
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   ✅ Migration appliquée avec succès" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ Erreur lors de l'application (code: $LASTEXITCODE)" -ForegroundColor Red
                }
            } else {
                Write-Host "   ❌ psql et sqlx-cli non disponibles" -ForegroundColor Red
                Write-Host "   💡 Installez psql ou sqlx-cli pour appliquer les migrations" -ForegroundColor Yellow
                Write-Host "   💡 Ou exécutez le SQL manuellement dans votre client PostgreSQL" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "   SQL à exécuter:" -ForegroundColor Cyan
                Write-Host $sql -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "✅ Application des migrations terminée" -ForegroundColor Green

