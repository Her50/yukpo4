# Script pour appliquer la migration optimize_vector_matching_vectorial directement
# Usage: .\apply_vector_matching_migration.ps1

Write-Host "🚀 Application de la migration optimize_vector_matching_vectorial..." -ForegroundColor Cyan

# Chemin du fichier de migration
$migrationFile = Join-Path $PSScriptRoot "migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

# Essayer de lire DATABASE_URL depuis .env
$envFile = Join-Path $PSScriptRoot ".env"
$databaseUrl = $null

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $databaseUrl = $matches[1].Trim()
            break
        }
    }
}

# Si pas trouvé dans .env, utiliser la variable d'environnement
if (-not $databaseUrl) {
    $databaseUrl = $env:DATABASE_URL
}

# Si toujours pas trouvé, demander à l'utilisateur
if (-not $databaseUrl) {
    Write-Host "⚠️ DATABASE_URL non trouvée" -ForegroundColor Yellow
    Write-Host "💡 Veuillez fournir la chaîne de connexion PostgreSQL:" -ForegroundColor Yellow
    Write-Host "   Format: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    $databaseUrl = Read-Host "DATABASE_URL"
}

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL est requise" -ForegroundColor Red
    exit 1
}

# Parser DATABASE_URL
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $user = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "📝 Connexion à la base de données: $host:$port/$database" -ForegroundColor Cyan
    
    # Exporter le mot de passe pour psql
    $env:PGPASSWORD = $password
    
    # Appliquer la migration
    Write-Host "📄 Application du fichier: $migrationFile" -ForegroundColor Cyan
    psql -h $host -p $port -U $user -d $database -f $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "✅ La fonction calculate_vector_match_score_optimized a été mise à jour avec test vectoriel unique" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    # Nettoyer
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
    Write-Host "   Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Migration terminée!" -ForegroundColor Green


