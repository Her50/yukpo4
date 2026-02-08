# Script pour verifier l'etat de CloudShell et aider au debug

Write-Host "Verification de l'environnement CloudShell" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes a executer dans CloudShell pour diagnostiquer:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Verifier si psql est installe:" -ForegroundColor Cyan
Write-Host "   which psql" -ForegroundColor Gray
Write-Host "   psql --version" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verifier si le fichier existe:" -ForegroundColor Cyan
Write-Host "   ls -la backend/migrations/20260207_fix_all_missing_tables_and_functions.sql" -ForegroundColor Gray
Write-Host "   pwd" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Si psql n'est pas installe, installer PostgreSQL client:" -ForegroundColor Cyan
Write-Host "   sudo yum install -y postgresql15" -ForegroundColor Gray
Write-Host "   # OU" -ForegroundColor Gray
Write-Host "   sudo apt-get update && sudo apt-get install -y postgresql-client" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Si le fichier n'existe pas, cloner le repo ou telecharger le script:" -ForegroundColor Cyan
Write-Host "   git clone <votre-repo-url>" -ForegroundColor Gray
Write-Host "   # OU telecharger directement le contenu du script" -ForegroundColor Gray
Write-Host ""



