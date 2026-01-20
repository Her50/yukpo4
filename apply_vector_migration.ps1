# Script pour appliquer la migration optimize_vector_matching_vectorial
# Usage: .\apply_vector_migration.ps1

Write-Host "🚀 Application de la migration optimize_vector_matching_vectorial..." -ForegroundColor Cyan

# Chemin du fichier de migration
$migrationFile = "backend\migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

# Essayer de trouver DATABASE_URL
$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl -and (Test-Path ".env")) {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $databaseUrl = $matches[1].Trim()
            break
        }
    }
}

if (-not $databaseUrl -and (Test-Path "backend\.env")) {
    $envContent = Get-Content "backend\.env"
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $databaseUrl = $matches[1].Trim()
            break
        }
    }
}

if (-not $databaseUrl) {
    Write-Host "⚠️ DATABASE_URL non trouvée" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Veuillez définir DATABASE_URL avant d'exécuter ce script:" -ForegroundColor Yellow
    Write-Host '   $env:DATABASE_URL = "postgresql://user:password@host:port/database"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou fournissez-la maintenant:" -ForegroundColor Yellow
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
    
    Write-Host "📝 Connexion à: $host:$port/$database" -ForegroundColor Cyan
    Write-Host "📄 Application de la migration..." -ForegroundColor Cyan
    Write-Host ""
    
    $env:PGPASSWORD = $password
    psql -h $host -p $port -U $user -d $database -f $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "✅ Fonction calculate_vector_match_score_optimized mise à jour" -ForegroundColor Green
        Write-Host "✅ Test vectoriel unique (équivalent %in% R) actif" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application (code: $LASTEXITCODE)" -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Terminé!" -ForegroundColor Green


