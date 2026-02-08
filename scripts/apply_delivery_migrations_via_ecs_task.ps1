# Script pour appliquer les migrations de configuration de livraison via ECS Task
# Cette méthode fonctionne même si la base est dans un VPC privé

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend",
    [string]$Region = "us-east-1",
    [string]$SubnetId = "",
    [string]$SecurityGroupId = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Application des migrations via ECS Task" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# SQL de migration
$migrationSQL = @"
-- Migration 1: Ajouter preparation_time_minutes et colonnes associées
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- Migration 2: Ajouter storage_location_id
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location 
ON product_delivery_config(storage_location_id) 
WHERE storage_location_id IS NOT NULL;

-- Vérification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN ('preparation_time_minutes', 'storage_location_id', 'max_preparation_time_minutes', 'availability_days', 'is_immediately_available')
ORDER BY column_name;
"@

# Encoder le SQL en base64 pour le passer en variable d'environnement
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($migrationSQL))
Write-Host "✅ SQL de migration préparé (${sqlBase64.Length} caractères encodés)" -ForegroundColor Green
Write-Host ""

# Récupérer les informations du réseau depuis le service existant
Write-Host "📋 Récupération de la configuration réseau..." -ForegroundColor Yellow
try {
    $service = aws ecs describe-services `
        --cluster $ClusterName `
        --services yukpomnang-backend-service `
        --region $Region `
        --query 'services[0].networkConfiguration.awsvpcConfiguration' `
        --output json | ConvertFrom-Json
    
    if (-not $SubnetId) {
        $SubnetId = $service.subnets[0]
    }
    if (-not $SecurityGroupId) {
        $SecurityGroupId = $service.securityGroups[0]
    }
    
    Write-Host "   Subnet: $SubnetId" -ForegroundColor Gray
    Write-Host "   Security Group: $SecurityGroupId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "⚠️ Impossible de récupérer la config réseau, utilisation des valeurs par défaut" -ForegroundColor Yellow
    Write-Host "   Assurez-vous que -SubnetId et -SecurityGroupId sont fournis" -ForegroundColor Yellow
    Write-Host ""
}

# Créer la commande pour exécuter le SQL
$command = @(
    "sh",
    "-c",
    "echo `$MIGRATION_SQL | base64 -d | psql `$DATABASE_URL"
)

Write-Host "🚀 Création de la tâche ECS..." -ForegroundColor Yellow

# Préparer les overrides
$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = $command
            environment = @(
                @{
                    name = "MIGRATION_SQL"
                    value = $sqlBase64
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

# Préparer la configuration réseau
$networkConfig = @{
    awsvpcConfiguration = @{
        subnets = @($SubnetId)
        securityGroups = @($SecurityGroupId)
        assignPublicIp = "DISABLED"
    }
} | ConvertTo-Json -Compress

try {
    Write-Host "   Exécution de la tâche..." -ForegroundColor Gray
    
    $task = aws ecs run-task `
        --cluster $ClusterName `
        --task-definition $TaskDefinition `
        --launch-type FARGATE `
        --network-configuration $networkConfig `
        --overrides $overrides `
        --region $Region `
        --query 'tasks[0]' `
        --output json | ConvertFrom-Json
    
    $taskArn = $task.taskArn
    $taskId = $taskArn -replace '.*/', ''
    
    Write-Host "✅ Tâche créée: $taskId" -ForegroundColor Green
    Write-Host ""
    
    # Attendre la fin de la tâche
    Write-Host "⏳ Attente de la fin de l'exécution..." -ForegroundColor Yellow
    Write-Host "   (Cela peut prendre 1-2 minutes)" -ForegroundColor Gray
    
    $maxWait = 180 # 3 minutes
    $elapsed = 0
    $completed = $false
    
    while ($elapsed -lt $maxWait -and -not $completed) {
        Start-Sleep -Seconds 10
        $elapsed += 10
        
        $taskStatus = aws ecs describe-tasks `
            --cluster $ClusterName `
            --tasks $taskArn `
            --region $Region `
            --query 'tasks[0].lastStatus' `
            --output text
        
        if ($taskStatus -eq "STOPPED") {
            $completed = $true
        } else {
            Write-Host "   Statut: $taskStatus ($elapsed s)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    
    # Récupérer les logs
    Write-Host "📋 Récupération des logs..." -ForegroundColor Yellow
    
    $logGroup = "/ecs/yukpomnang-backend"
    $logStream = "backend/backend/$taskId"
    
    Start-Sleep -Seconds 5 # Attendre que les logs soient disponibles
    
    $logs = aws logs get-log-events `
        --log-group-name $logGroup `
        --log-stream-name $logStream `
        --region $Region `
        --query 'events[*].message' `
        --output text 2>&1
    
    if ($logs -and $logs -notmatch "ResourceNotFoundException") {
        Write-Host ""
        Write-Host "📊 Résultat de l'exécution:" -ForegroundColor Cyan
        Write-Host $logs
        Write-Host ""
        
        # Vérifier le code de sortie
        $exitCode = aws ecs describe-tasks `
            --cluster $ClusterName `
            --tasks $taskArn `
            --region $Region `
            --query 'tasks[0].containers[0].exitCode' `
            --output text
        
        if ($exitCode -eq "0") {
            Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Code de sortie: $exitCode" -ForegroundColor Yellow
            Write-Host "   Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️ Logs non disponibles ou en cours de traitement" -ForegroundColor Yellow
        Write-Host "   Vérifiez manuellement: aws logs tail $logGroup --follow --region $Region" -ForegroundColor Gray
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



