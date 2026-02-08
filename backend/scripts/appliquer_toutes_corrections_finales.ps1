# Script final pour appliquer toutes les corrections manquantes automatiquement

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application de Toutes les Corrections Finales" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Recuperer DATABASE_URL depuis SSM
$ssmPath = "/yukpomnang/production/DATABASE_URL"
$databaseUrl = aws ssm get-parameter --name $ssmPath --region $Region --with-decryption --query Parameter.Value --output text 2>&1

if ($LASTEXITCODE -ne 0 -or -not $databaseUrl -or $databaseUrl -match "error") {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL depuis SSM" -ForegroundColor Red
    exit 1
}

$databaseUrl = $databaseUrl.Trim()

# Extraire les informations de connexion
if ($databaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
} else {
    Write-Host "ERREUR: Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Recuperer le role d'execution
$executionRoleArn = aws ecs describe-task-definition `
    --task-definition yukpomnang-backend:3 `
    --region $Region `
    --query 'taskDefinition.executionRoleArn' `
    --output text `
    2>&1

# Creer le groupe de logs
$logGroupName = "/ecs/yukpomnang-sql-execution"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Fonction pour executer une commande SQL
function Execute-SQLCommand {
    param([string]$sqlCommand, [string]$description)
    
    Write-Host "$description..." -ForegroundColor Yellow
    
    $sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlCommand))
    $bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName"
    
    $taskDefJson = @{
        family = "yukpomnang-sql-exec"
        networkMode = "awsvpc"
        requiresCompatibilities = @("FARGATE")
        cpu = "256"
        memory = "512"
        executionRoleArn = $executionRoleArn
        containerDefinitions = @(
            @{
                name = "postgres-client"
                image = "postgres:15"
                essential = $true
                command = @("sh", "-c", $bashCommand)
                logConfiguration = @{
                    logDriver = "awslogs"
                    options = @{
                        "awslogs-group" = $logGroupName
                        "awslogs-region" = $Region
                        "awslogs-stream-prefix" = "final"
                    }
                }
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    $taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
    [System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))
    
    try {
        $taskDefArn = aws ecs register-task-definition `
            --cli-input-json "file://$taskDefFile" `
            --region $Region `
            --query 'taskDefinition.taskDefinitionArn' `
            --output text `
            2>&1
        
        if ($LASTEXITCODE -ne 0 -or $taskDefArn -match "error") {
            Write-Host "  ❌ Erreur" -ForegroundColor Red
            return $false
        }
        
        $taskArn = aws ecs run-task `
            --cluster yukpomnang-cluster `
            --task-definition $taskDefArn `
            --launch-type FARGATE `
            --network-configuration $networkConfig `
            --region $Region `
            --query 'tasks[0].taskArn' `
            --output text `
            2>&1
        
        if ($LASTEXITCODE -eq 0 -and $taskArn -notmatch "error" -and $taskArn.Length -gt 0) {
            Start-Sleep -Seconds 20
            $taskDetails = aws ecs describe-tasks --cluster yukpomnang-cluster --tasks $taskArn --region $Region --query 'tasks[0]' | ConvertFrom-Json
            $exitCode = $taskDetails.containers[0].exitCode
            
            if ($exitCode -eq 0) {
                Write-Host "  ✅ Succes" -ForegroundColor Green
                return $true
            } else {
                Write-Host "  ❌ Erreur (code: $exitCode)" -ForegroundColor Red
                return $false
            }
        }
    } finally {
        Remove-Item $taskDefFile -ErrorAction SilentlyContinue
    }
    
    return $false
}

# 1. Creer la vue delivery_requests
Write-Host "1. Creation de la vue delivery_requests..." -ForegroundColor Cyan
$sql1 = "DROP VIEW IF EXISTS delivery_requests; CREATE VIEW delivery_requests AS SELECT d.id, d.creator_id as client_id, d.courier_id, NULL::INTEGER as service_id, d.metadata, d.status, d.requested_at, d.pickup_location, d.dropoff_location, d.pickup_address, d.dropoff_address, d.recipient_user_id, d.recipient_contact_name, d.recipient_contact_phone, d.created_at, d.updated_at FROM deliveries d;"
Execute-SQLCommand -sqlCommand $sql1 -description "  Creation vue delivery_requests" | Out-Null

# 2. Creer la table courier_profiles
Write-Host "2. Creation de la table courier_profiles..." -ForegroundColor Cyan
$sql2 = "CREATE TABLE IF NOT EXISTS courier_profiles (id UUID PRIMARY KEY REFERENCES couriers(id) ON DELETE CASCADE, current_latitude DOUBLE PRECISION, current_longitude DOUBLE PRECISION, last_location_update TIMESTAMPTZ DEFAULT now(), is_online BOOLEAN DEFAULT FALSE, current_status TEXT, current_delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());"
Execute-SQLCommand -sqlCommand $sql2 -description "  Creation table courier_profiles" | Out-Null

# 3. Creer les index pour courier_profiles
Write-Host "3. Creation des index pour courier_profiles..." -ForegroundColor Cyan
$indexes = @(
    "CREATE INDEX IF NOT EXISTS idx_courier_profiles_location ON courier_profiles(current_latitude, current_longitude) WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_courier_profiles_online ON courier_profiles(is_online) WHERE is_online = TRUE",
    "CREATE INDEX IF NOT EXISTS idx_courier_profiles_status ON courier_profiles(current_status)",
    "CREATE INDEX IF NOT EXISTS idx_courier_profiles_delivery ON courier_profiles(current_delivery_id) WHERE current_delivery_id IS NOT NULL"
)

foreach ($idx in $indexes) {
    Execute-SQLCommand -sqlCommand $idx -description "  Creation index" | Out-Null
}

# 4. Creer le trigger pour updated_at
Write-Host "4. Creation du trigger pour courier_profiles..." -ForegroundColor Cyan
$sql3 = "CREATE OR REPLACE FUNCTION update_courier_profiles_updated_at() RETURNS TRIGGER AS `$`$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; `$`$ LANGUAGE plpgsql; DROP TRIGGER IF EXISTS trigger_update_courier_profiles_updated_at ON courier_profiles; CREATE TRIGGER trigger_update_courier_profiles_updated_at BEFORE UPDATE ON courier_profiles FOR EACH ROW EXECUTE FUNCTION update_courier_profiles_updated_at();"
Execute-SQLCommand -sqlCommand $sql3 -description "  Creation trigger" | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Toutes les corrections appliquees!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""



