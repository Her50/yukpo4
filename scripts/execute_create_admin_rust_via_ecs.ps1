# Script pour creer le compte SUPER SUPER ADMIN via ECS Task avec binaire Rust
# Email: admin@yukpo.dev
# Mot de passe: Hernandez87
# Role: super_admin (tous les droits)
# Usage: .\scripts\execute_create_admin_rust_via_ecs.ps1

param(
    [switch]$AutoConfirm = $false
)

Write-Host "[ADMIN] Creation du compte SUPER SUPER ADMIN via ECS Task (Rust)" -ForegroundColor Green
Write-Host "   Role: super_admin (tous les droits)" -ForegroundColor Cyan
Write-Host ""

# Configuration AWS
$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION_FAMILY = "yukpomnang-backend"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

# Confirmation
if (-not $AutoConfirm) {
    Write-Host "[WARNING] Vous allez creer/mettre a jour le compte SUPER SUPER ADMIN:" -ForegroundColor Yellow
    Write-Host "   Email: admin@yukpo.dev" -ForegroundColor White
    Write-Host "   Mot de passe: Hernandez87" -ForegroundColor White
    Write-Host "   Role: super_admin (tous les droits)" -ForegroundColor White
    Write-Host ""
    Write-Host "   Cluster: $CLUSTER" -ForegroundColor Cyan
    Write-Host "   Task Definition Family: $TASK_DEFINITION_FAMILY" -ForegroundColor Cyan
    Write-Host ""
    $confirm = Read-Host "Continuer? (O/N)"
    if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "[CANCEL] Operation annulee" -ForegroundColor Red
        exit 0
    }
}

# Obtenir la derniere version de la task definition
Write-Host ""
Write-Host "[INFO] Recuperation de la task definition..." -ForegroundColor Yellow
$TASK_DEFINITION = "$TASK_DEFINITION_FAMILY:4"

try {
    $taskDefOutput = aws ecs list-task-definitions --family-prefix $TASK_DEFINITION_FAMILY --region $REGION --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text 2>&1
    if ($LASTEXITCODE -eq 0 -and $taskDefOutput) {
        $arnLine = ($taskDefOutput -split "`n" | Select-String -Pattern '^arn:aws:ecs:' | Select-Object -First 1)
        if ($arnLine) {
            $TASK_DEFINITION = $arnLine.Line.Trim()
            Write-Host "[OK] Task definition trouvee: $TASK_DEFINITION" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Utilisation de la version par defaut: $TASK_DEFINITION" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Utilisation de la version par defaut: $TASK_DEFINITION" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[INFO] Utilisation de la version par defaut: $TASK_DEFINITION" -ForegroundColor Yellow
}

# Creer les overrides JSON pour executer le binaire Rust
$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @(
                "/app/backend", "create_admin_user"
            )
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress

Write-Host "[RUN] Execution de la task ECS..." -ForegroundColor Green
Write-Host "   Cluster: $CLUSTER" -ForegroundColor Cyan
Write-Host "   Task Definition: $TASK_DEFINITION" -ForegroundColor Cyan
Write-Host ""

try {
    # Sauvegarder le JSON dans un fichier temporaire sans BOM UTF-8
    $tempOverridesFile = [System.IO.Path]::GetTempFileName() + ".json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tempOverridesFile, $overridesJson, $utf8NoBom)
    
    $subnetsList = $SUBNETS -split ','
    $securityGroupsList = $SECURITY_GROUPS -split ','
    $networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'
    
    $taskResult = aws ecs run-task `
        --region $REGION `
        --cluster $CLUSTER `
        --task-definition $TASK_DEFINITION `
        --launch-type FARGATE `
        --network-configuration $networkConfig `
        --overrides file://$tempOverridesFile `
        --query 'tasks[0].{TaskArn:taskArn,TaskId:taskArn,LastStatus:lastStatus}' `
        --output json 2>&1
    
    # Nettoyer le fichier temporaire
    Remove-Item $tempOverridesFile -Force -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0) {
        $taskInfo = $taskResult | ConvertFrom-Json
        $taskArn = $taskInfo.TaskArn
        $taskId = $taskArn -replace '.*/', ''
        
        Write-Host "[OK] Task ECS creee avec succes!" -ForegroundColor Green
        Write-Host ""
        Write-Host "[INFO] Informations de la task:" -ForegroundColor Cyan
        Write-Host "   Task ARN: $taskArn" -ForegroundColor White
        Write-Host "   Task ID: $taskId" -ForegroundColor White
        Write-Host "   Status: $($taskInfo.LastStatus)" -ForegroundColor White
        Write-Host ""
        Write-Host "[WAIT] Attente de la fin de l'execution (peut prendre 1-2 minutes)..." -ForegroundColor Yellow
        
        # Attendre que la task se termine
        $maxWait = 300
        $waited = 0
        $interval = 10
        
        while ($waited -lt $maxWait) {
            Start-Sleep -Seconds $interval
            $waited += $interval
            
            $taskStatus = aws ecs describe-tasks `
                --region $REGION `
                --cluster $CLUSTER `
                --tasks $taskArn `
                --query 'tasks[0].lastStatus' `
                --output text 2>&1
            
            if ($taskStatus -eq "STOPPED") {
                Write-Host "[OK] Task terminee" -ForegroundColor Green
                break
            }
            
            Write-Host "   Status: $taskStatus (attente: ${waited}s)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "[INFO] Verification des logs..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Pour voir les logs complets, executez:" -ForegroundColor Cyan
        Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $REGION --follow" -ForegroundColor White
        Write-Host ""
        
        # Afficher les derniers logs
        Write-Host "[LOGS] Derniers logs de la task:" -ForegroundColor Cyan
        $logs = aws logs filter-log-events `
            --log-group-name /ecs/yukpomnang-backend `
            --region $REGION `
            --filter-pattern $taskId `
            --max-items 50 `
            --query 'events[*].message' `
            --output text 2>&1
        
        if ($logs) {
            Write-Host $logs -ForegroundColor White
        } else {
            Write-Host "   (Aucun log disponible pour le moment)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
        Write-Host "Email: admin@yukpo.dev" -ForegroundColor White
        Write-Host "Mot de passe: Hernandez87" -ForegroundColor White
        Write-Host "Role: super_admin (tous les droits)" -ForegroundColor White
        
    } else {
        Write-Host "[ERROR] Erreur lors de la creation de la task ECS:" -ForegroundColor Red
        Write-Host $taskResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Operation terminee!" -ForegroundColor Green

