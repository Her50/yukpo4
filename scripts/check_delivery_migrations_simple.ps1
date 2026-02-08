# Script simple pour verifier les migrations de livraison/coursier dans AWS
# Usage: .\scripts\check_delivery_migrations_simple.ps1

$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:4"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

Write-Host "[CHECK] Verification des migrations de livraison/coursier dans AWS" -ForegroundColor Cyan
Write-Host ""

$sqlCheck = @'
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_delivery_config' AND column_name = 'storage_location_id') 
        THEN 'OK: storage_location_id existe' 
        ELSE 'ERREUR: storage_location_id MANQUANT' 
    END AS check1
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courier_assets' AND column_name = 'specializations') 
        THEN 'OK: specializations existe' 
        ELSE 'ERREUR: specializations MANQUANT' 
    END AS check2
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_delivery_config') 
        THEN 'OK: Table product_delivery_config existe' 
        ELSE 'ERREUR: Table product_delivery_config MANQUANTE' 
    END AS check3
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_delivery_preferences') 
        THEN 'OK: Table client_delivery_preferences existe' 
        ELSE 'ERREUR: Table client_delivery_preferences MANQUANTE' 
    END AS check4
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'external_delivery_providers') 
        THEN 'OK: Table external_delivery_providers existe' 
        ELSE 'ERREUR: Table external_delivery_providers MANQUANTE' 
    END AS check5
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_payment_reservations') 
        THEN 'OK: Table delivery_payment_reservations existe' 
        ELSE 'ERREUR: Table delivery_payment_reservations MANQUANTE' 
    END AS check6
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'product_delivery_config' AND indexname = 'idx_product_delivery_config_storage_location') 
        THEN 'OK: Index storage_location existe' 
        ELSE 'ERREUR: Index storage_location MANQUANT' 
    END AS check7
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'courier_assets' AND indexname = 'idx_courier_assets_specializations') 
        THEN 'OK: Index specializations existe' 
        ELSE 'ERREUR: Index specializations MANQUANT' 
    END AS check8
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_payment_reservations' AND column_name = 'client_payment_method') 
        THEN 'OK: client_payment_method existe' 
        ELSE 'ERREUR: client_payment_method MANQUANT' 
    END AS check9
UNION ALL
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'payment_methods') 
        THEN 'OK: payment_methods existe dans users' 
        ELSE 'ERREUR: payment_methods MANQUANT dans users' 
    END AS check10;
'@

$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlCheck))
$command = "echo '$sqlBase64' | base64 -d | psql `$DATABASE_URL -t -A"

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

Write-Host "[RUN] Execution de la verification via ECS Task..." -ForegroundColor Green

$subnetsList = $SUBNETS -split ','
$securityGroupsList = $SECURITY_GROUPS -split ','
$networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'

$taskResult = aws ecs run-task --region $REGION --cluster $CLUSTER --task-definition $TASK_DEFINITION --launch-type FARGATE --network-configuration $networkConfig --overrides file://$tempFile --query 'tasks[0].taskArn' --output text 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $taskArn = ($taskResult -split "`n" | Select-String -Pattern '^arn:aws:ecs:' | Select-Object -First 1).Line.Trim()
    if (-not $taskArn) {
        $taskArn = $taskResult.Trim()
    }
    
    Write-Host "[OK] Task creee: $taskArn" -ForegroundColor Green
    Write-Host "[WAIT] Attente de la fin (30s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $taskId = $taskArn -replace '.*/', ''
    Write-Host ""
    Write-Host "[LOGS] Resultats de la verification:" -ForegroundColor Cyan
    Write-Host ""
    
    $logs = aws logs filter-log-events --log-group-name /ecs/yukpomnang-backend --region $REGION --filter-pattern $taskId --max-items 50 --query 'events[*].message' --output text 2>&1
    
    if ($logs) {
        $logs -split "`n" | ForEach-Object {
            $line = $_.Trim()
            if ($line -match 'OK:') {
                Write-Host $line -ForegroundColor Green
            } elseif ($line -match 'ERREUR:') {
                Write-Host $line -ForegroundColor Red
            } elseif ($line.Length -gt 0) {
                Write-Host $line -ForegroundColor White
            }
        }
    } else {
        Write-Host " (Aucun log disponible)" -ForegroundColor Gray
    }
    
    Write-Host ""
} else {
    Write-Host "[ERROR] Erreur: $taskResult" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Verification terminee!" -ForegroundColor Green



