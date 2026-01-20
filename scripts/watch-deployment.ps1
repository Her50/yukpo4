# Script de monitoring continu du déploiement AWS
param(
    [int]$IntervalSeconds = 10
)

$ErrorActionPreference = "Continue"

function Write-Status {
    param(
        [string]$Label,
        [string]$Value,
        [string]$Color = "White"
    )
    Write-Host ("{0,-20} : " -f $Label) -NoNewline -ForegroundColor Cyan
    Write-Host $Value -ForegroundColor $Color
}

function Get-RDSStatus {
    try {
        $rds = aws rds describe-db-instances --db-instance-identifier yukpomnang-db --region eu-west-1 --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address}' --output json 2>&1 | ConvertFrom-Json
        Write-Status "RDS Database" $rds.Status $(if($rds.Status -eq "available"){"Green"}else{"Yellow"})
        Write-Status "  Endpoint" $rds.Endpoint "Gray"
    } catch {
        Write-Status "RDS Database" "ERROR" "Red"
    }
}

function Get-ECSStatus {
    try {
        $service = aws ecs describe-services --cluster yukpomnang-cluster --services yukpomnang-backend-service --region eu-west-1 --query 'services[0]' --output json 2>&1 | ConvertFrom-Json
        
        $runningColor = if($service.runningCount -eq $service.desiredCount){"Green"}else{"Yellow"}
        Write-Status "ECS Service" "$($service.status)" $(if($service.status -eq "ACTIVE"){"Green"}else{"Yellow"})
        Write-Status "  Tasks" "$($service.runningCount)/$($service.desiredCount) running, $($service.pendingCount) pending" $runningColor
        
        # Dernier événement
        if ($service.events.Count -gt 0) {
            $lastEvent = $service.events[0]
            $time = [DateTime]::Parse($lastEvent.createdAt).ToString("HH:mm:ss")
            Write-Host ("{0,-20} : " -f "  Dernier evenement") -NoNewline -ForegroundColor Cyan
            Write-Host "[$time] $($lastEvent.message.Substring(0,[Math]::Min(60,$lastEvent.message.Length)))" -ForegroundColor Gray
        }
        
        # Détails des tâches
        $tasks = aws ecs list-tasks --cluster yukpomnang-cluster --service-name yukpomnang-backend-service --region eu-west-1 --query 'taskArns' --output json 2>&1 | ConvertFrom-Json
        
        if ($tasks.Count -gt 0) {
            Write-Host ""
            foreach ($taskArn in $tasks) {
                $taskId = $taskArn.Split('/')[-1]
                $task = aws ecs describe-tasks --cluster yukpomnang-cluster --tasks $taskArn --region eu-west-1 --query 'tasks[0].{LastStatus:lastStatus,DesiredStatus:desiredStatus,HealthStatus:healthStatus,StoppedReason:stoppedReason}' --output json 2>&1 | ConvertFrom-Json
                
                $statusColor = switch ($task.LastStatus) {
                    "RUNNING" { "Green" }
                    "PENDING" { "Yellow" }
                    "STOPPED" { "Red" }
                    default { "White" }
                }
                
                Write-Host ("  Task {0,-15} : " -f $taskId.Substring(0,[Math]::Min(15,$taskId.Length))) -NoNewline -ForegroundColor Cyan
                Write-Host "$($task.LastStatus) -> $($task.DesiredStatus)" -ForegroundColor $statusColor
                
                if ($task.HealthStatus -and $task.HealthStatus -ne "UNKNOWN") {
                    Write-Host ("  Health {0,-15} : " -f "") -NoNewline -ForegroundColor Cyan
                    Write-Host $task.HealthStatus -ForegroundColor $(if($task.HealthStatus -eq "HEALTHY"){"Green"}else{"Yellow"})
                }
                
                if ($task.StoppedReason) {
                    Write-Host ("  Reason {0,-15} : " -f "") -NoNewline -ForegroundColor Cyan
                    Write-Host $task.StoppedReason.Substring(0,[Math]::Min(50,$task.StoppedReason.Length)) -ForegroundColor Red
                }
            }
        }
    } catch {
        Write-Status "ECS Service" "ERROR" "Red"
    }
}

function Get-ALBStatus {
    try {
        $alb = aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[?contains(LoadBalancerName, `yukpomnang`)][0].{DNS:DNSName,State:State.Code}' --output json 2>&1 | ConvertFrom-Json
        if ($alb) {
            Write-Status "Load Balancer" $alb.State $(if($alb.State -eq "active"){"Green"}else{"Yellow"})
            Write-Status "  DNS" $alb.DNS "Gray"
        }
    } catch {
        Write-Status "Load Balancer" "ERROR" "Red"
    }
}

function Get-ECRStatus {
    try {
        $images = aws ecr describe-images --repository-name yukpomnang-backend --region eu-west-1 --query 'imageDetails[0].{PushedAt:imagePushedAt}' --output json 2>&1 | ConvertFrom-Json
        if ($images -and $images.PushedAt) {
            $pushedAt = [DateTime]::Parse($images.PushedAt).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Status "ECR Image" "Pushed: $pushedAt" "Green"
        }
    } catch {
        Write-Status "ECR Image" "Not found" "Yellow"
    }
}

# Boucle principale
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONITORING DU DEPLOIEMENT AWS" -ForegroundColor Cyan
Write-Host "  Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$iteration = 0
try {
    while ($true) {
        $iteration++
        Clear-Host
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  Update #$iteration - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        Get-RDSStatus
        Write-Host ""
        Get-ECSStatus
        Write-Host ""
        Get-ALBStatus
        Write-Host ""
        Get-ECRStatus
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  Prochain update dans $IntervalSeconds secondes..." -ForegroundColor Gray
        Write-Host "========================================" -ForegroundColor Cyan
        
        Start-Sleep -Seconds $IntervalSeconds
    }
} catch {
    Write-Host ""
    Write-Host "Monitoring arrete." -ForegroundColor Yellow
}




