# Script pour vérifier si les migrations de livraison/coursier sont appliquées dans AWS
# Usage: .\scripts\verify_delivery_migrations_aws.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:4"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

Write-Host "🔍 Vérification des migrations de livraison/coursier dans AWS" -ForegroundColor Cyan
Write-Host ""

# SQL pour vérifier les migrations
$sqlCheck = @'
-- Verification 1: Colonne storage_location_id dans product_delivery_config
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'product_delivery_config' 
            AND column_name = 'storage_location_id'
        )         THEN 'OK: storage_location_id existe dans product_delivery_config'
        ELSE 'ERREUR: storage_location_id MANQUANT dans product_delivery_config'
    END AS check_storage_location_id;

-- Vérification 2: Colonne specializations dans courier_assets
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'courier_assets' 
            AND column_name = 'specializations'
        )         THEN 'OK: specializations existe dans courier_assets'
        ELSE 'ERREUR: specializations MANQUANT dans courier_assets'
    END AS check_specializations;

-- Vérification 3: Table product_delivery_config existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'product_delivery_config'
        ) THEN '✅ Table product_delivery_config existe'
        ELSE 'ERREUR: Table product_delivery_config MANQUANTE'
    END AS check_product_delivery_config_table;

-- Vérification 4: Table client_delivery_preferences existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'client_delivery_preferences'
        ) THEN '✅ Table client_delivery_preferences existe'
        ELSE 'ERREUR: Table client_delivery_preferences MANQUANTE'
    END AS check_client_delivery_preferences_table;

-- Vérification 5: Table external_delivery_providers existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'external_delivery_providers'
        ) THEN '✅ Table external_delivery_providers existe'
        ELSE 'ERREUR: Table external_delivery_providers MANQUANTE'
    END AS check_external_delivery_providers_table;

-- Vérification 6: Table delivery_payment_reservations existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'delivery_payment_reservations'
        ) THEN '✅ Table delivery_payment_reservations existe'
        ELSE 'ERREUR: Table delivery_payment_reservations MANQUANTE'
    END AS check_delivery_payment_reservations_table;

-- Vérification 7: Index sur storage_location_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'product_delivery_config' 
            AND indexname = 'idx_product_delivery_config_storage_location'
        ) THEN '✅ Index idx_product_delivery_config_storage_location existe'
        ELSE 'ERREUR: Index idx_product_delivery_config_storage_location MANQUANT'
    END AS check_storage_location_index;

-- Vérification 8: Index sur specializations
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'courier_assets' 
            AND indexname = 'idx_courier_assets_specializations'
        ) THEN '✅ Index idx_courier_assets_specializations existe'
        ELSE 'ERREUR: Index idx_courier_assets_specializations MANQUANT'
    END AS check_specializations_index;

-- Vérification 9: Colonnes dans delivery_payment_reservations
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'delivery_payment_reservations' 
            AND column_name = 'client_payment_method'
        )         THEN 'OK: client_payment_method existe dans delivery_payment_reservations'
        ELSE 'ERREUR: client_payment_method MANQUANT dans delivery_payment_reservations'
    END AS check_client_payment_method;

-- Vérification 10: Colonne payment_methods dans users
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'payment_methods'
        )         THEN 'OK: payment_methods existe dans users'
        ELSE 'ERREUR: payment_methods MANQUANT dans users'
    END AS check_users_payment_methods;
'@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlCheck))

# Commande qui décode et exécute le SQL
$command = "echo '$sqlBase64' | base64 -d | psql `$DATABASE_URL -t -A"

# Créer les overrides
$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @("sh", "-c", $command)
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress

$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $overridesJson, $utf8NoBom)

Write-Host "[RUN] Exécution de la vérification via ECS Task..." -ForegroundColor Green

$subnetsList = $SUBNETS -split ','
$securityGroupsList = $SECURITY_GROUPS -split ','
$networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'

$taskResult = aws ecs run-task `
    --region $REGION `
    --cluster $CLUSTER `
    --task-definition $TASK_DEFINITION `
    --launch-type FARGATE `
    --network-configuration $networkConfig `
    --overrides file://$tempFile `
    --query 'tasks[0].taskArn' `
    --output text 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $taskArn = ($taskResult -split "`n" | Select-String -Pattern '^arn:aws:ecs:' | Select-Object -First 1).Line.Trim()
    if (-not $taskArn) {
        $taskArn = $taskResult.Trim()
    }
    
    Write-Host "[OK] Task créée: $taskArn" -ForegroundColor Green
    Write-Host "[WAIT] Attente de la fin (30s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $taskId = $taskArn -replace '.*/', ''
    Write-Host ""
    Write-Host "[LOGS] Resultats de la verification:" -ForegroundColor Cyan
    Write-Host ""
    
    $logs = aws logs filter-log-events `
        --log-group-name /ecs/yukpomnang-backend `
        --region $REGION `
        --filter-pattern $taskId `
        --max-items 50 `
        --query 'events[*].message' `
        --output text 2>&1
    
    if ($logs) {
        $logs -split "`n" | ForEach-Object {
            $line = $_.Trim()
            if ($line -match 'OK|existe') {
                Write-Host $line -ForegroundColor Green
            } elseif ($line -match 'MANQUANT|MANQUANTE') {
                Write-Host $line -ForegroundColor Red
            } elseif ($line.Length -gt 0) {
                Write-Host $line -ForegroundColor White
            }
        }
    } else {
        Write-Host ' (Aucun log disponible pour le moment)' -ForegroundColor Gray
        Write-Host ''
        Write-Host 'Pour voir les logs complets, executez:' -ForegroundColor Cyan
        Write-Host ' aws logs tail /ecs/yukpomnang-backend --region' $REGION '--follow' -ForegroundColor White
    }
    
    Write-Host ""
} else {
    Write-Host '[ERROR] Erreur lors de la creation de la task:' $taskResult -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host '[OK] Verification terminee!' -ForegroundColor Green

