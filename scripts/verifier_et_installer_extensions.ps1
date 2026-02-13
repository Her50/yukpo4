# Script pour vérifier et installer les extensions PostgreSQL requises
# L'application nécessite: uuid-ossp, pg_trgm, unaccent, pgcrypto, postgis, vector

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION ET INSTALLATION EXTENSIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le propriétaire de la base
Write-Host "1. VERIFICATION PROPRIETAIRE DE LA BASE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands1 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Proprietaire actuel ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database WHERE datname = ''$dbName'';' 2>&1"
)

$params1 = @{ commands = $commands1 } | ConvertTo-Json -Compress -Depth 10
$tempFile1 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile1, $params1, [System.Text.UTF8Encoding]::new($false))

$cmd1 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile1" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile1 -Force
Start-Sleep -Seconds 5

$inv1 = aws ssm get-command-invocation --command-id $cmd1.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv1.StandardOutputContent -ForegroundColor White

# Vérifier si le propriétaire est correct
if ($inv1.StandardOutputContent -notmatch "yukpo_admin") {
    Write-Host ""
    Write-Host "⚠️ Le proprietaire n'est pas yukpo_admin!" -ForegroundColor Yellow
    Write-Host "Correction du proprietaire..." -ForegroundColor Cyan
    
    $commandsFix = @(
        "export PGPASSWORD='$dbPassword'",
        "psql -h '$dbHost' -U '$dbUser' -d postgres -c 'ALTER DATABASE $dbName OWNER TO $dbUser;' 2>&1"
    )
    
    $paramsFix = @{ commands = $commandsFix } | ConvertTo-Json -Compress -Depth 10
    $tempFileFix = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
    [System.IO.File]::WriteAllText($tempFileFix, $paramsFix, [System.Text.UTF8Encoding]::new($false))
    
    $cmdFix = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFileFix" --region $region --output json | ConvertFrom-Json
    Remove-Item $tempFileFix -Force
    Start-Sleep -Seconds 3
    
    $invFix = aws ssm get-command-invocation --command-id $cmdFix.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
    Write-Host $invFix.StandardOutputContent -ForegroundColor $(if ($invFix.Status -eq "Success") { "Green" } else { "Red" })
}

Write-Host ""

# 2. Vérifier les extensions installées
Write-Host "2. EXTENSIONS INSTALLEES ACTUELLEMENT" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands2 = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT extname, extversion FROM pg_extension ORDER BY extname;' 2>&1"
)

$params2 = @{ commands = $commands2 } | ConvertTo-Json -Compress -Depth 10
$tempFile2 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile2, $params2, [System.Text.UTF8Encoding]::new($false))

$cmd2 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile2" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile2 -Force
Start-Sleep -Seconds 5

$inv2 = aws ssm get-command-invocation --command-id $cmd2.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv2.StandardOutputContent -ForegroundColor White

Write-Host ""

# 3. Vérifier les extensions disponibles
Write-Host "3. EXTENSIONS DISPONIBLES SUR RDS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands3 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Extensions requises par l''application ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN (''uuid-ossp'', ''pg_trgm'', ''unaccent'', ''pgcrypto'', ''postgis'', ''vector'') ORDER BY name;' 2>&1"
)

$params3 = @{ commands = $commands3 } | ConvertTo-Json -Compress -Depth 10
$tempFile3 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile3, $params3, [System.Text.UTF8Encoding]::new($false))

$cmd3 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile3" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile3 -Force
Start-Sleep -Seconds 5

$inv3 = aws ssm get-command-invocation --command-id $cmd3.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv3.StandardOutputContent -ForegroundColor White

Write-Host ""

# 4. Installer les extensions manquantes
Write-Host "4. INSTALLATION DES EXTENSIONS MANQUANTES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$extensions = @("uuid-ossp", "pg_trgm", "unaccent", "pgcrypto", "postgis", "vector")

foreach ($ext in $extensions) {
    Write-Host "Installation de $ext..." -ForegroundColor Cyan
    
    $commands4 = @(
        "export PGPASSWORD='$dbPassword'",
        "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'CREATE EXTENSION IF NOT EXISTS $ext;' 2>&1"
    )
    
    $params4 = @{ commands = $commands4 } | ConvertTo-Json -Compress -Depth 10
    $tempFile4 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
    [System.IO.File]::WriteAllText($tempFile4, $params4, [System.Text.UTF8Encoding]::new($false))
    
    $cmd4 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile4" --region $region --output json | ConvertFrom-Json
    Remove-Item $tempFile4 -Force
    Start-Sleep -Seconds 3
    
    $inv4 = aws ssm get-command-invocation --command-id $cmd4.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
    
    if ($inv4.Status -eq "Success") {
        if ($inv4.StandardOutputContent -match "ERROR|error") {
            Write-Host "  ⚠️ $ext : $($inv4.StandardOutputContent)" -ForegroundColor Yellow
        } else {
            Write-Host "  ✅ $ext : Installee" -ForegroundColor Green
        }
    } else {
        Write-Host "  ❌ $ext : Erreur" -ForegroundColor Red
        Write-Host "    $($inv4.StandardErrorContent)" -ForegroundColor Gray
    }
}

Write-Host ""

# 5. Vérification finale
Write-Host "5. VERIFICATION FINALE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands5 = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT extname, extversion FROM pg_extension ORDER BY extname;' 2>&1"
)

$params5 = @{ commands = $commands5 } | ConvertTo-Json -Compress -Depth 10
$tempFile5 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile5, $params5, [System.Text.UTF8Encoding]::new($false))

$cmd5 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile5" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile5 -Force
Start-Sleep -Seconds 5

$inv5 = aws ssm get-command-invocation --command-id $cmd5.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv5.StandardOutputContent -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION TERMINEE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

