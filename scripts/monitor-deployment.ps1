# Script de monitoring du déploiement AWS
# Affiche l'état de l'infrastructure en temps réel

param(
    [int]$Interval = 10,  # Intervalle en secondes
    [switch]$Continuous = $false
)

$ErrorActionPreference = "Continue"

function Write-Header {
    param([string]$Text)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Get-RDSStatus {
    Write-Host "📊 RDS Database:" -ForegroundColor Yellow
    try {
        $rds = aws rds describe-db-instances --db-instance-identifier yukpomnang-db --region eu-west-1 --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Engine:Engine,Version:EngineVersion}' --output json 2>&1 | ConvertFrom-Json
        Write-Host "   Status: $($rds.Status)" -ForegroundColor $(if($rds.Status -eq "available"){"Green"}else{"Yellow"})
        Write-Host "   Endpoint: $($rds.Endpoint)" -ForegroundColor White
        Write-Host "   Engine: $($rds.Engine) $($rds.Version)" -ForegroundColor White
        return $rds
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
        return $null
    }
}

function Get-ECSStatus {
    Write-Host "`n🚀 ECS Service:" -ForegroundColor Yellow
    try {
        $service = aws ecs describe-services --cluster yukpomnang-cluster --services yukpomnang-backend-service --region eu-west-1 --query 'services[0]' --output json 2>&1 | ConvertFrom-Json
        
        Write-Host "   Status: $($service.status)" -ForegroundColor $(if($service.status -eq "ACTIVE"){"Green"}else{"Yellow"})
        Write-Host "   Running: $($service.runningCount) / Desired: $($service.desiredCount)" -ForegroundColor White
        Write-Host "   Pending: $($service.pendingCount)" -ForegroundColor White
        
        # Derniers événements
        if ($service.events.Count -gt 0) {
            Write-Host "`n   Derniers événements:" -ForegroundColor Cyan
            $service.events | Select-Object -First 3 | ForEach-Object {
                $time = [DateTime]::Parse($_.createdAt).ToString("HH:mm:ss")
                Write-Host "   [$time] $($_.message)" -ForegroundColor Gray
            }
        }
        
        # État des tâches
        $tasks = aws ecs list-tasks --cluster yukpomnang-cluster --service-name yukpomnang-backend-service --region eu-west-1 --query 'taskArns' --output json 2>&1 | ConvertFrom-Json
        
        if ($tasks.Count -gt 0) {
            Write-Host "`n   Tâches ECS:" -ForegroundColor Cyan
            foreach ($taskArn in $tasks) {
                $taskId = $taskArn.Split('/')[-1]
                $task = aws ecs describe-tasks --cluster yukpomnang-cluster --tasks $taskArn --region eu-west-1 --query 'tasks[0]' --output json 2>&1 | ConvertFrom-Json
                
                $statusColor = switch ($task.lastStatus) {
                    "RUNNING" { "Green" }
                    "PENDING" { "Yellow" }
                    "STOPPED" { "Red" }
                    default { "White" }
                }
                
                Write-Host "   - Task $taskId : $($task.lastStatus) -> $($task.desiredStatus)" -ForegroundColor $statusColor
                
                if ($task.stoppedReason) {
                    Write-Host "     Reason: $($task.stoppedReason)" -ForegroundColor Red
                }
            }
        }
        
        return $service
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
        return $null
    }
}

function Get-ECRStatus {
    Write-Host "`n🐳 ECR Repository:" -ForegroundColor Yellow
    try {
        $images = aws ecr describe-images --repository-name yukpomnang-backend --region eu-west-1 --query 'imageDetails[0]' --output json 2>&1 | ConvertFrom-Json
        if ($images) {
            $pushedAt = [DateTime]::Parse($images.imagePushedAt).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "   Dernière image: $pushedAt" -ForegroundColor White
            Write-Host "   Digest: $($images.imageDigest.Substring(0,20))..." -ForegroundColor Gray
        } else {
            Write-Host "   Aucune image trouvée" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    }
}

function Get-ALBStatus {
    Write-Host "`n⚖️  Load Balancer:" -ForegroundColor Yellow
    try {
        $alb = aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[?contains(LoadBalancerName, `yukpomnang`)][0]' --output json 2>&1 | ConvertFrom-Json
        if ($alb) {
            Write-Host "   DNS: $($alb.DNSName)" -ForegroundColor White
            Write-Host "   State: $($alb.State.Code)" -ForegroundColor $(if($alb.State.Code -eq "active"){"Green"}else{"Yellow"})
        }
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    }
}

function Get-TerraformStatus {
    Write-Host "`n🔧 Terraform:" -ForegroundColor Yellow
    $tfPath = "infra/aws/terraform.tfstate.lock.info"
    if (Test-Path $tfPath) {
        Write-Host "   ⏳ En cours d'exécution..." -ForegroundColor Yellow
        $lockInfo = Get-Content $tfPath -ErrorAction SilentlyContinue
        if ($lockInfo) {
            Write-Host "   $lockInfo" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✅ Aucune exécution en cours" -ForegroundColor Green
    }
}

# Boucle principale
do {
    Clear-Host
    Write-Header "MONITORING DU DÉPLOIEMENT AWS - $(Get-Date -Format 'HH:mm:ss')"
    
    Get-TerraformStatus
    Get-RDSStatus | Out-Null
    Get-ECSStatus | Out-Null
    Get-ECRStatus
    Get-ALBStatus
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
    
    if ($Continuous) {
        Start-Sleep -Seconds $Interval
    } else {
        break
    }
} while ($Continuous)




