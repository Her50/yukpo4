# Script complet pour créer le compte super admin
# Fait tout automatiquement : configure le token, met à jour ECS, crée le compte
# Usage: .\scripts\create_admin_complete.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$TASK_FAMILY = "${PROJECT_NAME}-backend"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CRÉATION DU COMPTE SUPER ADMIN" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ÉTAPE 1: Obtenir l'ACCOUNT_ID
Write-Host "[ÉTAPE 1/4] Récupération de l'ACCOUNT_ID..." -ForegroundColor Yellow
try {
    $ACCOUNT_ID = aws sts get-caller-identity --region $REGION --query 'Account' --output text
    if ([string]::IsNullOrEmpty($ACCOUNT_ID)) {
        Write-Host "[ERROR] Impossible de récupérer l'ACCOUNT_ID" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] ACCOUNT_ID: $ACCOUNT_ID" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Erreur lors de la récupération de l'ACCOUNT_ID: $_" -ForegroundColor Red
    exit 1
}

# ÉTAPE 2: Configurer le token dans SSM
Write-Host ""
Write-Host "[ÉTAPE 2/4] Configuration du token dans SSM..." -ForegroundColor Yellow

$parameterName = "/${PROJECT_NAME}/${ENVIRONMENT}/BOOTSTRAP_SUPER_ADMIN_TOKEN"

# Vérifier si le paramètre existe
try {
    $existingTokenOutput = aws ssm get-parameter --name $parameterName --region $REGION --with-decryption --query Parameter.Value --output text 2>&1
    if ($LASTEXITCODE -eq 0 -and $existingTokenOutput -and $existingTokenOutput -notmatch "error" -and $existingTokenOutput -notmatch "ParameterNotFound") {
        Write-Host "[INFO] Token existe déjà dans SSM" -ForegroundColor Cyan
        $token = ($existingTokenOutput -split "`n" | Where-Object { $_ -notmatch "error" -and $_.Trim().Length -gt 0 } | Select-Object -First 1).Trim()
        if ([string]::IsNullOrEmpty($token)) {
            throw "Token vide"
        }
    } else {
        throw "Token n'existe pas"
    }
} catch {
    # Token n'existe pas, on va le créer
    # Générer un nouveau token
    Write-Host "[INFO] Génération d'un nouveau token..." -ForegroundColor Cyan
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $tokenArray = 1..64 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] }
    $token = -join $tokenArray
    
    # Stocker dans SSM
    $putResult = aws ssm put-parameter `
        --name $parameterName `
        --value $token `
        --type "SecureString" `
        --region $REGION `
        --description "Token secret pour l'endpoint bootstrap-super-admin (temporaire)" `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Token créé et stocké dans SSM" -ForegroundColor Green
    } else {
        # Peut-être que le paramètre existe déjà, essayer avec --overwrite
        $putResult = aws ssm put-parameter `
            --name $parameterName `
            --value $token `
            --type "SecureString" `
            --region $REGION `
            --overwrite `
            --description "Token secret pour l'endpoint bootstrap-super-admin (temporaire)" `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Token mis à jour dans SSM" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Erreur lors de la création/mise à jour du token: $putResult" -ForegroundColor Red
            exit 1
        }
    }
}

# ÉTAPE 3: Mettre à jour la task definition ECS
Write-Host ""
Write-Host "[ÉTAPE 3/4] Mise à jour de la task definition ECS..." -ForegroundColor Yellow

$tempFile = "task-def-temp-$(Get-Date -Format 'yyyyMMddHHmmss').json"
$newTaskDefFile = "task-def-new-$(Get-Date -Format 'yyyyMMddHHmmss').json"

try {
    # Exporter la task definition actuelle
    Write-Host "[INFO] Export de la task definition actuelle..." -ForegroundColor Cyan
    aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $REGION --query 'taskDefinition' --output json | Out-File -FilePath $tempFile -Encoding utf8
    
    if (-not (Test-Path $tempFile)) {
        Write-Host "[ERROR] Impossible de récupérer la task definition" -ForegroundColor Red
        exit 1
    }
    
    # Lire le JSON
    $taskDefJson = Get-Content $tempFile -Raw | ConvertFrom-Json
    
    # Vérifier si le secret existe déjà
    $secrets = $taskDefJson.containerDefinitions[0].secrets
    $secretArn = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/${ENVIRONMENT}/BOOTSTRAP_SUPER_ADMIN_TOKEN"
    
    $exists = $secrets | Where-Object { $_.name -eq "BOOTSTRAP_SUPER_ADMIN_TOKEN" }
    
    if (-not $exists) {
        Write-Host "[ADD] Ajout de BOOTSTRAP_SUPER_ADMIN_TOKEN aux secrets..." -ForegroundColor Yellow
        $secrets += @{
            name      = "BOOTSTRAP_SUPER_ADMIN_TOKEN"
            valueFrom = $secretArn
        }
        $taskDefJson.containerDefinitions[0].secrets = $secrets
    } else {
        Write-Host "[SKIP] BOOTSTRAP_SUPER_ADMIN_TOKEN existe déjà dans la task definition" -ForegroundColor Gray
        # Mettre à jour l'ARN au cas où
        $exists.valueFrom = $secretArn
    }
    
    # Supprimer les champs non nécessaires
    $taskDefJson.PSObject.Properties.Remove('taskDefinitionArn')
    $taskDefJson.PSObject.Properties.Remove('revision')
    $taskDefJson.PSObject.Properties.Remove('status')
    $taskDefJson.PSObject.Properties.Remove('requiresAttributes')
    $taskDefJson.PSObject.Properties.Remove('compatibilities')
    $taskDefJson.PSObject.Properties.Remove('registeredAt')
    $taskDefJson.PSObject.Properties.Remove('registeredBy')
    
    # Sauvegarder avec encodage UTF-8 sans BOM
    $jsonContent = $taskDefJson | ConvertTo-Json -Depth 20 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($newTaskDefFile, $jsonContent, $utf8NoBom)
    
    # Enregistrer la nouvelle task definition
    Write-Host "[INFO] Enregistrement de la nouvelle task definition..." -ForegroundColor Cyan
    $registerOutput = aws ecs register-task-definition --cli-input-json "file://$newTaskDefFile" --region $REGION --output json 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Erreur AWS CLI: $registerOutput" -ForegroundColor Red
        Write-Host "[DEBUG] Contenu du fichier JSON:" -ForegroundColor Yellow
        Get-Content $newTaskDefFile | Select-Object -First 20 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
        Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue
        exit 1
    }
    $registerResult = $registerOutput | ConvertFrom-Json
    
    if (-not $registerResult.taskDefinition) {
        Write-Host "[ERROR] Échec de l'enregistrement de la task definition" -ForegroundColor Red
        Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue
        exit 1
    }
    
    $newRevision = $registerResult.taskDefinition.revision
    Write-Host "[OK] Task definition enregistrée (révision: $newRevision)" -ForegroundColor Green
    
    # Mettre à jour le service ECS
    Write-Host "[INFO] Mise à jour du service ECS..." -ForegroundColor Cyan
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --task-definition "${TASK_FAMILY}:${newRevision}" `
        --region $REGION `
        --force-new-deployment | Out-Null
    
    Write-Host "[OK] Service ECS mis à jour! Attente du déploiement..." -ForegroundColor Green
    
    # Attendre que le service soit stable
    $maxWait = 300  # 5 minutes max
    $waited = 0
    $interval = 10
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds $interval
        $waited += $interval
        
        $serviceStatus = aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION --query 'services[0].{Running:runningCount,Desired:desiredCount,Deployments:deployments[*].{Status:status,Running:runningCount}}' --output json 2>&1 | ConvertFrom-Json
        
        if ($serviceStatus) {
            $running = $serviceStatus.Running
            $desired = $serviceStatus.Desired
            
            Write-Host "   [WAIT] Tâches: $running/$desired (attente: ${waited}s)" -ForegroundColor Gray
            
            # Vérifier si le déploiement est terminé
            $deployments = $serviceStatus.Deployments
            $primaryDeployment = $deployments | Where-Object { $_.Status -eq "PRIMARY" } | Select-Object -First 1
            
            if ($primaryDeployment -and $running -eq $desired -and $running -gt 0) {
                Write-Host "[OK] Service déployé et stable!" -ForegroundColor Green
                break
            }
        }
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "[WARNING] Timeout d'attente du déploiement, continuation..." -ForegroundColor Yellow
    }
    
    Write-Host "[INFO] Attente supplémentaire pour que le backend soit prêt (20 secondes)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 20
    
} catch {
    Write-Host "[ERROR] Erreur lors de la mise à jour de la task definition: $_" -ForegroundColor Red
    Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue
    exit 1
} finally {
    # Nettoyer
    Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue
}

# ÉTAPE 4: Appeler l'endpoint pour créer le compte
Write-Host ""
Write-Host "[ÉTAPE 4/4] Création du compte super admin via API..." -ForegroundColor Yellow

# Récupérer l'URL de l'API
$apiUrl = ""
try {
    $apiUrlFromSsm = aws ssm get-parameter --name /${PROJECT_NAME}/${ENVIRONMENT}/API_URL --region $REGION --with-decryption --query Parameter.Value --output text 2>&1
    if ($LASTEXITCODE -eq 0 -and $apiUrlFromSsm -and $apiUrlFromSsm -notmatch "error") {
        $apiUrl = $apiUrlFromSsm.Trim()
    }
} catch {
    # Ignorer
}

# Si toujours vide, essayer de récupérer depuis le load balancer
if ([string]::IsNullOrEmpty($apiUrl)) {
    Write-Host "[INFO] Tentative de récupération de l'URL depuis le load balancer..." -ForegroundColor Yellow
    try {
        # Chercher le load balancer associé au service ECS
        $serviceInfo = aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION --query 'services[0].loadBalancers[0].targetGroupArn' --output text 2>&1
        if ($LASTEXITCODE -eq 0 -and $serviceInfo -and $serviceInfo -notmatch "error" -and $serviceInfo -notmatch "None") {
            # Récupérer le load balancer depuis le target group
            $tgArn = ($serviceInfo -split "`n" | Where-Object { $_ -notmatch "error" } | Select-Object -First 1).Trim()
            if ($tgArn -and $tgArn -match "arn:aws:elasticloadbalancing") {
                $lbArn = aws elbv2 describe-target-groups --target-group-arns $tgArn --region $REGION --query 'TargetGroups[0].LoadBalancerArns[0]' --output text 2>&1
                if ($LASTEXITCODE -eq 0 -and $lbArn -and $lbArn -notmatch "error") {
                    $lbDns = aws elbv2 describe-load-balancers --load-balancer-arns $lbArn --region $REGION --query 'LoadBalancers[0].DNSName' --output text 2>&1
                    if ($LASTEXITCODE -eq 0 -and $lbDns -and $lbDns -notmatch "error") {
                        $lbDnsClean = ($lbDns -split "`n" | Where-Object { $_ -notmatch "error" } | Select-Object -First 1).Trim()
                        # Essayer HTTPS d'abord, puis HTTP
                        $apiUrl = "http://$lbDnsClean"
                        Write-Host "[OK] URL trouvée depuis le load balancer: $apiUrl" -ForegroundColor Green
                    }
                }
            }
        }
    } catch {
        # Ignorer
    }
}

# Si toujours vide, utiliser une valeur par défaut
if ([string]::IsNullOrEmpty($apiUrl)) {
    Write-Host "[WARNING] URL de l'API non trouvée automatiquement" -ForegroundColor Yellow
    Write-Host "[INFO] Utilisation de l'URL par défaut: https://api.yukpo.dev" -ForegroundColor Cyan
    Write-Host "[INFO] Si cette URL est incorrecte, définissez /${PROJECT_NAME}/${ENVIRONMENT}/API_URL dans SSM" -ForegroundColor Yellow
    $apiUrl = "https://api.yukpo.dev"
}

$apiUrl = $apiUrl.Trim().TrimEnd('/')
$endpoint = "$apiUrl/api/auth/bootstrap-super-admin"

Write-Host "[INFO] Appel de l'endpoint: $endpoint" -ForegroundColor Cyan

# Créer le body JSON
$body = @{
    secret_token = $token
} | ConvertTo-Json

try {
    # Désactiver la vérification SSL pour les load balancers AWS (certificat auto-signé)
    if ($endpoint -match "\.elb\.amazonaws\.com") {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    }
    
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ COMPTE SUPER ADMIN CRÉÉ!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Informations du compte ===" -ForegroundColor Cyan
    Write-Host "ID: $($response.user.id)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host "Rôle: $($response.user.role)" -ForegroundColor White
    Write-Host "Nom: $($response.user.nom_complet)" -ForegroundColor White
    Write-Host "Tokens: $($response.user.tokens_balance)" -ForegroundColor White
    Write-Host ""
    Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
    Write-Host "Email: $($response.credentials.email)" -ForegroundColor White
    Write-Host "Mot de passe: $($response.credentials.password)" -ForegroundColor White
    Write-Host "Rôle: $($response.credentials.role)" -ForegroundColor White
    Write-Host ""
    Write-Host "[SUCCESS] Opération terminée avec succès!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Erreur lors de l'appel de l'API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
    if ($_.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        } catch {
            # Ignorer
        }
    }
    
    Write-Host ""
    Write-Host "[INFO] Vérifiez:" -ForegroundColor Yellow
    Write-Host "  1. Que le backend est déployé avec le nouveau code" -ForegroundColor White
    Write-Host "  2. Que le service ECS a fini de redémarrer" -ForegroundColor White
    Write-Host "  3. Les logs ECS: aws logs tail /ecs/${PROJECT_NAME}-backend --region $REGION --follow" -ForegroundColor White
    
    exit 1
}

Write-Host ""
Write-Host "[INFO] Pour supprimer le token après usage:" -ForegroundColor Yellow
Write-Host "  aws ssm delete-parameter --name $parameterName --region $REGION" -ForegroundColor White

