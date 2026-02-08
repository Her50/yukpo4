# Script de vérification automatique pour l'accès backend via liens externes
# Vérifie : AWS ECS, Cloudflare DNS, CloudWatch Logs
# Usage: .\scripts\verify-backend-access-external-links.ps1

param(
    [string]$Region = "eu-west-1",
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$LogGroupName = "/ecs/yukpomnang-backend",
    [string]$DomainName = "yukpomnang.com",
    [int]$LogMinutes = 30
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION ACCES BACKEND EXTERNE" -ForegroundColor Cyan
Write-Host "  (Liens partagés à l'extérieur)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allChecksPassed = $true

# ============================================
# 1. VERIFICATION AWS ECS
# ============================================
Write-Host "[1/3] VERIFICATION AWS ECS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    # Vérifier le cluster
    Write-Host "  → Vérification du cluster: $ClusterName" -ForegroundColor White
    $cluster = aws ecs describe-clusters `
        --clusters $ClusterName `
        --region $Region `
        --include CONFIGURATIONS `
        --output json 2>&1 | ConvertFrom-Json
    
    if (-not $cluster.clusters -or $cluster.clusters.Count -eq 0) {
        Write-Host "  ❌ Cluster '$ClusterName' introuvable" -ForegroundColor Red
        $allChecksPassed = $false
    } else {
        $clusterInfo = $cluster.clusters[0]
        Write-Host "  ✅ Cluster trouvé: $($clusterInfo.clusterName)" -ForegroundColor Green
        Write-Host "     Status: $($clusterInfo.status)" -ForegroundColor Gray
        Write-Host "     ARN: $($clusterInfo.clusterArn)" -ForegroundColor Gray
    }
    
    # Vérifier le service
    Write-Host "`n  → Vérification du service: $ServiceName" -ForegroundColor White
    $service = aws ecs describe-services `
        --cluster $ClusterName `
        --services $ServiceName `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if (-not $service.services -or $service.services.Count -eq 0) {
        Write-Host "  ❌ Service '$ServiceName' introuvable" -ForegroundColor Red
        $allChecksPassed = $false
    } else {
        $serviceInfo = $service.services[0]
        $status = $serviceInfo.status
        $runningCount = $serviceInfo.runningCount
        $desiredCount = $serviceInfo.desiredCount
        
        Write-Host "  ✅ Service trouvé: $($serviceInfo.serviceName)" -ForegroundColor Green
        Write-Host "     Status: $status" -ForegroundColor $(if ($status -eq "ACTIVE") { "Green" } else { "Red" })
        Write-Host "     Running: $runningCount / Desired: $desiredCount" -ForegroundColor $(if ($runningCount -gt 0) { "Green" } else { "Red" })
        
        if ($status -ne "ACTIVE") {
            Write-Host "  ⚠️  ATTENTION: Service n'est pas ACTIVE" -ForegroundColor Red
            $allChecksPassed = $false
        }
        
        if ($runningCount -eq 0) {
            Write-Host "  ⚠️  ATTENTION: Aucune tâche en cours d'exécution" -ForegroundColor Red
            $allChecksPassed = $false
        }
        
        if ($runningCount -lt $desiredCount) {
            Write-Host "  ⚠️  ATTENTION: Nombre de tâches en cours inférieur au nombre souhaité" -ForegroundColor Yellow
        }
        
        # Vérifier les événements récents
        if ($serviceInfo.events) {
            Write-Host "`n     Derniers événements:" -ForegroundColor Gray
            $serviceInfo.events | Select-Object -First 3 | ForEach-Object {
                $eventTime = $_.createdAt
                $eventMsg = $_.message
                Write-Host "       [$eventTime] $eventMsg" -ForegroundColor $(if ($eventMsg -match "error|fail|unable") { "Red" } else { "Gray" })
            }
        }
    }
    
} catch {
    Write-Host "  ❌ Erreur lors de la vérification ECS: $_" -ForegroundColor Red
    $allChecksPassed = $false
}

# ============================================
# 2. VERIFICATION CLOUDFLARE DNS
# ============================================
Write-Host "`n[2/3] VERIFICATION CLOUDFLARE DNS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    Write-Host "  → Vérification DNS pour: $DomainName" -ForegroundColor White
    
    # Vérifier si Cloudflare CLI est installé
    $cloudflareInstalled = $false
    try {
        $cfVersion = cloudflared --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $cloudflareInstalled = $true
        }
    } catch {
        # Cloudflare CLI non installé, utiliser l'API REST
    }
    
    if (-not $cloudflareInstalled) {
        Write-Host "  ⚠️  Cloudflare CLI non détecté" -ForegroundColor Yellow
        Write-Host "     → Vérification manuelle requise:" -ForegroundColor Yellow
        Write-Host "       1. Aller sur Cloudflare Dashboard → DNS" -ForegroundColor Cyan
        Write-Host "       2. Chercher l'enregistrement pour $DomainName" -ForegroundColor Cyan
        Write-Host "       3. Si le proxy est activé (nuage orange) → désactiver (nuage gris)" -ForegroundColor Cyan
        Write-Host "`n     → Vérification via DNS publique:" -ForegroundColor Yellow
        
        # Vérifier via DNS publique
        try {
            $dnsRecords = Resolve-DnsName -Name $DomainName -Type A -ErrorAction SilentlyContinue
            if ($dnsRecords) {
                Write-Host "     ✅ Résolution DNS réussie:" -ForegroundColor Green
                $dnsRecords | ForEach-Object {
                    Write-Host "        $($_.Name) → $($_.IPAddress)" -ForegroundColor Gray
                }
            } else {
                Write-Host "     ⚠️  Impossible de résoudre $DomainName" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "     ⚠️  Erreur lors de la résolution DNS: $_" -ForegroundColor Yellow
        }
    } else {
        # Utiliser Cloudflare CLI si disponible
        Write-Host "  → Utilisation de Cloudflare CLI" -ForegroundColor White
        # Note: Nécessite une configuration Cloudflare API token
        Write-Host "     ⚠️  Configuration API token requise pour vérification automatique" -ForegroundColor Yellow
    }
    
    # Vérifier la connectivité au domaine
    Write-Host "`n  → Test de connectivité HTTP:" -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "https://$DomainName/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "     ✅ Endpoint /health accessible" -ForegroundColor Green
        } else {
            Write-Host "     ⚠️  Endpoint /health retourne: $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "     ⚠️  Impossible d'accéder à https://$DomainName/health" -ForegroundColor Yellow
        Write-Host "        Erreur: $($_.Exception.Message)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "  ❌ Erreur lors de la vérification Cloudflare: $_" -ForegroundColor Red
}

# ============================================
# 3. VERIFICATION CLOUDWATCH LOGS
# ============================================
Write-Host "`n[3/3] VERIFICATION CLOUDWATCH LOGS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    Write-Host "  → Vérification du log group: $LogGroupName" -ForegroundColor White
    
    # Vérifier si le log group existe
    $logGroup = aws logs describe-log-groups `
        --log-group-name-prefix $LogGroupName `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if (-not $logGroup.logGroups -or $logGroup.logGroups.Count -eq 0) {
        Write-Host "  ❌ Log group '$LogGroupName' introuvable" -ForegroundColor Red
        $allChecksPassed = $false
    } else {
        $lgInfo = $logGroup.logGroups[0]
        Write-Host "  ✅ Log group trouvé: $($lgInfo.logGroupName)" -ForegroundColor Green
        Write-Host "     Taille: $([math]::Round($lgInfo.storedBytes / 1MB, 2)) MB" -ForegroundColor Gray
        
        # Récupérer les logs récents
        Write-Host "`n  → Analyse des logs des dernières $LogMinutes minutes:" -ForegroundColor White
        
        $logs = aws logs tail $LogGroupName `
            --since "${LogMinutes}m" `
            --region $Region `
            --format short `
            --filter-pattern "ERROR" `
            2>&1
        
        if ($logs) {
            $errorCount = ($logs | Select-String -Pattern "ERROR|error|Error|FAIL|fail|Fail|PANIC|panic|Panic|EXCEPTION|exception|Exception").Count
            $warnCount = ($logs | Select-String -Pattern "WARN|warn|Warn|WARNING|warning|Warning").Count
            
            Write-Host "     Erreurs trouvées: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
            Write-Host "     Avertissements: $warnCount" -ForegroundColor $(if ($warnCount -gt 0) { "Yellow" } else { "Gray" })
            
            if ($errorCount -gt 0) {
                Write-Host "`n     ⚠️  ERREURS RECENTES DETECTEES:" -ForegroundColor Red
                $logs | Select-String -Pattern "ERROR|error|Error|FAIL|fail|Fail|PANIC|panic|Panic|EXCEPTION|exception|Exception" `
                    | Select-Object -First 10 `
                    | ForEach-Object {
                        Write-Host "       $_" -ForegroundColor Red
                    }
                $allChecksPassed = $false
            }
            
            # Vérifier les logs de santé
            $healthLogs = aws logs tail $LogGroupName `
                --since "${LogMinutes}m" `
                --region $Region `
                --format short `
                --filter-pattern "health|Health|HEALTH|listening|Listening|LISTENING|started|Started|STARTED" `
                2>&1
            
            if ($healthLogs) {
                $healthCount = ($healthLogs | Measure-Object -Line).Lines
                Write-Host "`n     Logs de santé: $healthCount lignes" -ForegroundColor Green
                
                # Afficher les dernières lignes de santé
                Write-Host "`n     Dernières lignes de santé:" -ForegroundColor Gray
                $healthLogs | Select-Object -Last 5 | ForEach-Object {
                    Write-Host "       $_" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "     ⚠️  Aucun log trouvé dans les dernières $LogMinutes minutes" -ForegroundColor Yellow
        }
        
        # Récupérer les log streams
        Write-Host "`n  → Vérification des log streams:" -ForegroundColor White
        $logStreams = aws logs describe-log-streams `
            --log-group-name $LogGroupName `
            --region $Region `
            --order-by LastEventTime `
            --descending `
            --max-items 5 `
            --output json 2>&1 | ConvertFrom-Json
        
        if ($logStreams.logStreams -and $logStreams.logStreams.Count -gt 0) {
            Write-Host "     ✅ $($logStreams.logStreams.Count) stream(s) actif(s)" -ForegroundColor Green
            $logStreams.logStreams | Select-Object -First 3 | ForEach-Object {
                $lastEvent = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.lastEventTime).LocalDateTime
                Write-Host "       - $($_.logStreamName) (dernier: $($lastEvent.ToString('HH:mm:ss')))" -ForegroundColor Gray
            }
        } else {
            Write-Host "     ⚠️  Aucun stream actif" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "  ❌ Erreur lors de la vérification CloudWatch: $_" -ForegroundColor Red
    $allChecksPassed = $false
}

# ============================================
# RESUME FINAL
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESUME DE LA VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($allChecksPassed) {
    Write-Host "✅ TOUTES LES VERIFICATIONS SONT PASSÉES" -ForegroundColor Green
    Write-Host "   Le backend devrait être accessible via les liens externes" -ForegroundColor Green
} else {
    Write-Host "❌ CERTAINES VERIFICATIONS ONT ÉCHOUÉ" -ForegroundColor Red
    Write-Host "   Veuillez corriger les problèmes ci-dessus" -ForegroundColor Red
    Write-Host "`n   Actions recommandées:" -ForegroundColor Yellow
    Write-Host "   1. Vérifier que le service ECS est ACTIVE avec Running count > 0" -ForegroundColor Cyan
    Write-Host "   2. Désactiver le proxy Cloudflare (nuage orange → gris) pour $DomainName" -ForegroundColor Cyan
    Write-Host "   3. Vérifier les logs CloudWatch pour les erreurs récentes" -ForegroundColor Cyan
}

Write-Host "`n========================================`n" -ForegroundColor Cyan

exit $(if ($allChecksPassed) { 0 } else { 1 })



