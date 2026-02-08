# Script simple pour exécuter les migrations via ECS Task
$subnetId = "subnet-0d1d2b813746c5f87"
$sgId = "sg-0f9210abfa33d52d4"

Write-Host "🚀 Création de la tâche ECS pour exécuter sqlx migrate run..." -ForegroundColor Cyan

$taskJson = aws ecs run-task `
    --cluster yukpomnang-cluster `
    --task-definition yukpomnang-backend `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$sgId],assignPublicIp=DISABLED}" `
    --overrides '{"containerOverrides":[{"name":"backend","command":["sqlx","migrate","run"]}]}' `
    --region us-east-1 `
    --output json | ConvertFrom-Json

$taskArn = $taskJson.tasks[0].taskArn
$taskId = $taskArn -replace '.*/', ''

Write-Host "✅ Tâche créée: $taskId" -ForegroundColor Green
Write-Host "   ARN: $taskArn" -ForegroundColor Gray
Write-Host ""
Write-Host "⏳ Attente de la fin de l'exécution (peut prendre 1-3 minutes)..." -ForegroundColor Yellow

# Attendre et vérifier le statut
$maxWait = 180
$elapsed = 0
$completed = $false

while ($elapsed -lt $maxWait -and -not $completed) {
    Start-Sleep -Seconds 15
    $elapsed += 15
    
    $taskInfo = aws ecs describe-tasks `
        --cluster yukpomnang-cluster `
        --tasks $taskArn `
        --region us-east-1 `
        --query 'tasks[0]' `
        --output json | ConvertFrom-Json
    
    $status = $taskInfo.lastStatus
    Write-Host "   Statut: $status ($elapsed s)" -ForegroundColor Gray
    
    if ($status -eq "STOPPED") {
        $completed = $true
        $exitCode = $taskInfo.containers[0].exitCode
        Write-Host ""
        if ($exitCode -eq 0) {
            Write-Host "✅ Migrations exécutées avec succès! (code: $exitCode)" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Code de sortie: $exitCode" -ForegroundColor Yellow
        }
    }
}

if (-not $completed) {
    Write-Host ""
    Write-Host "⚠️ Timeout atteint, la tâche est peut-être encore en cours" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Pour voir les logs détaillés:" -ForegroundColor Cyan
Write-Host "   aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1" -ForegroundColor White
Write-Host ""



