# Script simple pour exécuter le fichier SQL de correction
Write-Host "Exécution du fichier de correction..." -ForegroundColor Yellow

# Demander le mot de passe
$password = Read-Host "Mot de passe PostgreSQL"

# Définir la variable d'environnement
$env:PGPASSWORD = $password

# Exécuter le fichier SQL
Write-Host "Application des corrections..." -ForegroundColor Cyan

$result = psql -h localhost -U postgres -d yukpo_db -f "apply_all_fixes_direct.sql" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Corrections appliquées avec succès!" -ForegroundColor Green
    Write-Host "Résultats:" -ForegroundColor Cyan
    Write-Host $result -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors de l'application:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
}

# Nettoyage
$env:PGPASSWORD = ""

Write-Host "Terminé!" -ForegroundColor Green 