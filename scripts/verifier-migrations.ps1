# Script pour verifier les migrations appliquees
$dbUrl = 'postgresql://yukpo_admin:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cxs88i6ig9dp.eu-west-1.rds.amazonaws.com:5432/yukpomnang'
$totalMigrations = (Get-ChildItem -Path "backend\migrations" -Filter "*.sql").Count

Write-Host 'Verification des migrations...' -ForegroundColor Cyan
Write-Host "Total de migrations disponibles: $totalMigrations" -ForegroundColor Yellow
Write-Host ""

# Compter les migrations appliquees
$query = 'SELECT COUNT(*) as total FROM _sqlx_migrations WHERE success = true;'
$result = psql $dbUrl -c $query -t 2>&1

if ($LASTEXITCODE -eq 0) {
    $appliedCount = [int]($result.Trim())
    $percentage = [math]::Round(($appliedCount / $totalMigrations) * 100, 2)
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "RESULTATS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Migrations appliquees: $appliedCount / $totalMigrations" -ForegroundColor Green
    Write-Host "Pourcentage: $percentage%" -ForegroundColor Green
    Write-Host ""
    
    if ($appliedCount -eq $totalMigrations) {
        Write-Host "TOUTES LES MIGRATIONS ONT ETE APPLIQUEES !" -ForegroundColor Green
    } elseif ($appliedCount -gt 0) {
        $remaining = $totalMigrations - $appliedCount
        Write-Host "$remaining migrations restantes" -ForegroundColor Yellow
    } else {
        Write-Host "Aucune migration appliquee" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Pour voir les details:" -ForegroundColor Cyan
    Write-Host "  psql $dbUrl -c 'SELECT version, description FROM _sqlx_migrations WHERE success = true ORDER BY version;'" -ForegroundColor Gray
} else {
    Write-Host "Erreur lors de la connexion a la base de donnees" -ForegroundColor Red
    Write-Host "Erreur: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez que:" -ForegroundColor Yellow
    Write-Host "  1. La tache de migration est terminee (exitCode: 0)" -ForegroundColor White
    Write-Host "  2. psql est installe et accessible" -ForegroundColor White
    Write-Host "  3. La base de donnees RDS est accessible depuis votre reseau" -ForegroundColor White
}
