# Test GPS simple après correction
Write-Host "Test GPS simple après correction..." -ForegroundColor Yellow

# Parametres de connexion
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"

Write-Host "Connexion a la base de donnees: $DB_NAME sur $DB_HOST`:$DB_PORT" -ForegroundColor Cyan

# Exécuter le test GPS simple
try {
    Write-Host "Execution du test GPS simple..." -ForegroundColor Yellow
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "test_gps_rapide.sql"
    
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