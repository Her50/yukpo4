# Script de correction automatique simplifié pour l'accès backend
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

# 1. DIAGNOSTIC DE LA TÂCHE
Write-Host "[1/3] DIAGNOSTIC DE LA TÂCHE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $tasks = aws ecs list-tasks --cluster $ClusterName --region $Region --output json | ConvertFrom-Json
    
    if ($tasks.taskArns.Count -gt 0) {
        Write-Host "  ✅ $($tasks.taskArns.Count) tâche(s) trouvée(s)" -ForegroundColor Green
        
        foreach ($taskArn in $tasks.taskArns) {
            $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --output json | ConvertFrom-Json
            
            if ($taskDetails.tasks) {
                $task = $taskDetails.tasks[0]
                Write-Host "`n  → Tâche: $($taskArn.Split('/')[-1])" -ForegroundColor White
                Write-Host "     Status: $($task.lastStatus)" -ForegroundColor $(if ($task.lastStatus -eq "RUNNING") { "Green" } else { "Red" })
                Write-Host "     Health: $($task.healthStatus)" -ForegroundColor $(if ($task.healthStatus -eq "HEALTHY") { "Green" } else { "Red" })
                
                if ($task.taskDefinitionArn) {
                    $taskDef = aws ecs describe-task-definition --task-definition $task.taskDefinitionArn --region $Region --output json | ConvertFrom-Json
                    if ($taskDef.taskDefinition.containerDefinitions) {
                        foreach ($containerDef in $taskDef.taskDefinition.containerDefinitions) {
                            if ($containerDef.healthCheck) {
                                Write-Host "     Health Check: $($containerDef.healthCheck.command -join ' ')" -ForegroundColor Gray
                            }
                        }
                    }
                }
            }
        }
    } else {
        Write-Host "  ❌ Aucune tâche trouvée" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

# 2. RÉCUPÉRATION DES LOGS
Write-Host "`n[2/3] RÉCUPÉRATION DES LOGS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $logStreams = aws logs describe-log-streams --log-group-name $LogGroupName --region $Region --order-by LastEventTime --descending --max-items 5 --output json 2>&1 | ConvertFrom-Json
    
    if ($logStreams.logStreams -and $logStreams.logStreams.Count -gt 0) {
        Write-Host "  ✅ $($logStreams.logStreams.Count) stream(s) trouvé(s)" -ForegroundColor Green
        
        foreach ($stream in $logStreams.logStreams) {
            $lastEvent = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$stream.lastEventTime).LocalDateTime
            Write-Host "`n  → Stream: $($stream.logStreamName)" -ForegroundColor White
            Write-Host "     Dernier événement: $($lastEvent.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
            
            $events = aws logs get-log-events --log-group-name $LogGroupName --log-stream-name $stream.logStreamName --region $Region --limit 20 --output json 2>&1 | ConvertFrom-Json
            
            if ($events.events -and $events.events.Count -gt 0) {
                Write-Host "     Derniers messages:" -ForegroundColor Gray
                $events.events | Select-Object -Last 5 | ForEach-Object {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.timestamp).LocalDateTime
                    $message = $_.message
                    $color = "White"
                    if ($message -match "error|ERROR|panic|PANIC|fail|FAIL") { $color = "Red" }
                    elseif ($message -match "warn|WARN") { $color = "Yellow" }
                    elseif ($message -match "health|listening|started") { $color = "Green" }
                    Write-Host "       [$($timestamp.ToString('HH:mm:ss'))] $message" -ForegroundColor $color
                }
            }
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

# 3. VÉRIFICATION CLOUDFLARE ET SERVICE ECS
Write-Host "`n[3/3] VÉRIFICATION CLOUDFLARE ET SERVICE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Vérifier le service ECS
try {
    $services = aws ecs list-services --cluster $ClusterName --region $Region --output json | ConvertFrom-Json
    
    if ($services.serviceArns.Count -eq 0) {
        Write-Host "  ❌ Aucun service ECS trouvé" -ForegroundColor Red
        Write-Host "`n  📋 Pour créer le service, exécutez:" -ForegroundColor Cyan
        Write-Host "     (Voir les détails de la tâche ci-dessus pour les paramètres réseau)" -ForegroundColor Gray
    } else {
        Write-Host "  ✅ Service(s) ECS trouvé(s):" -ForegroundColor Green
        foreach ($serviceArn in $services.serviceArns) {
            Write-Host "     - $($serviceArn.Split('/')[-1])" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

# Vérifier Cloudflare
try {
    Write-Host "`n  → Vérification DNS de ${DomainName}" -ForegroundColor White
    $dnsRecords = Resolve-DnsName -Name $DomainName -Type A -ErrorAction SilentlyContinue
    
    if ($dnsRecords) {
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
            Write-Host "`n  ⚠️  PROXY CLOUDFLARE DÉTECTÉ" -ForegroundColor Yellow
            Write-Host "     → Action: Désactiver le proxy sur Cloudflare Dashboard" -ForegroundColor Yellow
            Write-Host "     → URL: https://dash.cloudflare.com → DNS → Nuage orange → Gris" -ForegroundColor Cyan
        }
    }
    
    # Test de connectivité
    Write-Host "`n  → Test de connectivité..." -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "https://${DomainName}/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host "  ✅ /health accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ /health inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "✅ Diagnostic complet effectué" -ForegroundColor Green
Write-Host "`n📋 Actions recommandées:" -ForegroundColor Yellow
Write-Host "  1. Vérifier pourquoi la tâche est UNHEALTHY" -ForegroundColor Cyan
Write-Host "  2. Créer un service ECS si nécessaire" -ForegroundColor Cyan
Write-Host "  3. Désactiver le proxy Cloudflare" -ForegroundColor Cyan
Write-Host "`n========================================`n" -ForegroundColor Cyan



