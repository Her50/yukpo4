# Script PowerShell pour appliquer la migration de production
# Ce script applique la migration des tables de paiement sur Render

Write-Host "=== Application de la migration de production ===" -ForegroundColor Cyan
Write-Host "Migration des tables de paiement pour Yukpomnang" -ForegroundColor Green

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Veuillez définir la variable d'environnement DATABASE_URL" -ForegroundColor Yellow
    Write-Host "Exemple: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Blue
    exit 1
}

Write-Host "Connexion à la base de données..." -ForegroundColor Blue
Write-Host "URL: $($env:DATABASE_URL.Substring(0, [Math]::Min(50, $env:DATABASE_URL.Length)))..." -ForegroundColor Gray

try {
    # Appliquer la migration de production
    Write-Host "`n1. Application de la migration de production..." -ForegroundColor Yellow
    psql $env:DATABASE_URL -f migrations/20250926_002_create_payment_tables_production.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Erreur lors de l'application de la migration" -ForegroundColor Red
        exit 1
    }

    # Vérifier que les tables ont été créées
    Write-Host "`n2. Vérification des tables créées..." -ForegroundColor Yellow
    psql $env:DATABASE_URL -f verify_payment_tables.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Vérification terminée!" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Erreur lors de la vérification" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n=== Migration de production terminée avec succès ===" -ForegroundColor Green
    Write-Host "Les tables de paiement sont maintenant disponibles pour l'application." -ForegroundColor White
    Write-Host "Vous pouvez maintenant déployer l'application sur Render." -ForegroundColor White

} catch {
    Write-Host "`nERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Vérifiez votre connexion à la base de données et réessayez." -ForegroundColor Yellow
    exit 1
}
