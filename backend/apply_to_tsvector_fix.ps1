# Script pour appliquer la migration de correction to_tsvector
Write-Host "🔧 Application de la migration de correction to_tsvector..." -ForegroundColor Cyan

$migrationFile = "migrations\20260114_fix_image_search_to_tsvector_error.sql"

if (-Not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier trouvé: $migrationFile" -ForegroundColor Green

# Utiliser DATABASE_URL depuis l'environnement ou demander
if ($env:DATABASE_URL) {
    Write-Host "📝 Utilisation de DATABASE_URL depuis l'environnement" -ForegroundColor Cyan
    
    # Parser l'URL
    if ($env:DATABASE_URL -match "postgres(ql)?://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
        $user = $matches[2]
        $pass = $matches[3]
        $host = $matches[4]
        $port = if ($matches[5]) { $matches[5] } else { "5432" }
        $db = $matches[6]
        
        $env:PGPASSWORD = $pass
        
        Write-Host "🔌 Connexion à $host:$port/$db" -ForegroundColor Yellow
        Get-Content $migrationFile | psql -h $host -p $port -U $user -d $db
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de l'application" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  DATABASE_URL non définie" -ForegroundColor Yellow
    Write-Host "📋 La migration sera appliquée automatiquement au démarrage du backend" -ForegroundColor Cyan
    Write-Host "   via auto_migrate.rs::ensure_fix_image_search_to_tsvector_error()" -ForegroundColor Cyan
}






