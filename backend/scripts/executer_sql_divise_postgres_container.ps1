# Script pour executer le script SQL divise en commandes courtes via conteneur PostgreSQL
# Cette approche evite les problemes avec les secrets SSM et la limite de 8192 caracteres

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$Region = "us-east-1",
    [string]$DatabaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
)

Write-Host "Execution du script SQL divise via conteneur PostgreSQL" -ForegroundColor Cyan
Write-Host ""

# Extraire les informations de connexion
if ($DatabaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)') {
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

if ($LASTEXITCODE -ne 0 -or -not $executionRoleArn -or $executionRoleArn -match "error") {
    Write-Host "ERREUR: Impossible de recuperer le role d'execution" -ForegroundColor Red
    exit 1
}

# Creer le groupe de logs
$logGroupName = "/ecs/yukpomnang-sql-execution"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Fonction pour executer une commande SQL via conteneur PostgreSQL
function Execute-SQLCommand {
    param([string]$sqlCommand, [string]$description)
    
    Write-Host "$description..." -ForegroundColor Yellow
    
    # Encoder la commande SQL en base64
    $sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlCommand))
    
    # Creer la commande bash
    $bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName"
    
    # Creer la definition de tache
    $taskDefJson = @{
        family = "yukpomnang-sql-execution-temp"
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
                        "awslogs-stream-prefix" = "ecs"
                    }
                }
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    $taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
    [System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))
    
    try {
        # Enregistrer et lancer la tache
        $taskDefArn = aws ecs register-task-definition `
            --cli-input-json "file://$taskDefFile" `
            --region $Region `
            --query 'taskDefinition.taskDefinitionArn' `
            --output text `
            2>&1
        
        if ($LASTEXITCODE -ne 0 -or $taskDefArn -match "error") {
            Write-Host "  Erreur: $taskDefArn" -ForegroundColor Red
            return $null
        }
        
        $taskArn = aws ecs run-task `
            --cluster $ClusterName `
            --task-definition $taskDefArn `
            --launch-type FARGATE `
            --network-configuration $networkConfig `
            --region $Region `
            --query 'tasks[0].taskArn' `
            --output text `
            2>&1
        
        if ($LASTEXITCODE -eq 0 -and $taskArn -notmatch "error" -and $taskArn.Length -gt 0) {
            # Attendre la fin
            $maxWait = 120
            $elapsed = 0
            while ($elapsed -lt $maxWait) {
                Start-Sleep -Seconds 5
                $elapsed += 5
                $status = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0].lastStatus' --output text 2>&1
                if ($status -eq "STOPPED") {
                    $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0]' | ConvertFrom-Json
                    $exitCode = $taskDetails.containers[0].exitCode
                    if ($exitCode -eq 0) {
                        Write-Host "  ✅ Succes" -ForegroundColor Green
                        return $true
                    } else {
                        Write-Host "  ❌ Erreur (code: $exitCode)" -ForegroundColor Red
                        return $false
                    }
                }
            }
            Write-Host "  ⏰ Timeout" -ForegroundColor Yellow
            return $false
        } else {
            Write-Host "  Erreur: $taskArn" -ForegroundColor Red
            return $false
        }
    } finally {
        Remove-Item $taskDefFile -ErrorAction SilentlyContinue
    }
}

# 1. Creer la table user_saved_addresses
$sql1 = "CREATE TABLE IF NOT EXISTS user_saved_addresses (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label VARCHAR(100) NOT NULL, address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')), address TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, location_data JSONB DEFAULT '{}'::jsonb, contact_name VARCHAR(255), contact_phone VARCHAR(50), instructions TEXT, building_number VARCHAR(50), floor VARCHAR(50), apartment VARCHAR(50), is_default_pickup BOOLEAN DEFAULT FALSE, is_default_dropoff BOOLEAN DEFAULT FALSE, usage_count INTEGER DEFAULT 0, last_used_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, label))"
Execute-SQLCommand -sqlCommand $sql1 -description "1. Creation de la table user_saved_addresses" | Out-Null

# 2. Creer les index
$indexes = @(
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id ON user_saved_addresses(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_type ON user_saved_addresses(user_id, address_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_default ON user_saved_addresses(user_id, is_default_pickup, is_default_dropoff)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_active ON user_saved_addresses(user_id, is_active)"
)

foreach ($idx in $indexes) {
    Execute-SQLCommand -sqlCommand $idx -description "  Creation index" | Out-Null
}

# 3. Creer les fonctions (simplifiees pour tenir dans la limite)
$func1 = "CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(vector_normalized TEXT[], search_keywords_normalized TEXT[]) RETURNS REAL AS `$`$ DECLARE match_count INTEGER; total_elements INTEGER; score REAL; BEGIN SELECT COUNT(*) INTO match_count FROM unnest(vector_normalized) AS elem WHERE elem = ANY(search_keywords_normalized); total_elements := array_length(vector_normalized, 1); IF total_elements IS NULL OR total_elements = 0 THEN RETURN 0.0; END IF; score := (match_count::REAL / total_elements::REAL) * 100.0; RETURN score; END; `$`$ LANGUAGE plpgsql IMMUTABLE"
Execute-SQLCommand -sqlCommand $func1 -description "2. Creation fonction calculate_vector_match_score_optimized" | Out-Null

$func2 = "CREATE OR REPLACE FUNCTION calculate_best_vector_match_score(characteristic_vector_normalized TEXT[], full_vector_normalized TEXT[], search_keywords_normalized TEXT[]) RETURNS REAL AS `$`$ SELECT GREATEST(COALESCE(calculate_vector_match_score_optimized(characteristic_vector_normalized, search_keywords_normalized), 0.0), COALESCE(calculate_vector_match_score_optimized(full_vector_normalized, search_keywords_normalized), 0.0)) `$`$ LANGUAGE sql IMMUTABLE"
Execute-SQLCommand -sqlCommand $func2 -description "3. Creation fonction calculate_best_vector_match_score" | Out-Null

$func3 = "CREATE OR REPLACE FUNCTION product_combination_exists(p_product_vector TEXT[]) RETURNS BOOLEAN AS `$`$ DECLARE v_exists BOOLEAN; BEGIN SELECT EXISTS(SELECT 1 FROM autocomplete_combinations WHERE product_vector = p_product_vector) INTO v_exists; RETURN v_exists; END; `$`$ LANGUAGE plpgsql STABLE"
Execute-SQLCommand -sqlCommand $func3 -description "4. Creation fonction product_combination_exists" | Out-Null

# 4. Corriger l'index pour la vue materialisee
$sql4 = "DO `$`$ BEGIN IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique; CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique ON services_search_optimized_v2 (service_id); END IF; END `$`$"
Execute-SQLCommand -sqlCommand $sql4 -description "5. Correction index vue materialisee" | Out-Null

Write-Host ""
Write-Host "✅ Corrections SQL appliquees!" -ForegroundColor Green



