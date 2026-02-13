# Script d'audit complet de toutes les configurations et permissions AWS
# Analyse approfondie pour identifier ce qui pourrait bloquer le démarrage

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$taskDefinition = "yukpo-backend"
$dbInstance = "yukpo-db"
$secretId = "yukpo/backend/secrets"

$report = @()

function Add-ReportItem {
    param($Category, $Item, $Status, $Details = "")
    $report += @{
        Category = $Category
        Item = $Item
        Status = $Status
        Details = $Details
        Timestamp = Get-Date
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUDIT COMPLET CONFIGURATIONS AWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# ========================================
# 1. CONFIGURATION ECS CLUSTER
# ========================================
Write-Host "1. CONFIGURATION ECS CLUSTER" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $clusterInfo = aws ecs describe-clusters --clusters $cluster --region $region --output json | ConvertFrom-Json
    if ($clusterInfo.clusters) {
        $cl = $clusterInfo.clusters[0]
        Write-Host "  Cluster: $($cl.clusterName)" -ForegroundColor White
        Write-Host "  Status: $($cl.status)" -ForegroundColor $(if ($cl.status -eq "ACTIVE") { "Green" } else { "Red" })
        Write-Host "  Running Tasks: $($cl.runningTasksCount)" -ForegroundColor White
        Write-Host "  Pending Tasks: $($cl.pendingTasksCount)" -ForegroundColor White
        Write-Host "  Active Services: $($cl.activeServicesCount)" -ForegroundColor White
        
        Add-ReportItem -Category "ECS Cluster" -Item "Cluster Status" -Status $(if ($cl.status -eq "ACTIVE") { "OK" } else { "ERROR" }) -Details $cl.status
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "ECS Cluster" -Item "Cluster Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 2. CONFIGURATION ECS SERVICE
# ========================================
Write-Host "2. CONFIGURATION ECS SERVICE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $serviceInfo = aws ecs describe-services --cluster $cluster --services $service --region $region --output json | ConvertFrom-Json
    if ($serviceInfo.services) {
        $svc = $serviceInfo.services[0]
        Write-Host "  Service: $($svc.serviceName)" -ForegroundColor White
        Write-Host "  Status: $($svc.status)" -ForegroundColor $(if ($svc.status -eq "ACTIVE") { "Green" } else { "Red" })
        Write-Host "  Desired Count: $($svc.desiredCount)" -ForegroundColor White
        Write-Host "  Running Count: $($svc.runningCount)" -ForegroundColor $(if ($svc.runningCount -gt 0) { "Green" } else { "Red" })
        Write-Host "  Pending Count: $($svc.pendingCount)" -ForegroundColor White
        Write-Host "  Task Definition: $($svc.taskDefinition.Split('/')[-1])" -ForegroundColor White
        Write-Host "  Launch Type: $($svc.launchType)" -ForegroundColor White
        
        # Health Check Configuration
        if ($svc.healthCheckGracePeriodSeconds) {
            Write-Host "  Health Check Grace Period: $($svc.healthCheckGracePeriodSeconds)s" -ForegroundColor White
        }
        
        # Network Configuration
        if ($svc.networkConfiguration) {
            $netConfig = $svc.networkConfiguration.awsvpcConfiguration
            Write-Host "  Subnets: $($netConfig.subnets -join ', ')" -ForegroundColor White
            Write-Host "  Security Groups: $($netConfig.securityGroups -join ', ')" -ForegroundColor White
            Write-Host "  Assign Public IP: $($netConfig.assignPublicIp)" -ForegroundColor White
        }
        
        Add-ReportItem -Category "ECS Service" -Item "Service Status" -Status $(if ($svc.status -eq "ACTIVE" -and $svc.runningCount -gt 0) { "OK" } else { "WARNING" }) -Details "Running: $($svc.runningCount), Desired: $($svc.desiredCount)"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "ECS Service" -Item "Service Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 3. CONFIGURATION TASK DEFINITION
# ========================================
Write-Host "3. CONFIGURATION TASK DEFINITION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $taskDef = aws ecs describe-task-definition --task-definition $taskDefinition --region $region --output json | ConvertFrom-Json
    if ($taskDef.taskDefinition) {
        $td = $taskDef.taskDefinition
        $container = $td.containerDefinitions[0]
        
        Write-Host "  Task Definition: $($td.family):$($td.revision)" -ForegroundColor White
        Write-Host "  Status: $($td.status)" -ForegroundColor $(if ($td.status -eq "ACTIVE") { "Green" } else { "Red" })
        Write-Host "  CPU: $($td.cpu)" -ForegroundColor White
        Write-Host "  Memory: $($td.memory)" -ForegroundColor White
        Write-Host "  Network Mode: $($td.networkMode)" -ForegroundColor White
        Write-Host "  Requires Compatibilities: $($td.requiresCompatibilities -join ', ')" -ForegroundColor White
        
        Write-Host ""
        Write-Host "  Container: $($container.name)" -ForegroundColor White
        Write-Host "  Image: $($container.image)" -ForegroundColor White
        Write-Host "  Essential: $($container.essential)" -ForegroundColor White
        
        # Health Check
        if ($container.healthCheck) {
            Write-Host "  Health Check:" -ForegroundColor Cyan
            Write-Host "    Command: $($container.healthCheck.command -join ' ')" -ForegroundColor Gray
            Write-Host "    Interval: $($container.healthCheck.interval)s" -ForegroundColor Gray
            Write-Host "    Timeout: $($container.healthCheck.timeout)s" -ForegroundColor Gray
            Write-Host "    Retries: $($container.healthCheck.retries)" -ForegroundColor Gray
            Write-Host "    Start Period: $($container.healthCheck.startPeriod)s" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️ Health Check: NON CONFIGURÉ" -ForegroundColor Yellow
            Add-ReportItem -Category "Task Definition" -Item "Health Check" -Status "WARNING" -Details "Health check non configuré"
        }
        
        # Port Mappings
        if ($container.portMappings) {
            Write-Host "  Port Mappings:" -ForegroundColor Cyan
            foreach ($pm in $container.portMappings) {
                Write-Host "    $($pm.containerPort) -> $($pm.hostPort)" -ForegroundColor Gray
            }
        }
        
        # Environment Variables (directes)
        $envVars = $container.environment | Where-Object { $_.name -in @("PORT", "HOST", "RUST_LOG", "APP_ENV") }
        if ($envVars) {
            Write-Host "  Variables d'environnement directes:" -ForegroundColor Cyan
            foreach ($env in $envVars) {
                Write-Host "    $($env.name) = $($env.value)" -ForegroundColor Gray
            }
        }
        
        # Secrets (depuis Secrets Manager)
        if ($container.secrets) {
            Write-Host "  Secrets (depuis Secrets Manager):" -ForegroundColor Cyan
            foreach ($secret in $container.secrets) {
                $secretArn = $secret.valueFrom
                Write-Host "    $($secret.name) depuis $secretArn" -ForegroundColor Gray
            }
        }
        
        # Execution Role
        if ($td.executionRoleArn) {
            Write-Host "  Execution Role: $($td.executionRoleArn)" -ForegroundColor White
        }
        
        # Task Role
        if ($td.taskRoleArn) {
            Write-Host "  Task Role: $($td.taskRoleArn)" -ForegroundColor White
        }
        
        Add-ReportItem -Category "Task Definition" -Item "Task Definition" -Status "OK" -Details "$($td.family):$($td.revision)"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Task Definition" -Item "Task Definition Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 4. PERMISSIONS IAM - EXECUTION ROLE
# ========================================
Write-Host "4. PERMISSIONS IAM - EXECUTION ROLE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $taskDef = aws ecs describe-task-definition --task-definition $taskDefinition --region $region --output json | ConvertFrom-Json
    if ($taskDef.taskDefinition.executionRoleArn) {
        $roleArn = $taskDef.taskDefinition.executionRoleArn
        $roleName = $roleArn.Split('/')[-1]
        
        Write-Host "  Execution Role: $roleName" -ForegroundColor White
        
        # Attached Policies
        $attachedPolicies = aws iam list-attached-role-policies --role-name $roleName --region $region --output json 2>&1 | ConvertFrom-Json
        if ($attachedPolicies.AttachedPolicies) {
            Write-Host "  Policies attachées:" -ForegroundColor Cyan
            foreach ($policy in $attachedPolicies.AttachedPolicies) {
                Write-Host "    - $($policy.PolicyName)" -ForegroundColor Gray
            }
        }
        
        # Inline Policies
        $inlinePolicies = aws iam list-role-policies --role-name $roleName --region $region --output json 2>&1 | ConvertFrom-Json
        if ($inlinePolicies.PolicyNames) {
            Write-Host "  Policies inline:" -ForegroundColor Cyan
            foreach ($policyName in $inlinePolicies.PolicyNames) {
                Write-Host "    - $policyName" -ForegroundColor Gray
                
                # Get policy document
                $policyDoc = aws iam get-role-policy --role-name $roleName --policy-name $policyName --region $region --output json 2>&1 | ConvertFrom-Json
                if ($policyDoc.PolicyDocument) {
                    $docJson = $policyDoc.PolicyDocument | ConvertTo-Json -Depth 10
                    if ($docJson -match "secretsmanager:GetSecretValue") {
                        Write-Host "      ✅ Permission GetSecretValue présente" -ForegroundColor Green
                    } else {
                        Write-Host "      ❌ Permission GetSecretValue MANQUANTE" -ForegroundColor Red
                        Add-ReportItem -Category "IAM Permissions" -Item "GetSecretValue" -Status "ERROR" -Details "Manquante dans $policyName"
                    }
                    
                    if ($docJson -match $secretId) {
                        Write-Host "      ✅ Secret $secretId autorisé" -ForegroundColor Green
                    } else {
                        Write-Host "      ⚠️ Secret $secretId peut ne pas être autorisé" -ForegroundColor Yellow
                        Add-ReportItem -Category "IAM Permissions" -Item "Secret Access" -Status "WARNING" -Details "Secret peut ne pas être autorisé"
                    }
                }
            }
        }
        
        Add-ReportItem -Category "IAM Permissions" -Item "Execution Role" -Status "OK" -Details $roleName
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "IAM Permissions" -Item "Execution Role" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 5. CONFIGURATION RÉSEAU - VPC, SUBNETS, SECURITY GROUPS
# ========================================
Write-Host "5. CONFIGURATION RÉSEAU" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $serviceInfo = aws ecs describe-services --cluster $cluster --services $service --region $region --output json | ConvertFrom-Json
    if ($serviceInfo.services[0].networkConfiguration) {
        $netConfig = $serviceInfo.services[0].networkConfiguration.awsvpcConfiguration
        $subnets = $netConfig.subnets
        $securityGroups = $netConfig.securityGroups
        
        Write-Host "  Subnets:" -ForegroundColor Cyan
        foreach ($subnetId in $subnets) {
            $subnet = aws ec2 describe-subnets --subnet-ids $subnetId --region $region --output json 2>&1 | ConvertFrom-Json
            if ($subnet.Subnets) {
                $sn = $subnet.Subnets[0]
                Write-Host "    $subnetId" -ForegroundColor White
                Write-Host "      VPC: $($sn.VpcId)" -ForegroundColor Gray
                Write-Host "      AZ: $($sn.AvailabilityZone)" -ForegroundColor Gray
                Write-Host "      CIDR: $($sn.CidrBlock)" -ForegroundColor Gray
            }
        }
        
        Write-Host "  Security Groups:" -ForegroundColor Cyan
        foreach ($sgId in $securityGroups) {
            $sg = aws ec2 describe-security-groups --group-ids $sgId --region $region --output json 2>&1 | ConvertFrom-Json
            if ($sg.SecurityGroups) {
                $sgInfo = $sg.SecurityGroups[0]
                Write-Host "    $sgId ($($sgInfo.GroupName))" -ForegroundColor White
                Write-Host "      Description: $($sgInfo.Description)" -ForegroundColor Gray
                
                # Inbound Rules
                Write-Host "      Inbound Rules:" -ForegroundColor Cyan
                foreach ($rule in $sgInfo.IpPermissions) {
                    $ports = if ($rule.FromPort -eq $rule.ToPort) { "$($rule.FromPort)" } else { "$($rule.FromPort)-$($rule.ToPort)" }
                    $source = if ($rule.IpRanges) { $rule.IpRanges[0].CidrIp } else { "N/A" }
                    Write-Host "        Port $ports from $source" -ForegroundColor Gray
                }
                
                # Outbound Rules
                Write-Host "      Outbound Rules:" -ForegroundColor Cyan
                foreach ($rule in $sgInfo.IpPermissionsEgress) {
                    $ports = if ($rule.FromPort -eq $rule.ToPort) { "$($rule.FromPort)" } else { "$($rule.FromPort)-$($rule.ToPort)" }
                    $dest = if ($rule.IpRanges) { $rule.IpRanges[0].CidrIp } else { "N/A" }
                    Write-Host "        Port $ports to $dest" -ForegroundColor Gray
                }
            }
        }
        
        Add-ReportItem -Category "Network" -Item "Network Configuration" -Status "OK" -Details "Subnets: $($subnets.Count), SGs: $($securityGroups.Count)"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Network" -Item "Network Config" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 6. CONFIGURATION RDS - SECURITY GROUPS
# ========================================
Write-Host "6. CONFIGURATION RDS - SECURITY GROUPS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $dbInfo = aws rds describe-db-instances --db-instance-identifier $dbInstance --region $region --output json 2>&1 | ConvertFrom-Json
    if ($dbInfo.DBInstances) {
        $db = $dbInfo.DBInstances[0]
        Write-Host "  Instance: $($db.DBInstanceIdentifier)" -ForegroundColor White
        Write-Host "  VPC Security Groups:" -ForegroundColor Cyan
        
        foreach ($sg in $db.VpcSecurityGroups) {
            $sgId = $sg.VpcSecurityGroupId
            $sgInfo = aws ec2 describe-security-groups --group-ids $sgId --region $region --output json 2>&1 | ConvertFrom-Json
            if ($sgInfo.SecurityGroups) {
                $sgDetails = $sgInfo.SecurityGroups[0]
                Write-Host "    $sgId ($($sgDetails.GroupName))" -ForegroundColor White
                
                # Vérifier si le port 5432 est ouvert depuis les security groups ECS
                $serviceInfo = aws ecs describe-services --cluster $cluster --services $service --region $region --output json | ConvertFrom-Json
                $ecsSGs = $serviceInfo.services[0].networkConfiguration.awsvpcConfiguration.securityGroups
                
                $port5432Open = $false
                foreach ($rule in $sgDetails.IpPermissions) {
                    if ($rule.FromPort -eq 5432 -or $rule.ToPort -eq 5432) {
                        # Vérifier si la source est le security group ECS ou le subnet
                        foreach ($userIdPair in $rule.UserIdGroupPairs) {
                            if ($ecsSGs -contains $userIdPair.GroupId) {
                                $port5432Open = $true
                                Write-Host "      ✅ Port 5432 ouvert depuis ECS security group $($userIdPair.GroupId)" -ForegroundColor Green
                                break
                            }
                        }
                        if (-not $port5432Open -and $rule.IpRanges) {
                            foreach ($ipRange in $rule.IpRanges) {
                                if ($ipRange.CidrIp -eq "0.0.0.0/0" -or $ipRange.CidrIp -match "^10\.|^172\.|^192\.168\.") {
                                    $port5432Open = $true
                                    Write-Host "      ✅ Port 5432 ouvert depuis $($ipRange.CidrIp)" -ForegroundColor Green
                                    break
                                }
                            }
                        }
                    }
                }
                
                if (-not $port5432Open) {
                    Write-Host "      ❌ Port 5432 peut ne pas être accessible depuis ECS" -ForegroundColor Red
                    Add-ReportItem -Category "RDS Security" -Item "Port 5432 Access" -Status "ERROR" -Details "Port 5432 peut ne pas être accessible depuis ECS security groups"
                }
            }
        }
        
        Add-ReportItem -Category "RDS Security" -Item "RDS Security Groups" -Status "OK" -Details "Security groups configurés"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "RDS Security" -Item "RDS Config" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 7. CONFIGURATION SECRETS MANAGER
# ========================================
Write-Host "7. CONFIGURATION SECRETS MANAGER" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $secret = aws secretsmanager get-secret-value --secret-id $secretId --region $region --query 'SecretString' --output text 2>&1 | ConvertFrom-Json
    if ($secret) {
        Write-Host "  Secret: $secretId" -ForegroundColor White
        
        $criticalVars = @("DATABASE_URL", "REDIS_URL", "MONGODB_URL", "JWT_SECRET", "PORT", "HOST")
        $missing = @()
        $present = @()
        
        foreach ($var in $criticalVars) {
            if ($secret.$var) {
                $present += $var
                $value = $secret.$var
                $displayValue = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
                Write-Host "    ✅ $var : $displayValue" -ForegroundColor Green
            } else {
                $missing += $var
                Write-Host "    ❌ $var : MANQUANTE" -ForegroundColor Red
            }
        }
        
        if ($missing.Count -eq 0) {
            Add-ReportItem -Category "Secrets Manager" -Item "Critical Variables" -Status "OK" -Details "Toutes présentes"
        } else {
            Add-ReportItem -Category "Secrets Manager" -Item "Critical Variables" -Status "ERROR" -Details "Manquantes: $($missing -join ', ')"
        }
        
        # Vérifier le format JSON
        try {
            $testJson = $secret | ConvertTo-Json -Depth 10
            Add-ReportItem -Category "Secrets Manager" -Item "JSON Format" -Status "OK" -Details "Format valide"
        } catch {
            Add-ReportItem -Category "Secrets Manager" -Item "JSON Format" -Status "ERROR" -Details "Format invalide"
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Secrets Manager" -Item "Secret Access" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 8. CONFIGURATION CLOUDWATCH LOGS
# ========================================
Write-Host "8. CONFIGURATION CLOUDWATCH LOGS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $logGroup = "/ecs/yukpo-backend"
    $logGroupInfo = aws logs describe-log-groups --log-group-name-prefix $logGroup --region $region --output json 2>&1 | ConvertFrom-Json
    if ($logGroupInfo.logGroups) {
        $lg = $logGroupInfo.logGroups | Where-Object { $_.logGroupName -eq $logGroup } | Select-Object -First 1
        if ($lg) {
            Write-Host "  Log Group: $($lg.logGroupName)" -ForegroundColor White
            Write-Host "  Retention: $($lg.retentionInDays) jours" -ForegroundColor White
            Write-Host "  Created: $($lg.creationTime)" -ForegroundColor White
            
            # Vérifier les permissions
            $logGroupPolicy = aws logs get-log-group --log-group-name $logGroup --region $region --output json 2>&1 | ConvertFrom-Json
            if ($logGroupPolicy) {
                Write-Host "  ✅ Log group accessible" -ForegroundColor Green
            }
            
            Add-ReportItem -Category "CloudWatch Logs" -Item "Log Group" -Status "OK" -Details $logGroup
        } else {
            Write-Host "  ⚠️ Log group non trouvé" -ForegroundColor Yellow
            Add-ReportItem -Category "CloudWatch Logs" -Item "Log Group" -Status "WARNING" -Details "Log group non trouvé"
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "CloudWatch Logs" -Item "Log Group" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 9. VÉRIFICATION DES TÂCHES RÉCENTES
# ========================================
Write-Host "9. VÉRIFICATION DES TÂCHES RÉCENTES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $stoppedTasks = aws ecs list-tasks --cluster $cluster --desired-status STOPPED --region $region --max-items 3 --output json | ConvertFrom-Json
    if ($stoppedTasks.taskArns) {
        Write-Host "  Dernières tâches arrêtées:" -ForegroundColor Cyan
        foreach ($taskArn in $stoppedTasks.taskArns) {
            $taskId = $taskArn.Split('/')[-1]
            $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
            if ($taskDetails.tasks) {
                $task = $taskDetails.tasks[0]
                Write-Host "    $taskId" -ForegroundColor White
                Write-Host "      Stop Code: $($task.stopCode)" -ForegroundColor Gray
                Write-Host "      Exit Code: $($task.containers[0].exitCode)" -ForegroundColor $(if ($task.containers[0].exitCode -eq 0) { "Green" } else { "Red" })
                Write-Host "      Stopped Reason: $($task.stoppedReason)" -ForegroundColor Gray
                Write-Host "      Health Status: $($task.containers[0].healthStatus)" -ForegroundColor $(if ($task.containers[0].healthStatus -eq "HEALTHY") { "Green" } else { "Red" })
                
                if ($task.stopCode -eq "EssentialContainerExited" -or $task.stoppedReason -match "health") {
                    Add-ReportItem -Category "Tasks" -Item "Task $taskId" -Status "ERROR" -Details "Health check failed: $($task.stoppedReason)"
                }
            }
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# ========================================
# 10. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT DANS LA TÂCHE
# ========================================
Write-Host "10. VÉRIFICATION DES VARIABLES DANS LA TÂCHE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $runningTasks = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING --region $region --max-items 1 --output json | ConvertFrom-Json
    if ($runningTasks.taskArns) {
        $taskArn = $runningTasks.taskArns[0]
        $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
        if ($taskDetails.tasks) {
            $task = $taskDetails.tasks[0]
            $container = $task.containers[0]
            
            Write-Host "  Tâche en cours: $($taskArn.Split('/')[-1])" -ForegroundColor White
            Write-Host "  Image: $($container.image)" -ForegroundColor White
            Write-Host "  Health Status: $($container.healthStatus)" -ForegroundColor $(if ($container.healthStatus -eq "HEALTHY") { "Green" } else { "Yellow" })
            
            # Vérifier que les secrets sont bien référencés
            $taskDef = aws ecs describe-task-definition --task-definition $taskDefinition --region $region --output json | ConvertFrom-Json
            $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
            if ($containerDef.secrets) {
                Write-Host "  Secrets référencés:" -ForegroundColor Cyan
                foreach ($secret in $containerDef.secrets) {
                    Write-Host "    $($secret.name) -> $($secret.valueFrom)" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host "  ⚠️ Aucune tâche en cours" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
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
        Write-Host "  [$($error.Category)] $($error.Item): $($error.Details)" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  [$($warning.Category)] $($warning.Item): $($warning.Details)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Sauvegarder le rapport
$reportFile = "AUDIT_COMPLET_AWS_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host "Rapport sauvegardé: $reportFile" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUDIT TERMINÉ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

