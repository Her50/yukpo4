# Script automatique de correction pour l'accès backend
# Version simplifiée et fonctionnelle

param(
    [string]$Region = "eu-west-1",
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$LogGroupName = "/ecs/yukpomnang-backend",
    [string]$DomainName = "yukpomnang.com"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORRECTION AUTOMATIQUE BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. DIAGNOSTIC TÂCHE ECS
# ============================================
Write-Host "[1/4] DIAGNOSTIC TACHE ECS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$tasks = aws ecs list-tasks --cluster $ClusterName --region $Region --output json 2>&1 | ConvertFrom-Json

if ($tasks.taskArns -and $tasks.taskArns.Count -gt 0) {
    Write-Host "  OK: $($tasks.taskArns.Count) tache(s) trouvee(s)" -ForegroundColor Green
    
    $taskArn = $tasks.taskArns[0]
    $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --output json 2>&1 | ConvertFrom-Json
    
    if ($taskDetails.tasks) {
        $task = $taskDetails.tasks[0]
        Write-Host "  Status: $($task.lastStatus)" -ForegroundColor $(if ($task.lastStatus -eq "RUNNING") { "Green" } else { "Red" })
        Write-Host "  Health: $($task.healthStatus)" -ForegroundColor $(if ($task.healthStatus -eq "HEALTHY") { "Green" } else { "Red" })
        
        if ($task.healthStatus -eq "UNHEALTHY") {
            Write-Host "  ATTENTION: Tache UNHEALTHY - le health check echoue" -ForegroundColor Red
        }
        
        # Récupérer la task definition
        if ($task.taskDefinitionArn) {
            $taskDefArn = $task.taskDefinitionArn
            Write-Host "  Task Definition: $($taskDefArn.Split('/')[-1])" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ERREUR: Aucune tache trouvee" -ForegroundColor Red
}

# ============================================
# 2. RÉCUPÉRATION LOGS
# ============================================
Write-Host ""
Write-Host "[2/4] RECUPERATION LOGS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$logStreams = aws logs describe-log-streams --log-group-name $LogGroupName --region $Region --order-by LastEventTime --descending --max-items 3 --output json 2>&1 | ConvertFrom-Json

if ($logStreams.logStreams -and $logStreams.logStreams.Count -gt 0) {
    Write-Host "  OK: $($logStreams.logStreams.Count) stream(s) trouve(s)" -ForegroundColor Green
    
    foreach ($stream in $logStreams.logStreams) {
        $lastEvent = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$stream.lastEventTime).LocalDateTime
        Write-Host ""
        Write-Host "  Stream: $($stream.logStreamName)" -ForegroundColor White
        Write-Host "  Dernier evenement: $($lastEvent.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
        
        $events = aws logs get-log-events --log-group-name $LogGroupName --log-stream-name $stream.logStreamName --region $Region --limit 10 --output json 2>&1 | ConvertFrom-Json
        
        if ($events.events -and $events.events.Count -gt 0) {
            Write-Host "  Derniers messages:" -ForegroundColor Gray
            $events.events | Select-Object -Last 5 | ForEach-Object {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.timestamp).LocalDateTime
                $message = $_.message
                $color = "White"
                if ($message -match "error|ERROR|panic|PANIC|fail|FAIL") { $color = "Red" }
                elseif ($message -match "warn|WARN") { $color = "Yellow" }
                elseif ($message -match "health|listening|started") { $color = "Green" }
                Write-Host "    [$($timestamp.ToString('HH:mm:ss'))] $message" -ForegroundColor $color
            }
        }
    }
} else {
    Write-Host "  ATTENTION: Aucun stream trouve ou pas de logs recents" -ForegroundColor Yellow
}

# ============================================
# 3. VÉRIFICATION SERVICE ECS
# ============================================
Write-Host ""
Write-Host "[3/4] VERIFICATION SERVICE ECS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$services = aws ecs list-services --cluster $ClusterName --region $Region --output json 2>&1 | ConvertFrom-Json

if ($services.serviceArns -and $services.serviceArns.Count -gt 0) {
    Write-Host "  OK: Service(s) ECS trouve(s):" -ForegroundColor Green
    foreach ($serviceArn in $services.serviceArns) {
        Write-Host "    - $($serviceArn.Split('/')[-1])" -ForegroundColor Gray
    }
} else {
    Write-Host "  ERREUR: Aucun service ECS trouve" -ForegroundColor Red
    Write-Host ""
    Write-Host "  ACTION: Creer un service ECS" -ForegroundColor Yellow
    Write-Host ""
    
    # Essayer de récupérer les infos de la tâche pour créer le service
    if ($tasks.taskArns -and $tasks.taskArns.Count -gt 0) {
        $taskArn = $tasks.taskArns[0]
        $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --output json 2>&1 | ConvertFrom-Json
        
        if ($taskDetails.tasks -and $taskDetails.tasks[0].taskDefinitionArn) {
            $taskDefArn = $taskDetails.tasks[0].taskDefinitionArn
            
            # Récupérer les détails réseau
            $attachments = $taskDetails.tasks[0].attachments
            $networkDetails = $attachments | Where-Object { $_.type -eq "ElasticNetworkInterface" }
            
            if ($networkDetails) {
                $eniId = ($networkDetails.details | Where-Object { $_.name -eq "networkInterfaceId" }).value
                
                if ($eniId) {
                    $eni = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $Region --output json 2>&1 | ConvertFrom-Json
                    
                    if ($eni.NetworkInterfaces) {
                        $subnetId = $eni.NetworkInterfaces[0].SubnetId
                        $securityGroups = $eni.NetworkInterfaces[0].Groups | ForEach-Object { $_.GroupId }
                        $sgList = $securityGroups -join ','
                        
                        Write-Host "  Configuration detectee:" -ForegroundColor Cyan
                        Write-Host "    Subnet: $subnetId" -ForegroundColor Gray
                        Write-Host "    Security Groups: $sgList" -ForegroundColor Gray
                        Write-Host ""
                        Write-Host "  COMMANDE POUR CREER LE SERVICE:" -ForegroundColor Cyan
                        Write-Host "  aws ecs create-service --cluster $ClusterName --service-name $ServiceName --task-definition $taskDefArn --desired-count 1 --launch-type FARGATE --network-configuration `"awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$sgList],assignPublicIp=ENABLED}`" --region $Region" -ForegroundColor White
                        Write-Host ""
                        Write-Host "  Voulez-vous creer le service maintenant ? (O/N)" -ForegroundColor Yellow
                        $response = Read-Host
                        
                        if ($response -eq "O" -or $response -eq "o" -or $response -eq "Y" -or $response -eq "y") {
                            Write-Host "  Creation du service..." -ForegroundColor Yellow
                            
                            $createCmd = "aws ecs create-service --cluster $ClusterName --service-name $ServiceName --task-definition $taskDefArn --desired-count 1 --launch-type FARGATE --network-configuration `"awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$sgList],assignPublicIp=ENABLED}`" --region $Region"
                            
                            $result = Invoke-Expression $createCmd 2>&1
                            
                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "  OK: Service cree avec succes!" -ForegroundColor Green
                            } else {
                                Write-Host "  ERREUR lors de la creation: $result" -ForegroundColor Red
                            }
                        }
                    }
                }
            }
        }
    }
}

# ============================================
# 4. VÉRIFICATION CLOUDFLARE
# ============================================
Write-Host ""
Write-Host "[4/4] VERIFICATION CLOUDFLARE DNS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$dnsRecords = Resolve-DnsName -Name $DomainName -Type A -ErrorAction SilentlyContinue

if ($dnsRecords) {
    Write-Host "  Resolution DNS:" -ForegroundColor White
    $cloudflareIPs = @("104.21", "172.67", "173.245", "198.41", "188.114")
    $isCloudflare = $false
    
    foreach ($record in $dnsRecords) {
        Write-Host "    $($record.Name) -> $($record.IPAddress)" -ForegroundColor Gray
        foreach ($cfIP in $cloudflareIPs) {
            if ($record.IPAddress -like "$cfIP*") {
                $isCloudflare = $true
                break
            }
        }
    }
    
    if ($isCloudflare) {
        Write-Host ""
        Write-Host "  ATTENTION: PROXY CLOUDFLARE DETECTE" -ForegroundColor Yellow
        Write-Host "  ACTION REQUISE: Desactiver le proxy Cloudflare" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Instructions:" -ForegroundColor Cyan
        Write-Host "  1. Aller sur https://dash.cloudflare.com" -ForegroundColor White
        Write-Host "  2. Selectionner le domaine: $DomainName" -ForegroundColor White
        Write-Host "  3. Aller dans l'onglet 'DNS'" -ForegroundColor White
        Write-Host "  4. Pour l'enregistrement A de ${DomainName}:" -ForegroundColor White
        Write-Host "     - Si le nuage est ORANGE (proxy active)" -ForegroundColor Yellow
        Write-Host "     - Cliquer sur le nuage pour le passer en GRIS (DNS only)" -ForegroundColor Green
        Write-Host "  5. Attendre 1-2 minutes pour la propagation" -ForegroundColor White
    } else {
        Write-Host "  OK: Pas de proxy Cloudflare detecte" -ForegroundColor Green
    }
} else {
    Write-Host "  ATTENTION: Impossible de resoudre $DomainName" -ForegroundColor Yellow
}

# Test de connectivité
Write-Host ""
Write-Host "  Test de connectivite HTTP..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "https://$DomainName/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "  OK: /health accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: /health inaccessible" -ForegroundColor Red
    Write-Host "    Message: $($_.Exception.Message)" -ForegroundColor Gray
    
    # Essayer HTTP
    try {
        $response = Invoke-WebRequest -Uri "http://$DomainName/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host "  OK: /health accessible via HTTP (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "  ATTENTION: HTTPS ne fonctionne pas, mais HTTP fonctionne" -ForegroundColor Yellow
    } catch {
        Write-Host "  ERREUR: HTTP et HTTPS ne fonctionnent pas" -ForegroundColor Red
    }
}

# ============================================
# RÉSUMÉ FINAL
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUME DES ACTIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK: Diagnostic complet effectue" -ForegroundColor Green
Write-Host ""
Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "  1. Verifier pourquoi la tache est UNHEALTHY (voir logs ci-dessus)" -ForegroundColor Cyan
Write-Host "  2. Creer un service ECS si necessaire (commande fournie ci-dessus)" -ForegroundColor Cyan
Write-Host "  3. Desactiver le proxy Cloudflare (instructions fournies ci-dessus)" -ForegroundColor Cyan
Write-Host "  4. Re-executer ce script pour verifier" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

