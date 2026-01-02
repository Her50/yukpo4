# Script PowerShell pour appliquer manuellement la migration
# Usage: .\apply_migration_manual.ps1

$ErrorActionPreference = "Stop"

# Lire DATABASE_URL depuis .env ou variable d'environnement
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.+)$") {
            $env:DATABASE_URL = $matches[1]
            break
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL non trouvée dans .env ou variables d'environnement"
    exit 1
}

Write-Host "🔄 Application de la migration 20260102_optimize_add_product_no_lock.sql..."
Write-Host "📡 Connexion à la base de données..."

# Lire le fichier SQL
$sqlFile = Join-Path $PSScriptRoot "migrations\20260102_optimize_add_product_no_lock.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Fichier migration non trouvé: $sqlFile"
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlPath) {
    Write-Host "✅ Utilisation de psql..."
    $sqlContent | & psql $env:DATABASE_URL
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès via psql"
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration"
        exit 1
    }
} else {
    # Utiliser sqlx-cli si disponible
    $sqlxPath = Get-Command sqlx -ErrorAction SilentlyContinue
    if ($sqlxPath) {
        Write-Host "✅ Utilisation de sqlx..."
        # Créer un fichier temporaire et l'exécuter
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
        $sqlContent | Out-File -FilePath $tempFile -Encoding UTF8
        & sqlx database execute $env:DATABASE_URL --file $tempFile
        Remove-Item $tempFile
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès via sqlx"
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration"
            exit 1
        }
    } else {
        Write-Host "❌ Ni psql ni sqlx-cli ne sont disponibles"
        Write-Host "💡 Veuillez installer PostgreSQL (psql) ou sqlx-cli"
        Write-Host "   Ou exécutez le SQL manuellement dans votre client PostgreSQL"
        Write-Host ""
        Write-Host "📄 Contenu SQL à exécuter:"
        Write-Host $sqlContent
        exit 1
    }
}

