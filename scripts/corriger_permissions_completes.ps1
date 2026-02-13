# Script pour corriger TOUTES les permissions PostgreSQL
# Basé sur ce qui était probablement dans l'ancien compte

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORRECTION COMPLETE DES PERMISSIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script corrige toutes les permissions pour correspondre" -ForegroundColor Cyan
Write-Host "a ce qui etait probablement dans l'ancien compte AWS" -ForegroundColor Cyan
Write-Host ""

$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== 1. Correction du proprietaire de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'ALTER DATABASE $dbName OWNER TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 2. Attribution des permissions sur la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 3. Connexion a la base pour les permissions schema ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'GRANT ALL ON SCHEMA public TO $dbUser;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'ALTER SCHEMA public OWNER TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 4. Permissions sur les tables existantes ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 5. Permissions sur les sequences ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 6. Permissions par defaut pour les futures tables ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;' 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 7. Permission SELECT sur pg_database (pour detection base) ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'GRANT SELECT ON pg_database TO $dbUser;' 2>&1",
    "echo ''",
    "echo '=== 8. Verification finale ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT current_database(), current_user, version();' 2>&1"
)

$paramsObject = @{
    commands = $commands
}

$paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile, $paramsJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "Envoi des commandes de correction..." -ForegroundColor Cyan

$commandResult = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile" `
    --region $region `
    --output json | ConvertFrom-Json

Remove-Item $tempFile -Force

$commandId = $commandResult.Command.CommandId
Write-Host "  Commande: $commandId" -ForegroundColor Gray

Write-Host ""
Write-Host "Attente de l'execution..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

$invocation = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host ""
Write-Host "Resultat:" -ForegroundColor Yellow
Write-Host $invocation.StandardOutputContent -ForegroundColor White

if ($invocation.StandardErrorContent) {
    Write-Host ""
    Write-Host "Erreurs:" -ForegroundColor Yellow
    Write-Host $invocation.StandardErrorContent -ForegroundColor $(if ($invocation.StandardErrorContent -match "WARNING|already exists") { "Yellow" } else { "Red" })
}

if ($invocation.Status -eq "Success") {
    Write-Host ""
    Write-Host "✅ Permissions corrigees avec succes!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ Certaines commandes ont peut-etre echoue (verifier les erreurs ci-dessus)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORRECTION TERMINEE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

