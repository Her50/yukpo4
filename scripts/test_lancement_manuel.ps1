# Script pour tester le lancement manuel de l'exécutable

$ErrorActionPreference = "Stop"

$cluster = "yukpo-cluster"
$taskDefinition = "yukpo-backend"
$region = "eu-west-1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 3: LANCEMENT MANUEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les informations du réseau
$runningTasks = aws ecs list-tasks --cluster $cluster --desired-status RUNNING --region $region --max-items 1 --output json | ConvertFrom-Json
if ($runningTasks.taskArns -and $runningTasks.taskArns.Count -gt 0) {
    $taskArn = $runningTasks.taskArns[0]
    $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
    $task = $taskDetails.tasks[0]
    $attachments = $task.attachments[0].details
    $subnetId = ($attachments | Where-Object { $_.name -eq "subnetId" }).value
    $securityGroupIds = ($attachments | Where-Object { $_.name -eq "securityGroupIds" }).value
    if (-not $securityGroupIds) {
        $securityGroupIds = @("sg-0d910f6cca6bac2e5")
    }
} else {
    $subnetId = "subnet-0bdead65f27d8039c"
    $securityGroupIds = @("sg-0d910f6cca6bac2e5")
}

Write-Host "Lancement de la tache de test pour le lancement manuel..." -ForegroundColor Cyan
Write-Host "Cette tache va essayer de lancer l'executable avec --version" -ForegroundColor Yellow
Write-Host ""

$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", "echo '=== TEST 3: Lancement manuel ===' && echo '' && echo '=== Test --version ===' && /app/yukpomnang_backend --version 2>&1 || echo 'ERREUR: Impossible de lancer --version' && echo '' && echo '=== Test lancement direct (timeout 5s) ===' && timeout 5 /app/yukpomnang_backend 2>&1 || echo 'Timeout ou erreur'")
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

if ($securityGroupIds -and $securityGroupIds.Count -gt 0) {
    $networkConfig = @{
        awsvpcConfiguration = @{
            subnets = @($subnetId)
            securityGroups = $securityGroupIds
            assignPublicIp = "DISABLED"
        }
    } | ConvertTo-Json -Depth 10
} else {
    $networkConfig = @{
        awsvpcConfiguration = @{
            subnets = @($subnetId)
            assignPublicIp = "DISABLED"
        }
    } | ConvertTo-Json -Depth 10
}
$networkConfigFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($networkConfigFile, $networkConfig, [System.Text.UTF8Encoding]::new($false))

$overridesFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($overridesFile, $overrides, [System.Text.UTF8Encoding]::new($false))

$taskResultRaw = aws ecs run-task `
    --cluster $cluster `
    --task-definition $taskDefinition `
    --launch-type FARGATE `
    --network-configuration "file://$networkConfigFile" `
    --overrides "file://$overridesFile" `
    --region $region `
    --output json 2>&1

Remove-Item $networkConfigFile -Force
Remove-Item $overridesFile -Force

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR lors du lancement de la tache:" -ForegroundColor Red
    Write-Host $taskResultRaw -ForegroundColor Red
    exit 1
}

$taskResult = $taskResultRaw | ConvertFrom-Json

if (-not $taskResult.tasks -or $taskResult.tasks.Count -eq 0) {
    Write-Host "❌ ERREUR: Aucune tache creee" -ForegroundColor Red
    exit 1
}

$taskArn = $taskResult.tasks[0].taskArn
$taskId = $taskArn.Split('/')[-1]

Write-Host "  Tache lancee: $taskId" -ForegroundColor Green
Write-Host ""
Write-Host "Attente de l'execution (40 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 40

Write-Host ""
Write-Host "Recuperation des logs..." -ForegroundColor Cyan
$streamName = "backend/backend/$taskId"
$events = aws logs get-log-events --log-group-name "/ecs/yukpo-backend" --log-stream-name $streamName --region $region --limit 100 --output json 2>&1 | ConvertFrom-Json

if ($events.events) {
    Write-Host ""
    Write-Host "LOGS DE LA TACHE DE TEST:" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Gray
    $events.events | ForEach-Object {
        $msg = $_.message
        if ($msg -match "ERREUR|ERROR|error|fail|Fail|FAIL") {
            Write-Host $msg -ForegroundColor Red
        } elseif ($msg -match "\[MAIN\]") {
            Write-Host $msg -ForegroundColor Cyan
        } else {
            Write-Host $msg -ForegroundColor White
        }
    }
} else {
    Write-Host "  ⚠️ Aucun log disponible pour le moment" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 3 TERMINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

