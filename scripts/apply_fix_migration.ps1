# Script pour appliquer la migration de correction via ECS Task
# Usage: .\scripts\apply_fix_migration.ps1

$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:12"  # Utiliser la dernière révision
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION DE LA MIGRATION DE CORRECTION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Lire la migration SQL
$migrationFile = "backend/migrations/20260206_fix_all_critical_errors_complete.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "[ERROR] Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Lecture de la migration..." -ForegroundColor Yellow
$sqlScript = Get-Content $migrationFile -Raw -Encoding UTF8

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlScript))

# Commande qui decode et execute le SQL via psql
$command = "echo '$sqlBase64' | base64 -d | psql `$DATABASE_URL"

# Creer les overrides
$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @("sh", "-c", $command)
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $overridesJson, $utf8NoBom)

Write-Host "[RUN] Execution de la task ECS..." -ForegroundColor Green
Write-Host "   Migration: 20260206_fix_all_critical_errors_complete.sql" -ForegroundColor Cyan
Write-Host ""

$subnetsList = $SUBNETS -split ','
$securityGroupsList = $SECURITY_GROUPS -split ','
$networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'

$taskResult = aws ecs run-task `
    --region $REGION `
    --cluster $CLUSTER `
    --task-definition $TASK_DEFINITION `
    --launch-type FARGATE `
    --network-configuration $networkConfig `
    --overrides file://$tempFile `
    --query 'tasks[0].taskArn' `
    --output text 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $taskArn = ($taskResult -split "`n" | Select-String -Pattern '^arn:aws:ecs:' | Select-Object -First 1).Line.Trim()
    if (-not $taskArn) {
        $taskArn = $taskResult.Trim()
    }
    
    Write-Host "[OK] Task creee: $taskArn" -ForegroundColor Green
    Write-Host "[WAIT] Attente de la fin (60 secondes)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60
    
    $taskId = $taskArn -replace '.*/', ''
    Write-Host "[LOGS] Derniers logs:" -ForegroundColor Cyan
    $logs = aws logs filter-log-events `
        --log-group-name /ecs/yukpomnang-backend `
        --region $REGION `
        --filter-pattern $taskId `
        --max-items 50 `
        --query 'events[*].message' `
        --output text 2>&1
    
    if ($logs) {
        Write-Host $logs -ForegroundColor White
    } else {
        Write-Host "   (Aucun log disponible)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "[INFO] Pour voir les logs complets:" -ForegroundColor Cyan
    Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $REGION --follow" -ForegroundColor White
} else {
    Write-Host "[ERROR] Erreur: $taskResult" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Migration appliquee!" -ForegroundColor Green



