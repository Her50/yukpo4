# Script de Diagnostic des Coûts AWS
# Vérifie toutes les ressources coûteuses et identifie les optimisations possibles

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpomnang"
)

Write-Host "🔍 Diagnostic des Coûts AWS - Yukpomnang" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Fonction pour formater les montants
function Format-Cost {
    param([decimal]$Amount)
    return "$($Amount.ToString('F2')) USD"
}

# 1. Vérifier RDS
Write-Host "📊 1. RDS PostgreSQL" -ForegroundColor Yellow
try {
    $rds = aws rds describe-db-instances `
        --db-instance-identifier "$ProjectName-db" `
        --region $Region `
        --output json | ConvertFrom-Json
    
    if ($rds.DBInstances) {
        $instance = $rds.DBInstances[0]
        Write-Host "   Instance Class: $($instance.DBInstanceClass)" -ForegroundColor White
        Write-Host "   Storage: $($instance.AllocatedStorage) GB" -ForegroundColor White
        Write-Host "   Backup Retention: $($instance.BackupRetentionPeriod) jours" -ForegroundColor White
        Write-Host "   Performance Insights: $($instance.PerformanceInsightsEnabled)" -ForegroundColor $(if ($instance.PerformanceInsightsEnabled) { "Red" } else { "Green" })
        
        # Estimer coûts
        $rdsCost = 0
        if ($instance.DBInstanceClass -like "db.t3.medium*") {
            $rdsCost += 60
            Write-Host "   ⚠️  Coût estimé: ~$60-80/mois (db.t3.medium)" -ForegroundColor Red
            Write-Host "   💡 Optimisation: Passer à db.t3.micro (~$15-20/mois)" -ForegroundColor Green
        } elseif ($instance.DBInstanceClass -like "db.t3.micro*") {
            $rdsCost += 18
            Write-Host "   ✅ Coût estimé: ~$15-20/mois (db.t3.micro)" -ForegroundColor Green
        }
        
        if ($instance.PerformanceInsightsEnabled) {
            $rdsCost += 12
            Write-Host "   ⚠️  Performance Insights: ~$10-15/mois supplémentaire" -ForegroundColor Red
            Write-Host "   💡 Optimisation: Désactiver pour tests" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer les infos RDS" -ForegroundColor Yellow
}

Write-Host ""

# 2. Vérifier ECS
Write-Host "📊 2. ECS Fargate" -ForegroundColor Yellow
try {
    $ecsService = aws ecs describe-services `
        --cluster "$ProjectName-cluster" `
        --services "$ProjectName-backend-service" `
        --region $Region `
        --output json | ConvertFrom-Json
    
    if ($ecsService.services) {
        $service = $ecsService.services[0]
        Write-Host "   Desired Count: $($service.desiredCount)" -ForegroundColor White
        Write-Host "   Running Count: $($service.runningCount)" -ForegroundColor White
        
        # Récupérer task definition
        $taskDef = aws ecs describe-task-definition `
            --task-definition "$ProjectName-backend" `
            --region $Region `
            --output json | ConvertFrom-Json
        
        if ($taskDef.taskDefinition) {
            $cpu = $taskDef.taskDefinition.cpu
            $memory = $taskDef.taskDefinition.memory
            Write-Host "   CPU: $cpu (1024 = 1 vCPU)" -ForegroundColor White
            Write-Host "   Memory: $memory MB" -ForegroundColor White
            
            # Estimer coûts
            $tasks = $service.desiredCount
            $vCpu = $cpu / 1024
            $memoryGB = $memory / 1024
            
            $ecsCost = ($vCpu * 0.04 * 730 * $tasks) + ($memoryGB * 0.004 * 730 * $tasks)
            Write-Host "   💰 Coût estimé: ~$(Format-Cost $ecsCost)/mois" -ForegroundColor $(if ($ecsCost -gt 50) { "Red" } else { "Green" })
            
            if ($tasks -gt 1) {
                Write-Host "   ⚠️  $tasks tasks en cours (sur-dimensionné pour tests)" -ForegroundColor Red
                Write-Host "   💡 Optimisation: Réduire à 1 task (~$(Format-Cost ($ecsCost / $tasks))/mois)" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer les infos ECS" -ForegroundColor Yellow
}

Write-Host ""

# 3. Vérifier NAT Gateway
Write-Host "📊 3. NAT Gateway" -ForegroundColor Yellow
try {
    $natGateways = aws ec2 describe-nat-gateways `
        --region $Region `
        --filter "Name=tag:Name,Values=$ProjectName-nat-gateway" `
        --output json | ConvertFrom-Json
    
    if ($natGateways.NatGateways -and $natGateways.NatGateways.Count -gt 0) {
        $nat = $natGateways.NatGateways[0]
        Write-Host "   État: $($nat.State)" -ForegroundColor White
        Write-Host "   ⚠️  NAT Gateway actif: ~$35-45/mois" -ForegroundColor Red
        Write-Host "   💡 Optimisation: Désactiver pour tests (économise ~$35-45/mois)" -ForegroundColor Green
    } else {
        Write-Host "   ✅ NAT Gateway désactivé" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Impossible de vérifier NAT Gateway" -ForegroundColor Yellow
}

Write-Host ""

# 4. Vérifier ElastiCache
Write-Host "📊 4. ElastiCache Redis" -ForegroundColor Yellow
try {
    $redis = aws elasticache describe-replication-groups `
        --replication-group-id "$ProjectName-redis" `
        --region $Region `
        --output json | ConvertFrom-Json
    
    if ($redis.ReplicationGroups) {
        $rg = $redis.ReplicationGroups[0]
        Write-Host "   Node Type: $($rg.CacheNodeType)" -ForegroundColor White
        
        if ($rg.CacheNodeType -like "cache.t3.small*") {
            Write-Host "   ⚠️  Coût estimé: ~$15-20/mois (cache.t3.small)" -ForegroundColor Red
            Write-Host "   💡 Optimisation: Passer à cache.t3.micro (~$5-8/mois)" -ForegroundColor Green
        } elseif ($rg.CacheNodeType -like "cache.t3.micro*") {
            Write-Host "   ✅ Coût estimé: ~$5-8/mois (cache.t3.micro)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer les infos ElastiCache" -ForegroundColor Yellow
}

Write-Host ""

# 5. Vérifier Container Insights
Write-Host "📊 5. CloudWatch Container Insights" -ForegroundColor Yellow
try {
    $cluster = aws ecs describe-clusters `
        --clusters "$ProjectName-cluster" `
        --region $Region `
        --include SETTINGS `
        --output json | ConvertFrom-Json
    
    if ($cluster.clusters) {
        $containerInsights = $cluster.clusters[0].settings | Where-Object { $_.name -eq "containerInsights" }
        if ($containerInsights -and $containerInsights.value -eq "enabled") {
            Write-Host "   ⚠️  Container Insights activé: ~$5-10/mois" -ForegroundColor Red
            Write-Host "   💡 Optimisation: Désactiver pour tests" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Container Insights désactivé" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ⚠️  Impossible de vérifier Container Insights" -ForegroundColor Yellow
}

Write-Host ""

# 6. Vérifier ALB
Write-Host "📊 6. Application Load Balancer" -ForegroundColor Yellow
try {
    $alb = aws elbv2 describe-load-balancers `
        --region $Region `
        --query "LoadBalancers[?contains(LoadBalancerName, '$ProjectName')]" `
        --output json | ConvertFrom-Json
    
    if ($alb) {
        Write-Host "   ✅ ALB actif: ~$20-25/mois (nécessaire)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Impossible de vérifier ALB" -ForegroundColor Yellow
}

Write-Host ""

# 7. Vérifier les coûts réels (si possible)
Write-Host "📊 7. Coûts Réels (7 derniers jours)" -ForegroundColor Yellow
try {
    $startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    
    $costs = aws ce get-cost-and-usage `
        --time-period Start=$startDate,End=$endDate `
        --granularity DAILY `
        --metrics BlendedCost `
        --group-by Type=DIMENSION,Key=SERVICE `
        --region $Region `
        --output json | ConvertFrom-Json
    
    if ($costs.ResultsByTime) {
        $totalCost = 0
        Write-Host "   Coûts par service:" -ForegroundColor White
        foreach ($result in $costs.ResultsByTime) {
            foreach ($group in $result.Groups) {
                $service = $group.Keys[0]
                $amount = [decimal]$group.Metrics.BlendedCost.Amount
                $totalCost += $amount
                
                if ($amount -gt 0) {
                    Write-Host "      $service : $(Format-Cost $amount)" -ForegroundColor White
                }
            }
        }
        
        $monthlyEstimate = $totalCost * 30 / 7
        Write-Host "`n   💰 Total (7 jours): $(Format-Cost $totalCost)" -ForegroundColor Cyan
        Write-Host "   💰 Estimation mensuelle: $(Format-Cost $monthlyEstimate)" -ForegroundColor $(if ($monthlyEstimate -gt 200) { "Red" } else { "Green" })
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer les coûts. Vérifiez vos permissions AWS." -ForegroundColor Yellow
    Write-Host "      Erreur: $_" -ForegroundColor Gray
}

Write-Host ""

# 8. Résumé des optimisations
Write-Host "🎯 RÉSUMÉ DES OPTIMISATIONS POSSIBLES" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

Write-Host "Actions recommandées pour réduire les coûts:" -ForegroundColor Yellow
Write-Host "1. Désactiver NAT Gateway (si acceptable pour tests)" -ForegroundColor White
Write-Host "2. Réduire RDS à db.t3.micro" -ForegroundColor White
Write-Host "3. Réduire ECS à 1 task avec moins de ressources" -ForegroundColor White
Write-Host "4. Réduire ElastiCache à cache.t3.micro" -ForegroundColor White
Write-Host "5. Désactiver Performance Insights" -ForegroundColor White
Write-Host "6. Désactiver Container Insights" -ForegroundColor White
Write-Host "7. Réduire retention CloudWatch à 3 jours" -ForegroundColor White

Write-Host "`n💡 Économie estimée: ~$137-207/mois (60% de réduction)" -ForegroundColor Green
Write-Host "`n📄 Voir ANALYSE_COUTS_AWS_COMPLETE.md pour plus de détails" -ForegroundColor Cyan

