# Script pour installer uuid-ossp via SSM depuis l'instance EC2
# Alternative à Query Editor qui ne fonctionne pas avec PostgreSQL standard

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION uuid-ossp VIA SSM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Méthode: Connexion via SSM depuis l'instance EC2" -ForegroundColor Gray
Write-Host ""

# 1. Vérifier si l'extension est déjà installée
Write-Host "1. VÉRIFICATION DE L'EXTENSION ACTUELLE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands1 = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';\" 2>&1"
)

$params1 = @{ commands = $commands1 } | ConvertTo-Json -Compress -Depth 10
$tempFile1 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile1, $params1, [System.Text.UTF8Encoding]::new($false))

$cmd1 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile1" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile1 -Force
Start-Sleep -Seconds 5

$inv1 = aws ssm get-command-invocation --command-id $cmd1.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv1.StandardOutputContent -ForegroundColor White

if ($inv1.StandardOutputContent -match "uuid-ossp" -and $inv1.StandardOutputContent -notmatch "0 rows") {
    Write-Host ""
    Write-Host "✅ L'extension uuid-ossp est déjà installée!" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "❌ L'extension uuid-ossp n'est pas installée" -ForegroundColor Red
Write-Host ""

# 2. Vérifier si l'extension est disponible
Write-Host "2. VÉRIFICATION DE LA DISPONIBILITÉ" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands2 = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT name, default_version FROM pg_available_extensions WHERE name = 'uuid-ossp';\" 2>&1"
)

$params2 = @{ commands = $commands2 } | ConvertTo-Json -Compress -Depth 10
$tempFile2 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile2, $params2, [System.Text.UTF8Encoding]::new($false))

$cmd2 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile2" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile2 -Force
Start-Sleep -Seconds 5

$inv2 = aws ssm get-command-invocation --command-id $cmd2.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv2.StandardOutputContent -ForegroundColor White

if ($inv2.StandardOutputContent -notmatch "uuid-ossp") {
    Write-Host ""
    Write-Host "❌ ERREUR: L'extension uuid-ossp n'est pas disponible" -ForegroundColor Red
    Write-Host ""
    Write-Host "Causes possibles:" -ForegroundColor Yellow
    Write-Host "  - L'extension n'est pas disponible sur PostgreSQL 15 RDS" -ForegroundColor White
    Write-Host "  - Des permissions spéciales sont requises" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ L'extension uuid-ossp est disponible" -ForegroundColor Green
Write-Host ""

# 3. Installer l'extension
Write-Host "3. INSTALLATION DE L'EXTENSION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Installation en cours..." -ForegroundColor Cyan

$commands3 = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"CREATE EXTENSION IF NOT EXISTS uuid-ossp;\" 2>&1"
)

$params3 = @{ commands = $commands3 } | ConvertTo-Json -Compress -Depth 10
$tempFile3 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile3, $params3, [System.Text.UTF8Encoding]::new($false))

$cmd3 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile3" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile3 -Force
Start-Sleep -Seconds 5

$inv3 = aws ssm get-command-invocation --command-id $cmd3.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv3.StandardOutputContent -ForegroundColor White

if ($inv3.StandardOutputContent -match "CREATE EXTENSION" -or $inv3.StandardOutputContent -match "already exists") {
    Write-Host ""
    Write-Host "✅ Extension uuid-ossp installée avec succès!" -ForegroundColor Green
    Write-Host ""
    
    # Vérification finale
    Write-Host "4. VÉRIFICATION FINALE" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    $commands4 = @(
        "export PGPASSWORD='$dbPassword'",
        "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';\" 2>&1"
    )
    
    $params4 = @{ commands = $commands4 } | ConvertTo-Json -Compress -Depth 10
    $tempFile4 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
    [System.IO.File]::WriteAllText($tempFile4, $params4, [System.Text.UTF8Encoding]::new($false))
    
    $cmd4 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile4" --region $region --output json | ConvertFrom-Json
    Remove-Item $tempFile4 -Force
    Start-Sleep -Seconds 5
    
    $inv4 = aws ssm get-command-invocation --command-id $cmd4.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
    Write-Host $inv4.StandardOutputContent -ForegroundColor White
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  INSTALLATION RÉUSSIE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "  1. Redémarrer le service ECS" -ForegroundColor White
    Write-Host "  2. Vérifier les logs pour confirmer le démarrage" -ForegroundColor White
    Write-Host ""
    Write-Host "Commande pour redémarrer:" -ForegroundColor Yellow
    Write-Host "  aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ ERREUR lors de l'installation" -ForegroundColor Red
    Write-Host ""
    if ($inv3.StandardErrorContent) {
        Write-Host "Erreurs:" -ForegroundColor Yellow
        Write-Host $inv3.StandardErrorContent -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Causes possibles:" -ForegroundColor Yellow
    Write-Host "  - Permissions insuffisantes pour créer des extensions" -ForegroundColor White
    Write-Host "  - L'utilisateur yukpo_admin n'a pas les droits nécessaires" -ForegroundColor White
    Write-Host ""
    Write-Host "Solution alternative:" -ForegroundColor Cyan
    Write-Host "  Utiliser un utilisateur avec permissions SUPERUSER" -ForegroundColor White
    Write-Host "  (Sur RDS, seul l'utilisateur master a ces permissions)" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TERMINÉ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

