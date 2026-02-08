# Script pour appliquer le script SQL de correction via ECS Task one-shot
# Date: 2026-02-07

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "🚀 Application du script SQL de correction via ECS Task" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le script SQL existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ ERREUR: Script SQL non trouvé: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Script SQL trouvé: $ScriptPath" -ForegroundColor Green

# Lire le script SQL
$scriptContent = Get-Content $ScriptPath -Raw -Encoding UTF8
Write-Host "📄 Taille du script: $($scriptContent.Length) caractères" -ForegroundColor Gray

# DATABASE_URL
$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"

# Encoder le script en base64
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($scriptContent))

# Créer la commande bash qui décode et exécute le script
$scriptPathEscaped = $ScriptPath -replace "'", "''"
$bashCommand = @"
export DATABASE_URL='$databaseUrl'
export PGPASSWORD='SztViedrXvuBDyj16TWaIAs25FfUColh'
export PGSSLMODE='require'

echo '============================================================'
echo '🔧 APPLICATION DU SCRIPT DE CORRECTION SQL'
echo '============================================================'
echo ''
echo "📅 Date: \$(date '+%Y-%m-%d %H:%M:%S')"
echo "📄 Script: $scriptPathEscaped"
echo ''

# Décoder et exécuter le script SQL
echo '$scriptBase64' | base64 -d | psql `$DATABASE_URL

EXIT_CODE=`$?
if [ `$EXIT_CODE -eq 0 ]; then
    echo ''
    echo '============================================================'
    echo '✅ SCRIPT APPLIQUÉ AVEC SUCCÈS'
    echo '============================================================'
else
    echo ''
    echo '============================================================'
    echo '❌ ERREUR LORS DE L''APPLICATION DU SCRIPT (code: `$EXIT_CODE)'
    echo '============================================================'
fi

exit `$EXIT_CODE
"@

# Encoder la commande bash en base64
$commandBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashCommand))

# Configuration réseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"

# Créer le JSON des overrides
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
Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   Cluster: $ClusterName" -ForegroundColor Gray
Write-Host "   Task Definition: $TaskDefinition" -ForegroundColor Gray
Write-Host "   Region: $Region" -ForegroundColor Gray
Write-Host "   Subnets: $subnets" -ForegroundColor Gray
Write-Host "   Security Groups: $securityGroups" -ForegroundColor Gray
Write-Host ""

# Lancer la tâche ECS
Write-Host "🚀 Lancement de la tâche ECS one-shot..." -ForegroundColor Yellow
Write-Host ""

try {
    # Construire la commande AWS CLI (échapper les crochets pour PowerShell)
    $networkConfig = 'awsvpcConfiguration={subnets=[' + $subnets + '],securityGroups=[' + $securityGroups + '],assignPublicIp=ENABLED}'
    
    # Sauvegarder le JSON dans un fichier temporaire pour éviter les problèmes d'échappement
    $tempJsonFile = [System.IO.Path]::GetTempFileName()
    $overridesJson | Out-File -FilePath $tempJsonFile -Encoding UTF8 -NoNewline
    
    # Convertir le chemin Windows en format compatible AWS CLI
    $tempJsonFileUnix = $tempJsonFile -replace '\\', '/'
    if ($tempJsonFileUnix -notmatch '^/') {
        $tempJsonFileUnix = "/$tempJsonFileUnix"
    }
    
    $taskOutput = aws ecs run-task --region $Region --cluster $ClusterName --task-definition $TaskDefinition --launch-type FARGATE --network-configuration $networkConfig --overrides "file://$tempJsonFileUnix" 2>&1
    
    # Supprimer le fichier temporaire
    Remove-Item $tempJsonFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERREUR lors du lancement de la tache:" -ForegroundColor Red
        Write-Host $taskOutput -ForegroundColor Red
        exit 1
    }

    # Extraire l'ARN de la tâche
    $taskArn = ($taskOutput | ConvertFrom-Json).tasks[0].taskArn
    $taskId = $taskArn.Split('/')[-1]

    Write-Host "✅ Tache ECS creee avec succes!" -ForegroundColor Green
    Write-Host "   Task ARN: $taskArn" -ForegroundColor Gray
    Write-Host "   Task ID: $taskId" -ForegroundColor Gray
    Write-Host ""

    # Attendre que la tache se termine et afficher les logs
    Write-Host "⏳ Attente de la fin de l execution de la tache..." -ForegroundColor Yellow
    Write-Host "   (Cela peut prendre 1-2 minutes)" -ForegroundColor Gray
    Write-Host ""

    $maxWaitTime = 300  # 5 minutes max
    $elapsedTime = 0
    $checkInterval = 5   # Vérifier toutes les 5 secondes

    while ($elapsedTime -lt $maxWaitTime) {
        Start-Sleep -Seconds $checkInterval
        $elapsedTime += $checkInterval

        $taskStatus = aws ecs describe-tasks --region $Region --cluster $ClusterName --tasks $taskArn --query "tasks[0].lastStatus" --output text 2>&1

        if ($taskStatus -eq "STOPPED") {
            Write-Host "✅ Tache terminee!" -ForegroundColor Green
            Write-Host ""

            # Récupérer le code de sortie
            $exitCode = aws ecs describe-tasks --region $Region --cluster $ClusterName --tasks $taskArn --query "tasks[0].containers[0].exitCode" --output text 2>&1

            if ($exitCode -eq "0") {
                Write-Host "✅ Script SQL appliqué avec succès!" -ForegroundColor Green
            } else {
                Write-Host "❌ Le script SQL a échoué (code de sortie: $exitCode)" -ForegroundColor Red
            }

            Write-Host ""
            Write-Host "📋 Pour voir les logs complets:" -ForegroundColor Cyan
            Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $Region --follow" -ForegroundColor Gray
            Write-Host "   Ou via la console AWS: ECS > Clusters > $ClusterName > Tasks > $taskId > Logs" -ForegroundColor Gray

            exit [int]$exitCode
        }

        Write-Host "   ⏳ Statut: $taskStatus (attente: ${elapsedTime}s)" -ForegroundColor Gray
    }

    Write-Host "⏰ Timeout: La tache prend plus de temps que prevu" -ForegroundColor Yellow
    Write-Host "   Vérifiez manuellement le statut de la tâche dans la console AWS" -ForegroundColor Gray
    Write-Host "   Task ARN: $taskArn" -ForegroundColor Gray

} catch {
    Write-Host "❌ ERREUR: $_" -ForegroundColor Red
    exit 1
}

