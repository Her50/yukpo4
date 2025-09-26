# Script PowerShell pour créer les tables de paiement
# À exécuter si les migrations SQLx ne fonctionnent pas

Write-Host "Création des tables de paiement..." -ForegroundColor Green

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Veuillez définir la variable d'environnement DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Exécuter le script SQL
try {
    Write-Host "Exécution du script SQL..." -ForegroundColor Blue
    psql $env:DATABASE_URL -f create_payment_tables.sql
    Write-Host "Tables de paiement créées avec succès!" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de la création des tables: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Vérification des tables créées..." -ForegroundColor Blue
psql $env:DATABASE_URL -c "\dt payment_transactions"
psql $env:DATABASE_URL -c "\dt token_transactions"
