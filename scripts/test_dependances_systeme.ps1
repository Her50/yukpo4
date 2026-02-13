# Script pour tester les dépendances système de l'exécutable

$ErrorActionPreference = "Stop"

$cluster = "yukpo-cluster"
$taskDefinition = "yukpo-backend"
$region = "eu-west-1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 2: VERIFICATION DES DEPENDANCES" -ForegroundColor Cyan
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

Write-Host "Lancement de la tache de test pour les dependances..." -ForegroundColor Cyan

$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", "echo '=== TEST 2: Verification dependances systeme ===' && echo '' && echo '=== Commande ldd ===' && (ldd /app/yukpomnang_backend 2>&1 || echo 'ldd non disponible ou executable statique') && echo '' && echo '=== Commande readelf ===' && (readelf -d /app/yukpomnang_backend 2>&1 | grep NEEDED || echo 'readelf non disponible') && echo '' && echo '=== Verification libs critiques ===' && (ldconfig -p 2>/dev/null | grep -E 'libssl|libpq|libcrypto' || echo 'ldconfig non disponible')")
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
Write-Host "Attente de l'execution (30 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "Recuperation des logs..." -ForegroundColor Cyan
$streamName = "backend/backend/$taskId"
$events = aws logs get-log-events --log-group-name "/ecs/yukpo-backend" --log-stream-name $streamName --region $region --limit 100 --output json 2>&1 | ConvertFrom-Json

if ($events.events) {
    Write-Host ""
    Write-Host "LOGS DE LA TACHE DE TEST:" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Gray
    $events.events | ForEach-Object {
        Write-Host $_.message -ForegroundColor White
    }
} else {
    Write-Host "  ⚠️ Aucun log disponible pour le moment" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 2 TERMINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

