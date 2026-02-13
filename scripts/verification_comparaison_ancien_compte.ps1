# Script pour comparer avec l'ancien compte et vérifier les différences
# Focus sur les permissions et caractéristiques qui pourraient bloquer l'accès

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMPARAISON AVEC ANCIEN COMPTE AWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le PROPRIÉTAIRE de la base (CRITIQUE)
Write-Host "1. PROPRIETAIRE DE LA BASE (CRITIQUE)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Dans l'ancien compte, le proprietaire etait probablement yukpo_admin" -ForegroundColor Cyan
Write-Host ""

$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Proprietaire de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database WHERE datname = ''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Si le proprietaire n''est pas yukpo_admin, cela peut causer des problemes ==='",
    "echo '=== Solution: ALTER DATABASE $dbName OWNER TO $dbUser;'"
)

$paramsObject = @{
    commands = $commands
}

$paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile, $paramsJson, [System.Text.UTF8Encoding]::new($false))

$commandResult = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile -Force
$commandId = $commandResult.Command.CommandId
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

# 2. Vérifier les EXTENSIONS PostgreSQL (peuvent être manquantes)
Write-Host "2. EXTENSIONS POSTGRESQL" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "L'application peut necessiter des extensions specifiques" -ForegroundColor Cyan
Write-Host ""

$commands2 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Extensions installees ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT extname, extversion FROM pg_extension ORDER BY extname;' 2>&1",
    "echo ''",
    "echo '=== Extensions requises par l''application (pgvector, imgsmlr, etc.) ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT extname FROM pg_available_extensions WHERE extname IN (''vector'', ''imgsmlr'', ''postgis'', ''uuid-ossp'') ORDER BY extname;' 2>&1"
)

$paramsObject2 = @{ commands = $commands2 }
$paramsJson2 = $paramsObject2 | ConvertTo-Json -Compress -Depth 10
$tempFile2 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
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

# 3. Vérifier les PERMISSIONS sur le schéma public (CRITIQUE)
Write-Host "3. PERMISSIONS SCHEMA PUBLIC (CRITIQUE)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Dans l'ancien compte, yukpo_admin avait probablement tous les droits" -ForegroundColor Cyan
Write-Host ""

$commands3 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Permissions actuelles sur public ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT nspname, nspacl FROM pg_namespace WHERE nspname = ''public'';' 2>&1",
    "echo ''",
    "echo '=== Test: yukpo_admin peut-il creer des tables? ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT has_schema_privilege(''$dbUser'', ''public'', ''CREATE'');' 2>&1",
    "echo ''",
    "echo '=== Test: yukpo_admin peut-il utiliser le schema? ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT has_schema_privilege(''$dbUser'', ''public'', ''USAGE'');' 2>&1"
)

$paramsObject3 = @{ commands = $commands3 }
$paramsJson3 = $paramsObject3 | ConvertTo-Json -Compress -Depth 10
$tempFile3 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
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

# 4. Vérifier les PARAMÈTRES de connexion (peuvent différer)
Write-Host "4. PARAMETRES DE CONNEXION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Comparaison avec l'ancien compte" -ForegroundColor Cyan
Write-Host ""

$commands4 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Parametres de connexion ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW max_connections;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW shared_buffers;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW statement_timeout;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SHOW idle_in_transaction_session_timeout;' 2>&1",
    "echo ''",
    "echo '=== Test de connexion avec pool (simulation) ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT pg_backend_pid(), current_database(), current_user, inet_server_addr(), inet_server_port();' 2>&1"
)

$paramsObject4 = @{ commands = $commands4 }
$paramsJson4 = $paramsObject4 | ConvertTo-Json -Compress -Depth 10
$tempFile4 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
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

# 5. Vérifier si la base a été créée avec des options spéciales
Write-Host "5. OPTIONS DE CREATION DE LA BASE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Verification des options de creation" -ForegroundColor Cyan
Write-Host ""

$commands5 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Toutes les caracteristiques de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT datname, pg_encoding_to_char(encoding) as encoding, datcollate, datctype, datconnlimit, datallowconn, datistemplate FROM pg_database WHERE datname = ''$dbName'';' 2>&1",
    "echo ''",
    "echo '=== Si datistemplate = true, cela peut causer des problemes ==='"
)

$paramsObject5 = @{ commands = $commands5 }
$paramsJson5 = $paramsObject5 | ConvertTo-Json -Compress -Depth 10
$tempFile5 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
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
Write-Host ""
Write-Host "POINTS CRITIQUES A VERIFIER:" -ForegroundColor Yellow
Write-Host "  1. Proprietaire de la base (doit etre yukpo_admin)" -ForegroundColor White
Write-Host "  2. Permissions sur le schema public" -ForegroundColor White
Write-Host "  3. Extensions PostgreSQL requises" -ForegroundColor White
Write-Host "  4. Options de creation de la base" -ForegroundColor White

