# Script de vérification approfondie des permissions PostgreSQL
# Compare avec l'ancien compte et vérifie toutes les caractéristiques

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION PROFONDE POSTGRESQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérification de l'utilisateur yukpo_admin
Write-Host "1. VERIFICATION DE L'UTILISATEUR yukpo_admin" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Informations utilisateur ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT usename, usesuper, usecreatedb, userepl, usebypassrls FROM pg_user WHERE usename = ''$dbUser'';' 2>&1",
    "echo ''",
    "echo '=== Tous les utilisateurs ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT usename, usesuper, usecreatedb FROM pg_user ORDER BY usename;' 2>&1",
    "echo ''",
    "echo '=== Rôles de l''utilisateur ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT r.rolname, r.rolsuper, r.rolcreatedb, r.rolcreaterole FROM pg_roles r JOIN pg_auth_members m ON r.oid = m.roleid JOIN pg_roles u ON m.member = u.oid WHERE u.rolname = ''$dbUser'';' 2>&1"
)

$paramsObject = @{
    commands = $commands
}

$paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10
$tempDir = [System.IO.Path]::GetTempPath()
$tempFile = Join-Path $tempDir "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile, $paramsJson, [System.Text.UTF8Encoding]::new($false))

$commandResult = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile -Force

$commandId = $commandResult.Command.CommandId
Write-Host "  Commande envoyee: $commandId" -ForegroundColor Gray

Start-Sleep -Seconds 5

$invocation = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host $invocation.StandardOutputContent -ForegroundColor White
if ($invocation.StandardErrorContent) {
    Write-Host $invocation.StandardErrorContent -ForegroundColor Yellow
}

Write-Host ""

# 2. Vérification de la base de données yukpo
Write-Host "2. VERIFICATION DE LA BASE DE DONNEES yukpo" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands2 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Informations base de donnees ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner, datacl, encoding, datcollate, datctype FROM pg_database WHERE datname = ''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Permissions sur la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT datname, datacl FROM pg_database WHERE datname = ''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Test de connexion directe ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT current_database(), current_user, version();' 2>&1"
)

$paramsObject2 = @{
    commands = $commands2
}

$paramsJson2 = $paramsObject2 | ConvertTo-Json -Compress -Depth 10
$tempFile2 = Join-Path $tempDir "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile2, $paramsJson2, [System.Text.UTF8Encoding]::new($false))

$commandResult2 = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile2" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile2 -Force

$commandId2 = $commandResult2.Command.CommandId
Start-Sleep -Seconds 5

$invocation2 = aws ssm get-command-invocation `
    --command-id $commandId2 `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host $invocation2.StandardOutputContent -ForegroundColor White
if ($invocation2.StandardErrorContent) {
    Write-Host $invocation2.StandardErrorContent -ForegroundColor Yellow
}

Write-Host ""

# 3. Vérification des permissions sur le schéma public
Write-Host "3. VERIFICATION DES PERMISSIONS SCHEMA PUBLIC" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands3 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Permissions sur le schema public ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT nspname, nspacl FROM pg_namespace WHERE nspname = ''public'';' 2>&1",
    "echo ''",
    "echo '=== Permissions sur les tables ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = ''public'' LIMIT 10;' 2>&1",
    "echo ''",
    "echo '=== Test creation table ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'CREATE TABLE IF NOT EXISTS test_permissions (id INT); DROP TABLE IF EXISTS test_permissions;' 2>&1"
)

$paramsObject3 = @{
    commands = $commands3
}

$paramsJson3 = $paramsObject3 | ConvertTo-Json -Compress -Depth 10
$tempFile3 = Join-Path $tempDir "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile3, $paramsJson3, [System.Text.UTF8Encoding]::new($false))

$commandResult3 = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile3" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile3 -Force

$commandId3 = $commandResult3.Command.CommandId
Start-Sleep -Seconds 5

$invocation3 = aws ssm get-command-invocation `
    --command-id $commandId3 `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host $invocation3.StandardOutputContent -ForegroundColor White
if ($invocation3.StandardErrorContent) {
    Write-Host $invocation3.StandardErrorContent -ForegroundColor Yellow
}

Write-Host ""

# 4. Vérification des permissions spécifiques utilisées par l'application
Write-Host "4. VERIFICATION DES PERMISSIONS SPECIFIQUES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands4 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Permission CONNECT sur la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT has_database_privilege(''$dbUser'', ''$dbName'', ''CONNECT'');' 2>&1",
    "echo ''",
    "echo '=== Permission CREATE sur la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT has_database_privilege(''$dbUser'', ''$dbName'', ''CREATE'');' 2>&1",
    "echo ''",
    "echo '=== Permission SELECT sur pg_database ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT has_schema_privilege(''$dbUser'', ''pg_catalog'', ''USAGE'');' 2>&1",
    "echo ''",
    "echo '=== Test query utilisee par l''app (detection base) ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT 1 FROM pg_database WHERE datname=''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Test query utilisee par l''app (connexion) ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT 1;' 2>&1"
)

$paramsObject4 = @{
    commands = $commands4
}

$paramsJson4 = $paramsObject4 | ConvertTo-Json -Compress -Depth 10
$tempFile4 = Join-Path $tempDir "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile4, $paramsJson4, [System.Text.UTF8Encoding]::new($false))

$commandResult4 = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile4" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile4 -Force

$commandId4 = $commandResult4.Command.CommandId
Start-Sleep -Seconds 5

$invocation4 = aws ssm get-command-invocation `
    --command-id $commandId4 `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host $invocation4.StandardOutputContent -ForegroundColor White
if ($invocation4.StandardErrorContent) {
    Write-Host $invocation4.StandardErrorContent -ForegroundColor Yellow
}

Write-Host ""

# 5. Vérification des caractéristiques de la base (encoding, locale, etc.)
Write-Host "5. VERIFICATION DES CARACTERISTIQUES DE LA BASE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands5 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Caracteristiques de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT datname, pg_encoding_to_char(encoding) as encoding, datcollate, datctype, datconnlimit, datallowconn FROM pg_database WHERE datname = ''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Parametres de connexion ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW max_connections;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW shared_buffers;' 2>&1",
    "echo ''",
    "echo '=== Version PostgreSQL ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT version();' 2>&1"
)

$paramsObject5 = @{
    commands = $commands5
}

$paramsJson5 = $paramsObject5 | ConvertTo-Json -Compress -Depth 10
$tempFile5 = Join-Path $tempDir "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile5, $paramsJson5, [System.Text.UTF8Encoding]::new($false))

$commandResult5 = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile5" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile5 -Force

$commandId5 = $commandResult5.Command.CommandId
Start-Sleep -Seconds 5

$invocation5 = aws ssm get-command-invocation `
    --command-id $commandId5 `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host $invocation5.StandardOutputContent -ForegroundColor White
if ($invocation5.StandardErrorContent) {
    Write-Host $invocation5.StandardErrorContent -ForegroundColor Yellow
}

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION TERMINEE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

