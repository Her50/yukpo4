# Script pour executer le script SQL via ECS Exec (non-interactif)
# Le plugin Session Manager doit etre installe

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "Execution du script SQL via ECS Exec" -ForegroundColor Cyan
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

# Creer la commande bash qui decode et execute le script
$bashCommand = "printf '%s' '$scriptBase64' | base64 -d | psql `$DATABASE_URL"

Write-Host "Execution du script SQL dans la tache ECS..." -ForegroundColor Yellow
Write-Host ""

# Executer la commande via ECS Exec (non-interactif)
# Note: ECS Exec necessite une session interactive, donc nous devons utiliser une approche differente
# Utiliser aws ecs execute-command avec --command pour executer directement

$env:PATH += ";C:\Program Files\Amazon\SessionManagerPlugin\bin"

# Essayer d'executer la commande directement
# Malheureusement, ECS Exec necessite une session interactive
# Nous devons utiliser une autre approche

Write-Host "⚠️  ECS Exec necessite une session interactive" -ForegroundColor Yellow
Write-Host ""
Write-Host "Solution: Executer manuellement cette commande dans un nouveau terminal:" -ForegroundColor Cyan
Write-Host ""
Write-Host "aws ecs execute-command \`" -ForegroundColor Gray
Write-Host "  --cluster $ClusterName \`" -ForegroundColor Gray
Write-Host "  --task $taskArn \`" -ForegroundColor Gray
Write-Host "  --container backend \`" -ForegroundColor Gray
Write-Host "  --command `"bash`" \`" -ForegroundColor Gray
Write-Host "  --interactive \`" -ForegroundColor Gray
Write-Host "  --region $Region" -ForegroundColor Gray
Write-Host ""
Write-Host "Puis dans le shell ECS, executez:" -ForegroundColor Cyan
Write-Host ""
Write-Host "printf '%s' '$scriptBase64' | base64 -d | psql `$DATABASE_URL" -ForegroundColor Gray
Write-Host ""



