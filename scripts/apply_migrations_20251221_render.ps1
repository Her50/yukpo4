# Script PowerShell pour appliquer les migrations 2025-12-21 sur Render
# Migrations:
# - 20251221_align_parcel_types_with_vehicle_types.sql
# - 20251221_optimize_services_update_performance.sql

Write-Host "🚀 Application des migrations 2025-12-21 sur Render" -ForegroundColor Green
Write-Host ""

# ✅ Coordonnées Render (depuis les memories)
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db?sslmode=require"
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"

# Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez PostgreSQL ou utilisez le dashboard Render" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql trouvé: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Chemins absolus vers les migrations
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$migration1 = Join-Path $rootDir "backend\migrations\20251221_align_parcel_types_with_vehicle_types.sql"
$migration2 = Join-Path $rootDir "backend\migrations\20251221_optimize_services_update_performance.sql"

# Migration 1: Aligner parcel_types avec les types de véhicules
Write-Host "📦 Migration 1: Aligner parcel_types avec les types de véhicules..." -ForegroundColor Cyan

if (Test-Path $migration1) {
    Write-Host "   Fichier: $migration1" -ForegroundColor Gray
    $result1 = & psql "$DATABASE_URL" -f $migration1 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migration 1 appliquée avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur lors de l'application de la migration 1:" -ForegroundColor Red
        Write-Host $result1 -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Fichier de migration introuvable: $migration1" -ForegroundColor Red
}

Write-Host ""

# Migration 2: Optimiser les UPDATE services
Write-Host "⚡ Migration 2: Optimiser les UPDATE services..." -ForegroundColor Cyan

if (Test-Path $migration2) {
    Write-Host "   Fichier: $migration2" -ForegroundColor Gray
    $result2 = & psql "$DATABASE_URL" -f $migration2 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migration 2 appliquée avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur lors de l'application de la migration 2:" -ForegroundColor Red
        Write-Host $result2 -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Fichier de migration introuvable: $migration2" -ForegroundColor Red
}

Write-Host ""

# Vérification
Write-Host "🔍 Vérification des migrations..." -ForegroundColor Cyan

# Vérifier les parcel_types
try {
    $checkParcelTypes = & psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM parcel_types WHERE slug IN ('bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking');" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $count = ($checkParcelTypes | Out-String).Trim()
        Write-Host "   ✅ Types de véhicules: $count/8 trouvés" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Impossible de vérifier les parcel_types" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur vérification parcel_types: $_" -ForegroundColor Yellow
}

# Vérifier les index
try {
    $checkIndexes = & psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'services' AND indexname IN ('idx_services_id_active', 'idx_services_data_gin');" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $count = ($checkIndexes | Out-String).Trim()
        Write-Host "   ✅ Index services: $count/2 trouvés" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Impossible de vérifier les index" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur vérification index: $_" -ForegroundColor Yellow
}

# Vérifier la fonction
try {
    $checkFunction = & psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM pg_proc WHERE proname = 'update_service_products';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $count = ($checkFunction | Out-String).Trim()
        if ($count -eq "1") {
            Write-Host "   ✅ Fonction update_service_products créée" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Fonction update_service_products non trouvée (count: $count)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️ Impossible de vérifier la fonction" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur vérification fonction: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Application des migrations terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Note: Les migrations sont aussi dans auto_migrate.rs et seront appliquées automatiquement au prochain démarrage" -ForegroundColor Cyan
