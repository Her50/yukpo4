# Script pour appliquer directement la migration optimize_vector_matching_vectorial
# Usage: .\apply_vector_migration_direct.ps1

Write-Host "🚀 Application de la migration optimize_vector_matching_vectorial..." -ForegroundColor Cyan

# Chemin du fichier de migration
$migrationFile = "backend\migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lecture du fichier de migration..." -ForegroundColor Cyan
$sqlContent = Get-Content $migrationFile -Raw

# Essayer de trouver DATABASE_URL
$databaseUrl = $null

# 1. Vérifier les variables d'environnement
if ($env:DATABASE_URL) {
    $databaseUrl = $env:DATABASE_URL
    Write-Host "✅ DATABASE_URL trouvée dans les variables d'environnement" -ForegroundColor Green
}

# 2. Vérifier dans .env à la racine
if (-not $databaseUrl -and (Test-Path ".env")) {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $databaseUrl = $matches[1].Trim()
            Write-Host "✅ DATABASE_URL trouvée dans .env" -ForegroundColor Green
            break
        }
    }
}

# 3. Vérifier dans backend/.env
if (-not $databaseUrl -and (Test-Path "backend\.env")) {
    $envContent = Get-Content "backend\.env"
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $databaseUrl = $matches[1].Trim()
            Write-Host "✅ DATABASE_URL trouvée dans backend/.env" -ForegroundColor Green
            break
        }
    }
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
    Write-Host "📄 Application de la migration..." -ForegroundColor Cyan
    Write-Host ""
    
    # Utiliser psql avec -f pour appliquer le fichier
    psql -h $host -p $port -U $user -d $database -f $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "✅ La fonction calculate_vector_match_score_optimized a été mise à jour" -ForegroundColor Green
        Write-Host "✅ Test vectoriel unique (équivalent %in% R) maintenant actif" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    # Nettoyer
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
    Write-Host "   Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    Write-Host "   Format reçu: $databaseUrl" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Migration terminée avec succès!" -ForegroundColor Green


