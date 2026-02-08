# Script pour redémarrer le service ECS et appliquer les migrations automatiquement
# Les migrations seront appliquées via auto_migrate.rs au démarrage

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1",
    [switch]$WaitForStable = $true,
    [int]$MaxWaitMinutes = 10
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Redémarrage du service ECS pour appliquer les migrations" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Étape 1: Vérifier que le service existe
Write-Host "📋 Étape 1: Vérification du service ECS..." -ForegroundColor Yellow
try {
    $service = aws ecs describe-services `
        --cluster $ClusterName `
        --services $ServiceName `
        --region $Region `
        --query 'services[0]' `
        --output json | ConvertFrom-Json
    
    if (-not $service -or $service.status -ne "ACTIVE") {
        Write-Host "❌ Service $ServiceName non trouvé ou inactif" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Service trouvé: $ServiceName" -ForegroundColor Green
    Write-Host "   Statut actuel: $($service.status)" -ForegroundColor Gray
    Write-Host "   Tâches en cours: $($service.runningCount)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors de la vérification du service: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Forcer un nouveau déploiement
Write-Host "📋 Étape 2: Forcer un nouveau déploiement..." -ForegroundColor Yellow
try {
    Write-Host "   Déclenchement du redéploiement..." -ForegroundColor Gray
    
    $deployment = aws ecs update-service `
        --cluster $ClusterName `
        --service $ServiceName `
        --region $Region `
        --force-new-deployment `
        --query 'service.deployments[0]' `
        --output json | ConvertFrom-Json
    
    $deploymentId = $deployment.id
    Write-Host "✅ Nouveau déploiement déclenché" -ForegroundColor Green
    Write-Host "   ID du déploiement: $deploymentId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors du redéploiement: $_" -ForegroundColor Red
    exit 1
}

# Étape 3: Attendre que le service soit stable (optionnel)
if ($WaitForStable) {
    Write-Host "📋 Étape 3: Attente de la stabilisation du service..." -ForegroundColor Yellow
    Write-Host "   (Cela peut prendre quelques minutes)" -ForegroundColor Gray
    Write-Host ""
    
    $startTime = Get-Date
    $timeout = $startTime.AddMinutes($MaxWaitMinutes)
    $stable = $false
    
    while ((Get-Date) -lt $timeout -and -not $stable) {
        Start-Sleep -Seconds 15
        
        try {
            $service = aws ecs describe-services `
                --cluster $ClusterName `
                --services $ServiceName `
                --region $Region `
                --query 'services[0]' `
                --output json | ConvertFrom-Json
            
            $deployments = $service.deployments | Where-Object { $_.status -eq "PRIMARY" }
            $primaryDeployment = $deployments | Where-Object { $_.id -eq $deploymentId }
            
            if ($primaryDeployment -and $primaryDeployment.desiredCount -eq $primaryDeployment.runningCount) {
                $stable = $true
                Write-Host "✅ Service stabilisé!" -ForegroundColor Green
                Write-Host "   Tâches en cours: $($primaryDeployment.runningCount)/$($primaryDeployment.desiredCount)" -ForegroundColor Gray
            } else {
                $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds)
                Write-Host "   ⏳ En attente... ($elapsed s)" -ForegroundColor Gray
            }
        } catch {
            Write-Host "   ⚠️ Erreur lors de la vérification: $_" -ForegroundColor Yellow
        }
    }
    
    if (-not $stable) {
        Write-Host ""
        Write-Host "⚠️ Timeout atteint ($MaxWaitMinutes minutes)" -ForegroundColor Yellow
        Write-Host "   Le service est peut-être encore en cours de déploiement" -ForegroundColor Gray
        Write-Host "   Vérifiez manuellement: aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $Region" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Étape 4: Vérifier les logs de migration (optionnel)
Write-Host "📋 Étape 4: Vérification des migrations..." -ForegroundColor Yellow
Write-Host ""

try {
    # Récupérer les dernières tâches
    $tasks = aws ecs list-tasks `
        --cluster $ClusterName `
        --service-name $ServiceName `
        --region $Region `
        --desired-status RUNNING `
        --query 'taskArns[]' `
        --output text
    
    if ($tasks) {
        $taskArn = ($tasks -split "`t")[0]
        Write-Host "   Tâche trouvée: $taskArn" -ForegroundColor Gray
        
        # Extraire le task ID
        if ($taskArn -match "task/([^/]+)$") {
            $taskId = $matches[1]
            $logGroup = "/ecs/yukpomnang-backend"
            $logStream = "backend/backend/$taskId"
            
            Write-Host "   Recherche des logs de migration..." -ForegroundColor Gray
            
            # Attendre quelques secondes pour que les logs soient disponibles
            Start-Sleep -Seconds 10
            
            $migrationLogs = aws logs filter-log-events `
                --log-group-name $logGroup `
                --log-stream-names $logStream `
                --filter-pattern "preparation_time_minutes OR storage_location_id OR migration" `
                --region $Region `
                --start-time $([DateTimeOffset]::Now.AddMinutes(-5).ToUnixTimeMilliseconds()) `
                --max-items 20 `
                --query 'events[*].message' `
                --output text 2>&1
            
            if ($migrationLogs -and $migrationLogs -notmatch "ResourceNotFoundException") {
                Write-Host "   📋 Logs de migration trouvés:" -ForegroundColor Cyan
                $migrationLogs -split "`t" | Where-Object { $_ -match "preparation_time|storage_location|migration|Migration" } | Select-Object -First 5 | ForEach-Object {
                    Write-Host "      $_" -ForegroundColor Gray
                }
            } else {
                Write-Host "   ⚠️ Aucun log de migration trouvé dans les dernières minutes" -ForegroundColor Yellow
                Write-Host "      Les migrations peuvent avoir été appliquées plus tôt ou sont en cours" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "   ⚠️ Aucune tâche en cours d'exécution" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Impossible de vérifier les logs: $_" -ForegroundColor Yellow
}

Write-Host ""

# Étape 5: Vérifier les colonnes dans la base (via script Python si disponible)
Write-Host "📋 Étape 5: Vérification finale..." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Pour vérifier que les migrations ont été appliquées, exécutez:" -ForegroundColor Cyan
Write-Host "   python scripts/run_migrations_aws.py --check-only" -ForegroundColor White
Write-Host ""
Write-Host "   Ou vérifiez directement dans la base de données:" -ForegroundColor Gray
Write-Host "   SELECT column_name FROM information_schema.columns" -ForegroundColor White
Write-Host "   WHERE table_name = 'product_delivery_config'" -ForegroundColor White
Write-Host "   AND column_name IN ('preparation_time_minutes', 'storage_location_id');" -ForegroundColor White
Write-Host ""

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Redéploiement terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""
Write-Host "📝 Résumé:" -ForegroundColor Cyan
Write-Host "   ✅ Service redéployé: $ServiceName" -ForegroundColor Green
Write-Host "   ✅ Les migrations seront appliquées automatiquement au démarrage" -ForegroundColor Green
Write-Host "   ✅ Colonnes à vérifier: preparation_time_minutes, storage_location_id" -ForegroundColor Green
Write-Host ""



