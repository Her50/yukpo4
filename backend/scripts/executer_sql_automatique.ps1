# Script pour executer le script SQL automatiquement via ECS Exec
# Utilise expect ou une approche similaire pour automatiser la session interactive

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "Execution automatique du script SQL via ECS Exec" -ForegroundColor Cyan
Write-Host ""

# Verifier que le script SQL existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERREUR: Script SQL non trouve: $ScriptPath" -ForegroundColor Red
    exit 1
}

# Lire le script SQL
$scriptContent = Get-Content $ScriptPath -Raw -Encoding UTF8
Write-Host "Script SQL trouve: $ScriptPath ($($scriptContent.Length) caracteres)" -ForegroundColor Green

# Recuperer une tache ECS en cours d'execution
Write-Host "Recherche d'une tache ECS en cours d'execution..." -ForegroundColor Yellow
$taskArn = aws ecs list-tasks `
    --cluster $ClusterName `
    --service-name $ServiceName `
    --region $Region `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text

if (-not $taskArn -or $taskArn -match "error" -or $taskArn -eq "None") {
    Write-Host "ERREUR: Aucune tache ECS en cours d'execution trouvee" -ForegroundColor Red
    exit 1
}

Write-Host "Tache trouvee: $taskArn" -ForegroundColor Green
Write-Host ""

# Encoder le script SQL en base64
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($scriptContent))

# Creer un script bash temporaire qui sera execute
$bashScript = @"
#!/bin/bash
set -e
export PGPASSWORD=`$(echo `$DATABASE_URL | grep -oP '://[^:]+:\K[^@]+')
printf '%s' '$scriptBase64' | base64 -d | psql `$DATABASE_URL
echo "✅ Script SQL execute avec succes"
"@

# Encoder le script bash en base64
$bashScriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashScript))

Write-Host "Execution du script SQL dans la tache ECS..." -ForegroundColor Yellow
Write-Host ""

# Utiliser aws ecs execute-command avec --command pour executer directement
# Note: Cela necessite que la commande soit passee correctement
$env:PATH += ";C:\Program Files\Amazon\SessionManagerPlugin\bin"

# Essayer d'executer la commande directement via ECS Exec
# Malheureusement, ECS Exec necessite une session interactive
# Nous devons utiliser une autre approche

Write-Host "⚠️  ECS Exec necessite une session interactive" -ForegroundColor Yellow
Write-Host ""
Write-Host "Solution alternative: Utiliser le script divise en commandes courtes" -ForegroundColor Cyan
Write-Host ""

# Executer le script qui divise le SQL en commandes courtes
& "$PSScriptRoot\apply_fix_sql_direct.ps1" -ClusterName $ClusterName -Region $Region



