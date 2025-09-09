# Script PowerShell pour appliquer la correction GPS manquante
# Base de donnees: yukpo_db

Write-Host "Application de la correction GPS manquante..." -ForegroundColor Yellow

# Verifier si psql est disponible
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL client trouve" -ForegroundColor Green
    } else {
        throw "psql non trouve"
    }
} catch {
    Write-Host "PostgreSQL client (psql) non trouve" -ForegroundColor Red
    Write-Host "Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Yellow
    exit 1
}

# Parametres de connexion (a adapter selon votre configuration)
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"

Write-Host "Connexion a la base de donnees: $DB_NAME sur $DB_HOST`:$DB_PORT" -ForegroundColor Cyan

# Appliquer le script de correction GPS
try {
    Write-Host "Application du script fix_gps_search_missing.sql..." -ForegroundColor Yellow
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "fix_gps_search_missing.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script GPS applique avec succes!" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de l'application du script" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Erreur lors de l'application du script: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Correction GPS terminee!" -ForegroundColor Green
Write-Host "La fonction search_services_gps_final devrait maintenant fonctionner" -ForegroundColor Cyan 