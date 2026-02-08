# Script pour appliquer le script SQL de correction via ECS Task one-shot
# Date: 2026-02-07

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "Application du script SQL de correction via ECS Task" -ForegroundColor Cyan
Write-Host ""

# Verifier que le script SQL existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERREUR: Script SQL non trouve: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Script SQL trouve: $ScriptPath" -ForegroundColor Green

# Lire le script SQL
$scriptContent = Get-Content $ScriptPath -Raw -Encoding UTF8
Write-Host "Taille du script: $($scriptContent.Length) caracteres" -ForegroundColor Gray

# DATABASE_URL
$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"

# Encoder le script en base64
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($scriptContent))

# Creer la commande bash
$bashCommand = "export DATABASE_URL='$databaseUrl'; export PGPASSWORD='SztViedrXvuBDyj16TWaIAs25FfUColh'; export PGSSLMODE='require'; echo '$scriptBase64' | base64 -d | psql `$DATABASE_URL"

# Encoder la commande bash en base64
$commandBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashCommand))

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"

# Creer le JSON des overrides
$overridesObj = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", "echo '$commandBase64' | base64 -d | sh")
        }
    )
}
$overridesJson = $overridesObj | ConvertTo-Json -Depth 10 -Compress

# Afficher les informations
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "   Cluster: $ClusterName" -ForegroundColor Gray
Write-Host "   Task Definition: $TaskDefinition" -ForegroundColor Gray
Write-Host "   Region: $Region" -ForegroundColor Gray
Write-Host ""

# Lancer la tache ECS
Write-Host "Lancement de la tache ECS one-shot..." -ForegroundColor Yellow
Write-Host ""

try {
    # Construire la commande AWS CLI
    $networkConfig = 'awsvpcConfiguration={subnets=[' + $subnets + '],securityGroups=[' + $securityGroups + '],assignPublicIp=ENABLED}'
    
    # Sauvegarder le JSON dans un fichier temporaire
    $tempJsonFile = [System.IO.Path]::GetTempFileName()
    $overridesJson | Out-File -FilePath $tempJsonFile -Encoding UTF8 -NoNewline
    
    # Convertir le chemin Windows en format file:// pour AWS CLI
    $tempJsonFileUri = $tempJsonFile -replace '\\', '/'
    $tempJsonFileUri = "file:///$tempJsonFileUri"
    
    # Utiliser --overrides avec le fichier
    $taskOutput = aws ecs run-task --region $Region --cluster $ClusterName --task-definition $TaskDefinition --launch-type FARGATE --network-configuration $networkConfig --overrides $tempJsonFileUri 2>&1
    
    # Supprimer le fichier temporaire
    Remove-Item $tempJsonFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR lors du lancement de la tache:" -ForegroundColor Red
        Write-Host $taskOutput -ForegroundColor Red
        exit 1
    }

    # Extraire l'ARN de la tache
    $taskArn = ($taskOutput | ConvertFrom-Json).tasks[0].taskArn
    $taskId = $taskArn.Split('/')[-1]

    Write-Host "Tache ECS creee avec succes!" -ForegroundColor Green
    Write-Host "   Task ARN: $taskArn" -ForegroundColor Gray
    Write-Host "   Task ID: $taskId" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour voir les logs:" -ForegroundColor Cyan
    Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $Region --follow" -ForegroundColor Gray
    Write-Host "   Ou via la console AWS: ECS > Clusters > $ClusterName > Tasks > $taskId > Logs" -ForegroundColor Gray

} catch {
    Write-Host "ERREUR: $_" -ForegroundColor Red
    exit 1
}

