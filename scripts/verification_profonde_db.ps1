# Script de vérification approfondie de la base de données
# Vérifie l'utilisateur, les permissions, la base, etc.

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION PROFONDE BASE DE DONNEES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Créer le script de vérification complet (utiliser la concaténation pour éviter les problèmes d'échappement)
$verificationScript = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '========================================'",
    "echo 'VERIFICATION 1: Existence de l''utilisateur yukpo_admin'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT usename, usesuper, usecreatedb FROM pg_user WHERE usename = ''' + $dbUser + ''';" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 2: Liste de tous les utilisateurs'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT usename, usesuper, usecreatedb FROM pg_user ORDER BY usename;" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 3: Existence de la base yukpo'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT datname, datowner, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database WHERE datname = ''' + $dbName + ''';" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 4: Liste de toutes les bases'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database ORDER BY datname;" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 5: Test de connexion a la base yukpo'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT current_database(), current_user, version();" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 6: Permissions sur la base yukpo'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT datname, datacl FROM pg_database WHERE datname = ''' + $dbName + ''';" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 7: Permissions sur le schema public'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT nspname, nspacl FROM pg_namespace WHERE nspname = ''public'';" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 8: Permissions sur les tables'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = ''public'' LIMIT 10;" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 9: Test de creation de table (permissions)'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "CREATE TABLE IF NOT EXISTS test_permissions (id SERIAL PRIMARY KEY, test TEXT); DROP TABLE IF EXISTS test_permissions;" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 10: Permissions sur pg_database'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT has_database_privilege(''' + $dbUser + ''', ''' + $dbName + ''', ''CONNECT'');" 2>&1'),
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT has_database_privilege(''' + $dbUser + ''', ''' + $dbName + ''', ''CREATE'');" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 11: Test de la requete utilisee par l''application'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT 1 FROM pg_database WHERE datname=''' + $dbName + ''';" 2>&1'),
    "echo ''",
    "echo '========================================'",
    "echo 'VERIFICATION 12: Informations de connexion'",
    "echo '========================================'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();" 2>&1')
)

# Créer le fichier JSON
$paramsObject = @{
    commands = $verificationScript
}
$paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $paramsJson, $utf8NoBom)

$tempFileUnix = $tempFile -replace '\\', '/'

Write-Host "Envoi de la commande de verification approfondie..." -ForegroundColor Yellow
Write-Host ""

$sendCommandOutput = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFileUnix" `
    --region $region `
    --output json 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de l'envoi de la commande: $sendCommandOutput" -ForegroundColor Red
    exit 1
}

$sendResult = $sendCommandOutput | ConvertFrom-Json
$commandId = $sendResult.Command.CommandId

Write-Host "Commande envoyee (ID: $commandId)" -ForegroundColor Green
Write-Host "Attente de 25 secondes pour l'execution..." -ForegroundColor Yellow
Start-Sleep -Seconds 25

# Récupérer le résultat
$invocationOutput = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la recuperation du resultat: $invocationOutput" -ForegroundColor Red
    exit 1
}

$invocation = $invocationOutput | ConvertFrom-Json

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTATS DE LA VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Statut: $($invocation.Status)" -ForegroundColor $(if ($invocation.Status -eq "Success") { "Green" } else { "Red" })
Write-Host ""
Write-Host "Sortie standard:" -ForegroundColor Cyan
Write-Host $invocation.StandardOutputContent

if ($invocation.StandardErrorContent) {
    Write-Host ""
    Write-Host "Erreurs:" -ForegroundColor Yellow
    Write-Host $invocation.StandardErrorContent
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

