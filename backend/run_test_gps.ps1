# Script PowerShell pour exécuter le test GPS complet
# Base de donnees: yukpo_db

Write-Host "Test GPS complet: Point simple + Zone polygonale" -ForegroundColor Yellow

# Parametres de connexion
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"

Write-Host "Connexion a la base de donnees: $DB_NAME sur $DB_HOST`:$DB_PORT" -ForegroundColor Cyan

# Exécuter le test GPS complet
try {
    Write-Host "Execution du test GPS complet..." -ForegroundColor Yellow
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "test_gps_simple_et_polygone.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Test GPS execute avec succes!" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de l'execution du test" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Erreur lors de l'execution du test: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Test GPS termine!" -ForegroundColor Green
Write-Host "Verifiez les resultats ci-dessus pour valider la correction GPS" -ForegroundColor Cyan 