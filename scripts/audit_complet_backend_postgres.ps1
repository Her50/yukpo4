# Script d'audit complet du backend et de l'accès PostgreSQL
# Analyse approfondie de tous les aspects qui pourraient bloquer le démarrage

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

$report = @()

function Add-ReportSection {
    param($Title, $Content, $Status = "INFO")
    $report += @{
        Title = $Title
        Content = $Content
        Status = $Status
        Timestamp = Get-Date
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUDIT COMPLET BACKEND + POSTGRESQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# ========================================
# 1. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT AWS
# ========================================
Write-Host "1. VERIFICATION DES VARIABLES D'ENVIRONNEMENT AWS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$secretId = "yukpo/backend/secrets"
try {
    $secretJson = aws secretsmanager get-secret-value --secret-id $secretId --region $region --query 'SecretString' --output text 2>&1
    if ($LASTEXITCODE -eq 0) {
        $secret = $secretJson | ConvertFrom-Json
        $criticalVars = @("DATABASE_URL", "REDIS_URL", "MONGODB_URL", "JWT_SECRET", "PORT", "HOST")
        $missingVars = @()
        $presentVars = @()
        
        foreach ($var in $criticalVars) {
            if ($secret.$var) {
                $presentVars += $var
                Write-Host "  ✅ $var : Présente" -ForegroundColor Green
            } else {
                $missingVars += $var
                Write-Host "  ❌ $var : MANQUANTE" -ForegroundColor Red
            }
        }
        
        if ($missingVars.Count -eq 0) {
            Add-ReportSection -Title "Variables d'environnement" -Content "Toutes les variables critiques sont présentes" -Status "OK"
        } else {
            Add-ReportSection -Title "Variables d'environnement" -Content "Variables manquantes: $($missingVars -join ', ')" -Status "ERROR"
        }
    } else {
        Write-Host "  ❌ Impossible de récupérer le secret" -ForegroundColor Red
        Add-ReportSection -Title "Variables d'environnement" -Content "Erreur lors de la récupération du secret: $secretJson" -Status "ERROR"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportSection -Title "Variables d'environnement" -Content "Exception: $_" -Status "ERROR"
}

Write-Host ""

# ========================================
# 2. VÉRIFICATION DE LA BASE DE DONNÉES
# ========================================
Write-Host "2. VERIFICATION DE LA BASE DE DONNÉES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands1 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Existence de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c \"SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner, datacl, encoding, datcollate, datctype, datconnlimit, datallowconn FROM pg_database WHERE datname = '$dbName';\" 2>&1",
    "echo ''",
    "echo '=== Test de connexion directe ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT current_database(), current_user, version();' 2>&1"
)

$params1 = @{ commands = $commands1 } | ConvertTo-Json -Compress -Depth 10
$tempFile1 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile1, $params1, [System.Text.UTF8Encoding]::new($false))

$cmd1 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile1" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile1 -Force
Start-Sleep -Seconds 5

$inv1 = aws ssm get-command-invocation --command-id $cmd1.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv1.StandardOutputContent -ForegroundColor White

if ($inv1.StandardOutputContent -match "current_database.*yukpo") {
    Add-ReportSection -Title "Base de données" -Content "Base '$dbName' existe et accessible" -Status "OK"
} else {
    Add-ReportSection -Title "Base de données" -Content "Base '$dbName' peut ne pas exister ou être inaccessible" -Status "WARNING"
}

Write-Host ""

# ========================================
# 3. VÉRIFICATION DES EXTENSIONS POSTGRESQL
# ========================================
Write-Host "3. VERIFICATION DES EXTENSIONS POSTGRESQL" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$requiredExtensions = @("uuid-ossp", "pg_trgm", "unaccent", "pgcrypto", "postgis", "vector")
$commands2 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Extensions installées ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT extname, extversion FROM pg_extension ORDER BY extname;' 2>&1",
    "echo ''",
    "echo '=== Extensions requises disponibles ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('uuid-ossp', 'pg_trgm', 'unaccent', 'pgcrypto', 'postgis', 'vector') ORDER BY name;\" 2>&1"
)

$params2 = @{ commands = $commands2 } | ConvertTo-Json -Compress -Depth 10
$tempFile2 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile2, $params2, [System.Text.UTF8Encoding]::new($false))

$cmd2 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile2" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile2 -Force
Start-Sleep -Seconds 5

$inv2 = aws ssm get-command-invocation --command-id $cmd2.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv2.StandardOutputContent -ForegroundColor White

$installedExtensions = @()
foreach ($ext in $requiredExtensions) {
    if ($inv2.StandardOutputContent -match $ext) {
        $installedExtensions += $ext
        Write-Host "  ✅ $ext : Installée" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $ext : MANQUANTE" -ForegroundColor Red
    }
}

if ($installedExtensions.Count -eq $requiredExtensions.Count) {
    Add-ReportSection -Title "Extensions PostgreSQL" -Content "Toutes les extensions requises sont installées" -Status "OK"
} else {
    $missing = $requiredExtensions | Where-Object { $installedExtensions -notcontains $_ }
    Add-ReportSection -Title "Extensions PostgreSQL" -Content "Extensions manquantes: $($missing -join ', ')" -Status "ERROR"
}

Write-Host ""

# ========================================
# 4. VÉRIFICATION DES PERMISSIONS
# ========================================
Write-Host "4. VERIFICATION DES PERMISSIONS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$commands3 = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '=== Propriétaire de la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c \"SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database WHERE datname = '$dbName';\" 2>&1",
    "echo ''",
    "echo '=== Permissions sur la base ==='",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c \"SELECT has_database_privilege('$dbUser', '$dbName', 'CONNECT');\" 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d postgres -c \"SELECT has_database_privilege('$dbUser', '$dbName', 'CREATE');\" 2>&1",
    "echo ''",
    "echo '=== Permissions sur le schéma public ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT has_schema_privilege('$dbUser', 'public', 'USAGE');\" 2>&1",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT has_schema_privilege('$dbUser', 'public', 'CREATE');\" 2>&1",
    "echo ''",
    "echo '=== Propriétaire du schéma public ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c \"SELECT nspname, nspowner::regrole FROM pg_namespace WHERE nspname = 'public';\" 2>&1",
    "echo ''",
    "echo '=== Test création table ==='",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'CREATE TABLE IF NOT EXISTS test_permissions_audit (id INT); DROP TABLE IF EXISTS test_permissions_audit;' 2>&1"
)

$params3 = @{ commands = $commands3 } | ConvertTo-Json -Compress -Depth 10
$tempFile3 = Join-Path ([System.IO.Path]::GetTempPath()) "ssm-params-$(Get-Date -Format 'yyyyMMddHHmmss').json"
[System.IO.File]::WriteAllText($tempFile3, $params3, [System.Text.UTF8Encoding]::new($false))

$cmd3 = aws ssm send-command --instance-ids $instanceId --document-name "AWS-RunShellScript" --parameters "file://$tempFile3" --region $region --output json | ConvertFrom-Json
Remove-Item $tempFile3 -Force
Start-Sleep -Seconds 5

$inv3 = aws ssm get-command-invocation --command-id $cmd3.Command.CommandId --instance-id $instanceId --region $region --output json | ConvertFrom-Json
Write-Host $inv3.StandardOutputContent -ForegroundColor White

if ($inv3.StandardOutputContent -match "owner.*yukpo_admin" -and $inv3.StandardOutputContent -match "CREATE TABLE") {
    Add-ReportSection -Title "Permissions" -Content "Permissions correctes: propriétaire yukpo_admin, peut créer des tables" -Status "OK"
} else {
    Add-ReportSection -Title "Permissions" -Content "Problèmes de permissions détectés" -Status "WARNING"
}

Write-Host ""

# ========================================
# 5. VÉRIFICATION DE LA CONFIGURATION RDS
# ========================================
Write-Host "5. VERIFICATION DE LA CONFIGURATION RDS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $dbInstance = aws rds describe-db-instances --db-instance-identifier yukpo-db --region $region --output json 2>&1 | ConvertFrom-Json
    if ($dbInstance) {
        $db = $dbInstance.DBInstances[0]
        Write-Host "  Instance: $($db.DBInstanceIdentifier)" -ForegroundColor White
        Write-Host "  Status: $($db.DBInstanceStatus)" -ForegroundColor $(if ($db.DBInstanceStatus -eq "available") { "Green" } else { "Yellow" })
        Write-Host "  Engine: $($db.Engine) $($db.EngineVersion)" -ForegroundColor White
        Write-Host "  Instance Class: $($db.DBInstanceClass)" -ForegroundColor White
        Write-Host "  Publicly Accessible: $($db.PubliclyAccessible)" -ForegroundColor White
        Write-Host "  VPC Security Groups: $($db.VpcSecurityGroups.Count)" -ForegroundColor White
        
        Add-ReportSection -Title "Configuration RDS" -Content "Instance: $($db.DBInstanceIdentifier), Status: $($db.DBInstanceStatus), Engine: $($db.Engine) $($db.EngineVersion)" -Status "OK"
    }
} catch {
    Write-Host "  ⚠️ Impossible de récupérer les informations RDS: $_" -ForegroundColor Yellow
    Add-ReportSection -Title "Configuration RDS" -Content "Erreur lors de la récupération: $_" -Status "WARNING"
}

Write-Host ""

# ========================================
# 6. VÉRIFICATION DES GROUPES DE SÉCURITÉ
# ========================================
Write-Host "6. VERIFICATION DES GROUPES DE SECURITE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $dbInstance = aws rds describe-db-instances --db-instance-identifier yukpo-db --region $region --output json 2>&1 | ConvertFrom-Json
    if ($dbInstance) {
        $db = $dbInstance.DBInstances[0]
        foreach ($sg in $db.VpcSecurityGroups) {
            $sgDetails = aws ec2 describe-security-groups --group-ids $sg.VpcSecurityGroupId --region $region --output json 2>&1 | ConvertFrom-Json
            if ($sgDetails) {
                $sgInfo = $sgDetails.SecurityGroups[0]
                Write-Host "  Security Group: $($sgInfo.GroupId) ($($sgInfo.GroupName))" -ForegroundColor White
                Write-Host "    Description: $($sgInfo.Description)" -ForegroundColor Gray
                Write-Host "    Inbound Rules: $($sgInfo.IpPermissions.Count)" -ForegroundColor Gray
                
                # Vérifier si le port 5432 est ouvert
                $port5432Open = $false
                foreach ($rule in $sgInfo.IpPermissions) {
                    if ($rule.FromPort -eq 5432 -or $rule.ToPort -eq 5432) {
                        $port5432Open = $true
                        break
                    }
                }
                
                if ($port5432Open) {
                    Write-Host "    ✅ Port 5432 ouvert" -ForegroundColor Green
                } else {
                    Write-Host "    ⚠️ Port 5432 peut ne pas être ouvert" -ForegroundColor Yellow
                }
            }
        }
    }
} catch {
    Write-Host "  ⚠️ Impossible de vérifier les security groups: $_" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# 7. VÉRIFICATION DES LOGS ECS
# ========================================
Write-Host "7. VERIFICATION DES LOGS ECS RECENTS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $stoppedTasks = aws ecs list-tasks --cluster yukpo-cluster --desired-status STOPPED --region $region --max-items 1 --output json | ConvertFrom-Json
    if ($stoppedTasks.taskArns -and $stoppedTasks.taskArns.Count -gt 0) {
        $taskArn = $stoppedTasks.taskArns[0]
        $taskId = $taskArn.Split('/')[-1]
        Write-Host "  Dernière tâche arrêtée: $taskId" -ForegroundColor White
        
        $streamName = "backend/backend/$taskId"
        $events = aws logs get-log-events --log-group-name "/ecs/yukpo-backend" --log-stream-name $streamName --region $region --limit 50 --output json 2>&1 | ConvertFrom-Json
        
        if ($events.events) {
            $hasMain = ($events.events | Where-Object { $_.message -match "\[MAIN\]" }).Count -gt 0
            $hasDebug = ($events.events | Where-Object { $_.message -match "executable|yukpomnang_backend|file|ldd" }).Count -gt 0
            $hasError = ($events.events | Where-Object { $_.message -match "error|Error|ERROR|fail|Fail|FAIL|❌|panic" }).Count -gt 0
            
            Write-Host "    Logs [MAIN]: $(if ($hasMain) { '✅ Présents' } else { '❌ Absents' })" -ForegroundColor $(if ($hasMain) { "Green" } else { "Red" })
            Write-Host "    Logs debug: $(if ($hasDebug) { '✅ Présents' } else { '❌ Absents' })" -ForegroundColor $(if ($hasDebug) { "Green" } else { "Red" })
            Write-Host "    Erreurs: $(if ($hasError) { '⚠️ Présentes' } else { '✅ Aucune' })" -ForegroundColor $(if ($hasError) { "Yellow" } else { "Green" })
            
            if (-not $hasMain) {
                Add-ReportSection -Title "Logs ECS" -Content "Aucun log [MAIN] trouvé - l'application crash avant main()" -Status "ERROR"
            } else {
                Add-ReportSection -Title "Logs ECS" -Content "Logs [MAIN] présents" -Status "OK"
            }
        }
    }
} catch {
    Write-Host "  ⚠️ Impossible de récupérer les logs: $_" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# RÉSUMÉ FINAL
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ DE L'AUDIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = $report | Where-Object { $_.Status -eq "ERROR" }
$warnings = $report | Where-Object { $_.Status -eq "WARNING" }
$ok = $report | Where-Object { $_.Status -eq "OK" }

Write-Host "✅ Vérifications OK: $($ok.Count)" -ForegroundColor Green
Write-Host "⚠️ Avertissements: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "❌ Erreurs: $($errors.Count)" -ForegroundColor Red
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "ERREURS CRITIQUES:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $($error.Title): $($error.Content)" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $($warning.Title): $($warning.Content)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Sauvegarder le rapport
$reportFile = "AUDIT_BACKEND_POSTGRES_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host "Rapport sauvegardé: $reportFile" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUDIT TERMINÉ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

