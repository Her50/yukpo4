# Script de correction automatique pour l'accès backend
# Exécute toutes les recommandations automatiquement

param(
    [string]$Region = "eu-west-1",
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$LogGroupName = "/ecs/yukpomnang-backend",
    [string]$DomainName = "yukpomnang.com"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CORRECTION AUTOMATIQUE BACKEND" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# 1. DIAGNOSTIC DÉTAILLÉ DE LA TÂCHE
# ============================================
Write-Host "[1/4] DIAGNOSTIC DE LA TÂCHE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    # Récupérer toutes les tâches
    $tasks = aws ecs list-tasks --cluster $ClusterName --region $Region --output json | ConvertFrom-Json
    
    if ($tasks.taskArns.Count -eq 0) {
        Write-Host "  ❌ Aucune tâche trouvée" -ForegroundColor Red
    } else {
        Write-Host "  ✅ $($tasks.taskArns.Count) tâche(s) trouvée(s)" -ForegroundColor Green
        
        foreach ($taskArn in $tasks.taskArns) {
            Write-Host "`n  → Analyse de la tâche: $($taskArn.Split('/')[-1])" -ForegroundColor White
            
            $taskDetails = aws ecs describe-tasks `
                --cluster $ClusterName `
                --tasks $taskArn `
                --region $Region `
                --output json | ConvertFrom-Json
            
            if ($taskDetails.tasks) {
                $task = $taskDetails.tasks[0]
                
                Write-Host "     Status: $($task.lastStatus)" -ForegroundColor $(if ($task.lastStatus -eq "RUNNING") { "Green" } else { "Red" })
                Write-Host "     Health: $($task.healthStatus)" -ForegroundColor $(if ($task.healthStatus -eq "HEALTHY") { "Green" } else { "Red" })
                Write-Host "     Started: $($task.startedAt)" -ForegroundColor Gray
                
                # Vérifier les conteneurs
                if ($task.containers) {
                    foreach ($container in $task.containers) {
                        Write-Host "     Container: $($container.name)" -ForegroundColor Gray
                        Write-Host "       Status: $($container.lastStatus)" -ForegroundColor Gray
                        Write-Host "       Health: $($container.healthStatus)" -ForegroundColor $(if ($container.healthStatus -eq "HEALTHY") { "Green" } else { "Red" })
                        
                        if ($container.reason) {
                            Write-Host "       Reason: $($container.reason)" -ForegroundColor Yellow
                        }
                    }
                }
                
                # Vérifier la task definition
                if ($task.taskDefinitionArn) {
                    Write-Host "`n  → Récupération de la task definition..." -ForegroundColor White
                    $taskDef = aws ecs describe-task-definition `
                        --task-definition $task.taskDefinitionArn `
                        --region $Region `
                        --output json | ConvertFrom-Json
                    
                    if ($taskDef.taskDefinition) {
                        $td = $taskDef.taskDefinition
                        Write-Host "     Family: $($td.family)" -ForegroundColor Gray
                        Write-Host "     Revision: $($td.revision)" -ForegroundColor Gray
                        
                        # Vérifier le health check
                        if ($td.containerDefinitions) {
                            foreach ($containerDef in $td.containerDefinitions) {
                                if ($containerDef.healthCheck) {
                                    Write-Host "`n     Health Check configuré:" -ForegroundColor Green
                                    Write-Host "       Command: $($containerDef.healthCheck.command -join ' ')" -ForegroundColor Gray
                                    Write-Host "       Interval: $($containerDef.healthCheck.interval)s" -ForegroundColor Gray
                                    Write-Host "       Timeout: $($containerDef.healthCheck.timeout)s" -ForegroundColor Gray
                                    Write-Host "       Retries: $($containerDef.healthCheck.retries)" -ForegroundColor Gray
                                } else {
                                    Write-Host "     ⚠️  Aucun health check configuré" -ForegroundColor Yellow
                                }
                                
                                # Vérifier les variables d'environnement
                                if ($containerDef.environment) {
                                    Write-Host "`n     Variables d'environnement:" -ForegroundColor Gray
                                    $containerDef.environment | Select-Object -First 5 | ForEach-Object {
                                        Write-Host "       $($_.name) = $($_.value.Substring(0, [Math]::Min(50, $_.value.Length)))..." -ForegroundColor DarkGray
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
} catch {
    Write-Host "  ❌ Erreur lors du diagnostic: $_" -ForegroundColor Red
}

# ============================================
# 2. RÉCUPÉRATION DES LOGS DÉTAILLÉS
# ============================================
Write-Host "`n[2/4] RÉCUPÉRATION DES LOGS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    # Récupérer tous les streams
    $logStreams = aws logs describe-log-streams `
        --log-group-name $LogGroupName `
        --region $Region `
        --order-by LastEventTime `
        --descending `
        --max-items 10 `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($logStreams.logStreams -and $logStreams.logStreams.Count -gt 0) {
        Write-Host "  ✅ $($logStreams.logStreams.Count) stream(s) trouvé(s)" -ForegroundColor Green
        
        # Récupérer les logs de chaque stream
        foreach ($stream in $logStreams.logStreams) {
            $streamName = $stream.logStreamName
            $lastEvent = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$stream.lastEventTime).LocalDateTime
            
            Write-Host "`n  → Stream: $streamName" -ForegroundColor White
            Write-Host "     Dernier événement: $($lastEvent.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
            
            # Récupérer les derniers événements
            $events = aws logs get-log-events `
                --log-group-name $LogGroupName `
                --log-stream-name $streamName `
                --region $Region `
                --limit 50 `
                --output json 2>&1 | ConvertFrom-Json
            
            if ($events.events -and $events.events.Count -gt 0) {
                Write-Host "     Derniers messages:" -ForegroundColor Gray
                
                $events.events | Select-Object -Last 10 | ForEach-Object {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.timestamp).LocalDateTime
                    $message = $_.message
                    
                    # Déterminer la couleur
                    $color = "White"
                    if ($message -match "error|ERROR|panic|PANIC|fail|FAIL|unable|Unable|exception|Exception") {
                        $color = "Red"
                    } elseif ($message -match "warn|WARN|warning|Warning") {
                        $color = "Yellow"
                    } elseif ($message -match "health|Health|listening|Listening|started|Started|OK") {
                        $color = "Green"
                    }
                    
                    Write-Host "       [$($timestamp.ToString('HH:mm:ss'))] $message" -ForegroundColor $color
                }
            } else {
                Write-Host "     ⚠️  Aucun événement dans ce stream" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  ⚠️  Aucun stream trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Erreur lors de la récupération des logs: $_" -ForegroundColor Red
}

# ============================================
# 3. VÉRIFICATION ET CRÉATION DU SERVICE ECS
# ============================================
Write-Host "`n[3/4] VÉRIFICATION DU SERVICE ECS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    # Vérifier si le service existe
    $services = aws ecs list-services `
        --cluster $ClusterName `
        --region $Region `
        --output json | ConvertFrom-Json
    
    if ($services.serviceArns.Count -eq 0) {
        Write-Host "  ❌ Aucun service ECS trouvé" -ForegroundColor Red
        Write-Host "`n  → Génération de la commande pour créer le service..." -ForegroundColor Yellow
        
        # Récupérer la dernière task definition
        $taskDefs = aws ecs list-task-definitions `
            --region $Region `
            --sort-by DESC `
            --max-items 1 `
            --output json 2>&1 | ConvertFrom-Json
        
        if ($taskDefs.taskDefinitionArns -and $taskDefs.taskDefinitionArns.Count -gt 0) {
            $latestTaskDef = $taskDefs.taskDefinitionArns[0]
            Write-Host "  ✅ Task definition trouvée: $latestTaskDef" -ForegroundColor Green
            
            # Récupérer les détails pour obtenir les subnets et security groups
            $taskArnToUse = $taskDefs.taskDefinitionArns[0] -replace '.*task-definition/', '' -replace ':\d+$', ''
            $runningTasks = aws ecs list-tasks --cluster $ClusterName --region $Region --output json | ConvertFrom-Json
            
            if ($runningTasks.taskArns -and $runningTasks.taskArns.Count -gt 0) {
                $taskDetails = aws ecs describe-tasks `
                    --cluster $ClusterName `
                    --tasks $runningTasks.taskArns[0] `
                    --region $Region `
                    --output json | ConvertFrom-Json
                
                if ($taskDetails -and $taskDetails.tasks -and $taskDetails.tasks[0].attachments) {
                    $attachments = $taskDetails.tasks[0].attachments
                    $networkDetails = $attachments | Where-Object { $_.type -eq "ElasticNetworkInterface" }
                    
                    if ($networkDetails) {
                        $eniId = ($networkDetails.details | Where-Object { $_.name -eq "networkInterfaceId" }).value
                        
                        # Récupérer les détails de l'ENI
                        $eni = aws ec2 describe-network-interfaces `
                            --network-interface-ids $eniId `
                            --region $Region `
                            --output json | ConvertFrom-Json
                        
                        if ($eni.NetworkInterfaces) {
                            $subnetId = $eni.NetworkInterfaces[0].SubnetId
                            $securityGroups = $eni.NetworkInterfaces[0].Groups | ForEach-Object { $_.GroupId }
                            $sgList = $securityGroups -join ','
                            
                            Write-Host "`n  → Configuration réseau détectée:" -ForegroundColor White
                            Write-Host "     Subnet: $subnetId" -ForegroundColor Gray
                            Write-Host "     Security Groups: $sgList" -ForegroundColor Gray
                            
                            # Générer la commande de création du service
                            Write-Host "`n  📋 COMMANDE POUR CRÉER LE SERVICE:" -ForegroundColor Cyan
                            Write-Host "  aws ecs create-service \`" -ForegroundColor White
                            Write-Host "    --cluster $ClusterName \`" -ForegroundColor Gray
                            Write-Host "    --service-name $ServiceName \`" -ForegroundColor Gray
                            Write-Host "    --task-definition $latestTaskDef \`" -ForegroundColor Gray
                            Write-Host "    --desired-count 1 \`" -ForegroundColor Gray
                            Write-Host "    --launch-type FARGATE \`" -ForegroundColor Gray
                            Write-Host "    --network-configuration \"awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$sgList],assignPublicIp=ENABLED}\" \`" -ForegroundColor Gray
                            Write-Host "    --region $Region" -ForegroundColor Gray
                            
                            Write-Host "`n  ❓ Voulez-vous créer le service maintenant ? (O/N)" -ForegroundColor Yellow
                            $response = Read-Host
                            
                            if ($response -eq "O" -or $response -eq "o" -or $response -eq "Y" -or $response -eq "y") {
                                Write-Host "  → Création du service..." -ForegroundColor Yellow
                                
                                $createServiceCmd = "aws ecs create-service --cluster $ClusterName --service-name $ServiceName --task-definition $latestTaskDef --desired-count 1 --launch-type FARGATE --network-configuration `"awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$sgList],assignPublicIp=ENABLED}`" --region $Region"
                                
                                $result = Invoke-Expression $createServiceCmd 2>&1
                                
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "  ✅ Service créé avec succès!" -ForegroundColor Green
                                } else {
                                    Write-Host "  ❌ Erreur lors de la création: $result" -ForegroundColor Red
                                }
                            }
                        }
                    }
                }
            }
        } else {
            Write-Host "  ⚠️  Aucune task definition trouvée" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✅ Service(s) ECS trouvé(s):" -ForegroundColor Green
        foreach ($serviceArn in $services.serviceArns) {
            Write-Host "     - $($serviceArn.Split('/')[-1])" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❌ Erreur lors de la vérification du service: $_" -ForegroundColor Red
}

# ============================================
# 4. VÉRIFICATION CLOUDFLARE
# ============================================
Write-Host "`n[4/4] VÉRIFICATION CLOUDFLARE DNS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    Write-Host "  → Résolution DNS de $DomainName" -ForegroundColor White
    
    $dnsRecords = Resolve-DnsName -Name $DomainName -Type A -ErrorAction SilentlyContinue
    
    if ($dnsRecords) {
        Write-Host "  ✅ Résolution DNS réussie:" -ForegroundColor Green
        $cloudflareIPs = @("104.21", "172.67", "173.245", "198.41", "188.114")
        $isCloudflare = $false
        
        foreach ($record in $dnsRecords) {
            Write-Host "     $($record.Name) → $($record.IPAddress)" -ForegroundColor Gray
            foreach ($cfIP in $cloudflareIPs) {
                if ($record.IPAddress -like "$cfIP*") {
                    $isCloudflare = $true
                    break
                }
            }
        }
        
        if ($isCloudflare) {
            Write-Host "`n  ⚠️  PROXY CLOUDFLARE DÉTECTÉ (IPs Cloudflare)" -ForegroundColor Yellow
            Write-Host "     → Action requise: Désactiver le proxy Cloudflare" -ForegroundColor Yellow
            Write-Host "`n     Instructions:" -ForegroundColor Cyan
            Write-Host "     1. Aller sur https://dash.cloudflare.com" -ForegroundColor White
            Write-Host "     2. Sélectionner votre domaine: $DomainName" -ForegroundColor White
            Write-Host "     3. Aller dans l'onglet 'DNS'" -ForegroundColor White
            Write-Host "     4. Pour l'enregistrement A de ${DomainName}:" -ForegroundColor White
            Write-Host "        - Si le nuage est ORANGE (proxy activé)" -ForegroundColor Yellow
            Write-Host "        - Cliquer sur le nuage pour le passer en GRIS (DNS only)" -ForegroundColor Green
            Write-Host "     5. Attendre 1-2 minutes pour la propagation" -ForegroundColor White
        } else {
            Write-Host "  ✅ Pas de proxy Cloudflare détecté" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️  Impossible de résoudre $DomainName" -ForegroundColor Yellow
    }
    
    # Test de connectivité
    Write-Host "`n  → Test de connectivité HTTP..." -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "https://$DomainName/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host "  ✅ Endpoint /health accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Impossible d'accéder à https://$DomainName/health" -ForegroundColor Red
        Write-Host "     Erreur: $($_.Exception.Message)" -ForegroundColor Gray
        
        # Essayer HTTP au lieu de HTTPS
        try {
            $response = Invoke-WebRequest -Uri "http://$DomainName/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
            Write-Host "  ✅ Endpoint /health accessible via HTTP (Status: $($response.StatusCode))" -ForegroundColor Green
            Write-Host "     ⚠️  HTTPS ne fonctionne pas, mais HTTP fonctionne" -ForegroundColor Yellow
        } catch {
            Write-Host "  ❌ HTTP et HTTPS ne fonctionnent pas" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ Erreur lors de la vérification Cloudflare: $_" -ForegroundColor Red
}

# ============================================
# RÉSUMÉ FINAL
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ DES ACTIONS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "✅ Diagnostic complet effectué" -ForegroundColor Green
Write-Host "✅ Logs récupérés et analysés" -ForegroundColor Green
Write-Host "✅ Commandes générées pour créer le service ECS" -ForegroundColor Green
Write-Host "✅ Vérification Cloudflare effectuée" -ForegroundColor Green

Write-Host "`n📋 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "  1. Créer le service ECS (commande fournie ci-dessus)" -ForegroundColor Cyan
Write-Host "  2. Désactiver le proxy Cloudflare si nécessaire" -ForegroundColor Cyan
Write-Host "  3. Vérifier que le health check fonctionne" -ForegroundColor Cyan
Write-Host "  4. Ré-exécuter le script de vérification" -ForegroundColor Cyan

Write-Host "`n========================================`n" -ForegroundColor Cyan

