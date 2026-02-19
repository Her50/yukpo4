# Script pour diagnostiquer le probleme de connexion
# Usage: .\scripts\diagnose_login_issue.ps1

$publicIp = "34.79.199.41"
$user = "yukpo_user"
$database = "yukpo_db"
$apiBaseUrl = "https://yukpo-backend-*.a.run.app"  # A remplacer par l'URL reelle

Write-Host "Diagnostic du probleme de connexion..." -ForegroundColor Cyan
Write-Host ""

# 1. Verifier les utilisateurs dans la base
Write-Host "1. Verification des utilisateurs dans la base..." -ForegroundColor Yellow
$tempPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
gcloud sql users set-password $user --instance=yukpo-postgres --password=$tempPassword --project=yukpo-project 2>&1 | Out-Null
Start-Sleep -Seconds 2
$env:PGPASSWORD = $tempPassword

$usersQuery = "SELECT id, email, role, nom_complet, tokens_balance FROM users ORDER BY id;"
$users = & psql -h $publicIp -U $user -d $database -p 5432 -c $usersQuery 2>&1
$users | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "2. Test de connexion API..." -ForegroundColor Yellow
Write-Host "   Email: lelehernandez2007@gmail.com" -ForegroundColor Gray
Write-Host "   Email admin: admin@yukpo.dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour tester la connexion, utilisez:" -ForegroundColor Cyan
Write-Host "   curl -X POST https://VOTRE_API_URL/auth/login \" -ForegroundColor White
Write-Host "     -H 'Content-Type: application/json' \" -ForegroundColor White
Write-Host "     -d '{\"email\":\"lelehernandez2007@gmail.com\",\"password\":\"VOTRE_MOT_DE_PASSE\"}'" -ForegroundColor White
Write-Host ""

# 3. Verifier la structure de la table users
Write-Host "3. Verification de la structure de la table users..." -ForegroundColor Yellow
$structureQuery = "\d users"
$structure = & psql -h $publicIp -U $user -d $database -p 5432 -c $structureQuery 2>&1
$structure | Select-Object -First 30 | ForEach-Object { Write-Host $_ }

$env:PGPASSWORD = $null

Write-Host ""
Write-Host "4. Points a verifier pour le probleme de connexion:" -ForegroundColor Yellow
Write-Host "   - Le backend Cloud Run est-il accessible?" -ForegroundColor White
Write-Host "   - L'URL API est-elle correcte?" -ForegroundColor White
Write-Host "   - Le token JWT est-il genere correctement?" -ForegroundColor White
Write-Host "   - La navigation apres login fonctionne-t-elle?" -ForegroundColor White
Write-Host "   - Y a-t-il des erreurs dans la console du navigateur?" -ForegroundColor White
Write-Host "   - Le token est-il sauvegarde dans localStorage?" -ForegroundColor White


