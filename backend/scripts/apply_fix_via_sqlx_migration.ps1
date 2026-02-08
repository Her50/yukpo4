# Script pour appliquer le script SQL via sqlx migrate run dans une tache ECS
# Le script SQL doit etre dans backend/migrations/ dans le conteneur

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1"
)

Write-Host "Application du script SQL via sqlx migrate run" -ForegroundColor Cyan
Write-Host ""

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Commande pour executer sqlx migrate run
# Le script SQL doit etre dans backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
$bashCommand = "cd /app/backend && sqlx migrate run"

# Creer le JSON des overrides
$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", $bashCommand)
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Lancement de la tache ECS..." -ForegroundColor Yellow
Write-Host ""

try {
    # Utiliser le JSON directement (echapper les guillemets doubles)
    $overridesEscaped = $overrides -replace '\\', '\\' -replace '"', '\"'
    
    $taskOutput = aws ecs run-task `
        --region $Region `
        --cluster $ClusterName `
        --task-definition $TaskDefinition `
        --launch-type FARGATE `
        --network-configuration $networkConfig `
        --overrides $overridesEscaped `
        --query 'tasks[0].taskArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskOutput -notmatch "error" -and $taskOutput.Length -gt 0) {
        $taskArn = $taskOutput.Trim()
        Write-Host "✅ Tache ECS creee: $taskArn" -ForegroundColor Green
        Write-Host ""
        Write-Host "Note: Cette commande executera TOUTES les migrations, pas seulement le script de correction." -ForegroundColor Yellow
        Write-Host "Si le script SQL n'est pas dans le conteneur, la tache echouera." -ForegroundColor Yellow
    } else {
        Write-Host "❌ ERREUR: $taskOutput" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ ERREUR: $_" -ForegroundColor Red
    exit 1
}



