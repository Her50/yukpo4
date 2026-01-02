# Script pour appliquer les migrations 20260102
# Applique directement les fichiers SQL via psql

Write-Host "🔧 Application des migrations 20260102..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# Vérifier que DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "💡 Définissez DATABASE_URL avant d'exécuter ce script" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green

# Vérifier que psql est disponible
try {
    $psqlVersion = & psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ psql disponible: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non disponible"
    }
} catch {
    Write-Host "❌ psql non disponible. Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Red
    exit 1
}

# Appliquer la migration product_creation_queue
Write-Host "`n📦 Application de 20260102_create_product_creation_queue.sql..." -ForegroundColor Yellow
$queueMigration = "migrations\20260102_create_product_creation_queue.sql"
if (Test-Path $queueMigration) {
    try {
        Get-Content $queueMigration | psql $env:DATABASE_URL
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration product_creation_queue appliquée avec succès" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Migration product_creation_queue: certaines commandes ont peut-être échoué (normal si les objets existent déjà)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Erreur lors de l'application de la migration product_creation_queue: $_" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier de migration non trouvé: $queueMigration" -ForegroundColor Red
}

# Appliquer la migration cache_table
Write-Host "`n💾 Application de 20260102_create_cache_table.sql..." -ForegroundColor Yellow
$cacheMigration = "migrations\20260102_create_cache_table.sql"
if (Test-Path $cacheMigration) {
    try {
        Get-Content $cacheMigration | psql $env:DATABASE_URL
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration cache_table appliquée avec succès" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Migration cache_table: certaines commandes ont peut-être échoué (normal si les objets existent déjà)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Erreur lors de l'application de la migration cache_table: $_" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier de migration non trouvé: $cacheMigration" -ForegroundColor Red
}

Write-Host "`n✅ Application des migrations terminée" -ForegroundColor Green
Write-Host "💡 Les migrations utilisent IF NOT EXISTS, donc elles sont sûres même si les objets existent déjà" -ForegroundColor Cyan

