# Script PowerShell pour appliquer la migration de correction des échanges sans champ 'mode'
# Usage : .\apply_fix_missing_mode_echanges.ps1

$ErrorActionPreference = 'Stop'

# Chemin du script SQL
$sqlFile = "migrations/20250614_fix_missing_mode_echanges.sql"

# Paramètres de connexion PostgreSQL (à adapter si besoin)
$env:PGUSER = "postgres"
$env:PGPASSWORD = "postgres"
$env:PGDATABASE = "yukpo"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

Write-Host "Application de la migration de correction des échanges sans champ 'mode'..." -ForegroundColor Cyan

if (!(Test-Path $sqlFile)) {
    Write-Host "Fichier SQL introuvable : $sqlFile" -ForegroundColor Red
    exit 1
}

# Exécution de la migration
try {
    psql -f $sqlFile
    Write-Host "Migration appliquée avec succès." -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de l'application de la migration : $_" -ForegroundColor Red
    exit 1
}
