# Script final pour creer le compte SUPER SUPER ADMIN via ECS Task avec psql
# psql est installe dans le conteneur (postgresql-client)
# Usage: .\scripts\create_super_admin_final_ecs.ps1

$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:4"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

Write-Host "[ADMIN] Creation du compte SUPER SUPER ADMIN via ECS (psql)" -ForegroundColor Green
Write-Host ""

# Lire le script SQL
$sqlScript = Get-Content "scripts/create_super_admin_aws.sql" -Raw -Encoding UTF8

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlScript))

# Commande qui decode et execute le SQL
$command = "echo '$sqlBase64' | base64 -d | psql `$DATABASE_URL"

# Creer les overrides
$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @(
                "sh", "-c", $command
            )
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $overridesJson, $utf8NoBom)

Write-Host "[RUN] Execution de la task ECS..." -ForegroundColor Green

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
    Write-Host "[WAIT] Attente de la fin (30 secondes)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $taskId = $taskArn -replace '.*/', ''
    Write-Host "[LOGS] Derniers logs:" -ForegroundColor Cyan
    $logs = aws logs filter-log-events `
        --log-group-name /ecs/yukpomnang-backend `
        --region $REGION `
        --filter-pattern $taskId `
        --max-items 30 `
        --query 'events[*].message' `
        --output text 2>&1
    
    if ($logs) {
        Write-Host $logs -ForegroundColor White
    } else {
        Write-Host "   (Aucun log disponible)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "=== Identifiants ===" -ForegroundColor Cyan
    Write-Host "Email: admin@yukpo.dev" -ForegroundColor White
    Write-Host "Mot de passe: Hernandez87" -ForegroundColor White
    Write-Host "Role: super_admin" -ForegroundColor White
} else {
    Write-Host "[ERROR] Erreur: $taskResult" -ForegroundColor Red
}

