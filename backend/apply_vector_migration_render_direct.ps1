# Script pour appliquer IMMÉDIATEMENT la migration optimize_vector_matching_vectorial sur Render
# Utilise la DATABASE_URL de Render trouvée dans verify_indexes.rs

Write-Host "🚀 Application de la migration optimize_vector_matching_vectorial sur Render..." -ForegroundColor Cyan

# DATABASE_URL Render (depuis verify_indexes.rs)
$renderDbUrl = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com:5432/yukpo_db"

# Chemin vers le fichier de migration
$migrationFile = "migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Migration trouvée: $migrationFile" -ForegroundColor Green

# Extraire les informations de connexion
if ($renderDbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
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
        Write-Host ""
        
        # Appliquer directement avec psql
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile
        
        $exitCode = $LASTEXITCODE
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        
        if ($exitCode -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
            Write-Host "✅ Fonction calculate_vector_match_score_optimized mise à jour" -ForegroundColor Green
            Write-Host "✅ Test vectoriel unique (équivalent %in% R) maintenant actif" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Erreur lors de l'application (code: $exitCode)" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ psql non trouvé. Veuillez installer PostgreSQL client." -ForegroundColor Red
        Write-Host "   Ou utilisez un client PostgreSQL pour exécuter le fichier:" -ForegroundColor Yellow
        Write-Host "   $migrationFile" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Migration terminée avec succès!" -ForegroundColor Green


