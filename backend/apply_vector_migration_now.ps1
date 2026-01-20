# Script pour appliquer IMMÉDIATEMENT la migration optimize_vector_matching_vectorial sur Render
# Usage: .\apply_vector_migration_now.ps1

Write-Host "🚀 Application IMMÉDIATE de la migration optimize_vector_matching_vectorial..." -ForegroundColor Cyan

# Chemin vers le fichier de migration
$migrationFile = "migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

# DATABASE_URL Render (depuis verify_indexes.rs ou variable d'environnement)
# Format Render: postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com/database
$databaseUrl = $env:DATABASE_URL

# Si pas dans env, utiliser la valeur par défaut de Render (depuis verify_indexes.rs)
if (-not $databaseUrl) {
    Write-Host "⚠️ DATABASE_URL non trouvée dans env, utilisation de la valeur Render par défaut..." -ForegroundColor Yellow
    # Ne pas hardcoder les credentials ici pour sécurité
    Write-Host "❌ Veuillez définir DATABASE_URL:" -ForegroundColor Red
    Write-Host '   $env:DATABASE_URL = "postgresql://user:password@host:port/database"' -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green

# Extraire les informations de connexion
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "🔌 Connexion à Render PostgreSQL: ${dbHost}:${dbPort}/${dbName}" -ForegroundColor Cyan
    Write-Host ""
    
    # Vérifier si psql est disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlPath) {
        Write-Host "✅ psql trouvé, application de la migration..." -ForegroundColor Green
        
        $env:PGPASSWORD = $dbPassword
        Write-Host "📤 Application en cours..." -ForegroundColor Cyan
        
        # Appliquer directement avec psql
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
            Write-Host "✅ Fonction calculate_vector_match_score_optimized mise à jour" -ForegroundColor Green
            Write-Host "✅ Test vectoriel unique (équivalent %in% R) maintenant actif" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Erreur lors de l'application (code: $LASTEXITCODE)" -ForegroundColor Red
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
            exit 1
        }
        
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ psql non trouvé. Veuillez installer PostgreSQL client." -ForegroundColor Red
        Write-Host "   Ou utilisez un client PostgreSQL (pgAdmin, DBeaver) pour exécuter:" -ForegroundColor Yellow
        Write-Host "   $migrationFile" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Migration terminée avec succès!" -ForegroundColor Green


