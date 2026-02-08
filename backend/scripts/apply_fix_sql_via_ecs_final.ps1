# Script final pour appliquer le script SQL via ECS Task
# Utilise le script SQL complet encode en base64

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "Application du script SQL via ECS Task" -ForegroundColor Cyan
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

# Creer la commande bash qui decode et execute le script
# Utiliser printf au lieu de echo pour eviter les problemes avec les caracteres speciaux
$bashCommand = @"
export DATABASE_URL='$databaseUrl'
export PGPASSWORD='SztViedrXvuBDyj16TWaIAs25FfUColh'
export PGSSLMODE='require'
printf '%s' '$scriptBase64' | base64 -d | psql `$DATABASE_URL
EXIT_CODE=`$?
if [ `$EXIT_CODE -eq 0 ]; then
    echo '✅ Script SQL applique avec succes'
else
    echo '❌ Erreur lors de l application du script SQL (code: `$EXIT_CODE)'
fi
exit `$EXIT_CODE
"@

# Encoder la commande bash en base64
$commandBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashCommand))

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Creer le JSON des overrides
# IMPORTANT: Passer DATABASE_URL dans environment pour eviter les secrets SSM
$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", "printf '%s' '$commandBase64' | base64 -d | sh")
            environment = @(
                @{ name = "DATABASE_URL"; value = $databaseUrl }
            )
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Lancement de la tache ECS..." -ForegroundColor Yellow
Write-Host ""

try {
    # Creer le JSON complet pour cli-input-json
    $taskInput = @{
        cluster = $ClusterName
        taskDefinition = $TaskDefinition
        launchType = "FARGATE"
        networkConfiguration = @{
            awsvpcConfiguration = @{
                subnets = @("subnet-0d1d2b813746c5f87", "subnet-0c6ca723d83535ef5")
                securityGroups = @("sg-0f9210abfa33d52d4")
                assignPublicIp = "ENABLED"
            }
        }
        overrides = @{
            containerOverrides = @(
                @{
                    name = "backend"
                    command = @("sh", "-c", "printf '%s' '$commandBase64' | base64 -d | sh")
                    environment = @(
                        @{ name = "DATABASE_URL"; value = $databaseUrl }
                    )
                }
            )
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    # Sauvegarder dans un fichier temporaire
    $tempFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
    [System.IO.File]::WriteAllText($tempFile, $taskInput, [System.Text.UTF8Encoding]::new($false))
    
    # Utiliser cli-input-json avec le chemin Windows direct
    $taskOutput = aws ecs run-task `
        --cli-input-json "file://$($tempFile -replace '\\', '/')" `
        --region $Region `
        --query 'tasks[0].taskArn' `
        --output text `
        2>&1
    
    # Supprimer le fichier temporaire
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0 -and $taskOutput -notmatch "error" -and $taskOutput.Length -gt 0) {
        $taskArn = $taskOutput.Trim()
        $taskId = $taskArn.Split('/')[-1]
        
        Write-Host "✅ Tache ECS creee avec succes!" -ForegroundColor Green
        Write-Host "   Task ARN: $taskArn" -ForegroundColor Gray
        Write-Host "   Task ID: $taskId" -ForegroundColor Gray
        Write-Host ""
        Write-Host "⏳ Attente de la fin de l execution (peut prendre 1-2 minutes)..." -ForegroundColor Yellow
        Write-Host ""
        
        # Attendre que la tache se termine
        $maxWaitTime = 300
        $elapsedTime = 0
        $checkInterval = 5
        
        while ($elapsedTime -lt $maxWaitTime) {
            Start-Sleep -Seconds $checkInterval
            $elapsedTime += $checkInterval
            
            $taskStatus = aws ecs describe-tasks `
                --region $Region `
                --cluster $ClusterName `
                --tasks $taskArn `
                --query 'tasks[0].lastStatus' `
                --output text `
                2>&1
            
            if ($taskStatus -eq "STOPPED") {
                Write-Host "✅ Tache terminee!" -ForegroundColor Green
                Write-Host ""
                
                # Recuperer le code de sortie
                $exitCode = aws ecs describe-tasks `
                    --region $Region `
                    --cluster $ClusterName `
                    --tasks $taskArn `
                    --query 'tasks[0].containers[0].exitCode' `
                    --output text `
                    2>&1
                
                if ($exitCode -eq "0") {
                    Write-Host "✅ Script SQL applique avec succes!" -ForegroundColor Green
                } else {
                    Write-Host "❌ Le script SQL a echoue (code de sortie: $exitCode)" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Verifiez les logs:" -ForegroundColor Yellow
                    Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $Region --follow" -ForegroundColor Gray
                }
                
                Write-Host ""
                Write-Host "Pour voir les logs complets:" -ForegroundColor Cyan
                Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $Region --follow" -ForegroundColor Gray
                Write-Host "   Ou via la console AWS: ECS > Clusters > $ClusterName > Tasks > $taskId > Logs" -ForegroundColor Gray
                
                exit [int]$exitCode
            }
            
            Write-Host "   Statut: $taskStatus (attente: ${elapsedTime}s)" -ForegroundColor Gray
        }
        
        Write-Host "⏰ Timeout: La tache prend plus de temps que prevu" -ForegroundColor Yellow
        Write-Host "   Verifiez manuellement le statut de la tache dans la console AWS" -ForegroundColor Gray
        
    } else {
        Write-Host "❌ ERREUR lors du lancement de la tache:" -ForegroundColor Red
        Write-Host $taskOutput -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ ERREUR: $_" -ForegroundColor Red
    exit 1
}

