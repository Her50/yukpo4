# Script pour executer les scripts SQL via ECS Exec
# Date: 2026-01-30

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1",
    [switch]$AutoConfirm
)

Write-Host "Execution des scripts SQL via ECS Exec" -ForegroundColor Cyan
Write-Host ""

# Recuperer une task en cours d'execution
Write-Host "Recherche d'une task ECS en cours d'execution..." -ForegroundColor Yellow
$taskArn = aws ecs list-tasks --region $Region --cluster $ClusterName --service-name $ServiceName --query "taskArns[0]" --output text 2>&1

if (-not $taskArn -or $taskArn -match "error" -or $taskArn -eq "None") {
    Write-Host "ERREUR: Aucune task ECS en cours d'execution trouvee" -ForegroundColor Red
    Write-Host "   Le service doit avoir au moins une task en cours d'execution" -ForegroundColor Yellow
    exit 1
}

Write-Host "Task trouvee: $taskArn" -ForegroundColor Green
Write-Host ""

# Extraire le task ID
$taskId = $taskArn -replace '.*/', ''

# Recuperer le nom du conteneur
Write-Host "Recuperation des informations de la task..." -ForegroundColor Yellow
$containerName = aws ecs describe-tasks --region $Region --cluster $ClusterName --tasks $taskArn --query "tasks[0].containers[0].name" --output text 2>&1

if (-not $containerName -or $containerName -match "error") {
    Write-Host "ERREUR: Impossible de recuperer le nom du conteneur" -ForegroundColor Red
    exit 1
}

Write-Host "Conteneur: $containerName" -ForegroundColor Green
Write-Host ""

# DATABASE_URL
$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang"

# Chemin des scripts dans le conteneur (a adapter selon votre structure)
$scriptDir = "/app/backend/scripts"
$diagnosticScript = "$scriptDir/diagnostic_migrations_aws.sql"
$fixScript = "$scriptDir/fix_migrations_aws.sql"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "ETAPE 1: DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Executer le diagnostic
Write-Host "Execution du script de diagnostic..." -ForegroundColor Yellow
$diagnosticCmd = "psql `"$databaseUrl`" -f $diagnosticScript"

Write-Host "Commande: $diagnosticCmd" -ForegroundColor Gray
Write-Host ""

$diagnosticOutput = aws ecs execute-command `
    --region $Region `
    --cluster $ClusterName `
    --task $taskId `
    --container $containerName `
    --interactive `
    --command "sh -c `"$diagnosticCmd`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Diagnostic termine avec succes" -ForegroundColor Green
} else {
    Write-Host "Diagnostic termine avec des erreurs (continuation...)" -ForegroundColor Yellow
}
Write-Host $diagnosticOutput
Write-Host ""

# Demander confirmation
if (-not $AutoConfirm) {
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "ATTENTION: Le script de correction va modifier la base de donnees" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    $confirmation = Read-Host "Voulez-vous continuer avec le script de correction? (O/N)"
    
    if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
        Write-Host ""
        Write-Host "Operation annulee par l'utilisateur" -ForegroundColor Red
        exit 0
    }
    Write-Host ""
} else {
    Write-Host "Auto-confirmation activee, continuation automatique..." -ForegroundColor Yellow
    Write-Host ""
}

# Executer la correction
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "ETAPE 2: CORRECTION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Execution du script de correction..." -ForegroundColor Yellow
$fixCmd = "psql `"$databaseUrl`" -f $fixScript"

Write-Host "Commande: $fixCmd" -ForegroundColor Gray
Write-Host ""

$fixOutput = aws ecs execute-command `
    --region $Region `
    --cluster $ClusterName `
    --task $taskId `
    --container $containerName `
    --interactive `
    --command "sh -c `"$fixCmd`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Correction terminee avec succes" -ForegroundColor Green
} else {
    Write-Host "Correction terminee avec des erreurs" -ForegroundColor Red
    exit 1
}
Write-Host $fixOutput
Write-Host ""

# Verification finale
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "ETAPE 3: VERIFICATION FINALE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Execution du diagnostic final..." -ForegroundColor Yellow
Write-Host ""

$finalOutput = aws ecs execute-command `
    --region $Region `
    --cluster $ClusterName `
    --task $taskId `
    --container $containerName `
    --interactive `
    --command "sh -c `"$diagnosticCmd`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Verification finale terminee" -ForegroundColor Green
} else {
    Write-Host "Verification finale terminee avec des erreurs" -ForegroundColor Yellow
}
Write-Host $finalOutput
Write-Host ""

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PROCESSUS TERMINE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan




