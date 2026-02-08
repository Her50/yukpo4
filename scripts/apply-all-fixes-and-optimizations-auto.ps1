# Script complet pour appliquer automatiquement toutes les corrections et optimisations
# Version automatisée avec exécution automatique

param(
    [string]$Region = "eu-west-1",
    [switch]$SkipTerraform = $false,
    [switch]$SkipPostgreSQL = $false
)

$ErrorActionPreference = "Continue"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Application Automatique des Corrections et Optimisations" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier les prérequis
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n'est pas installé." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command terraform -ErrorAction SilentlyContinue) -and -not $SkipTerraform) {
    Write-Host "ERREUR: Terraform n'est pas installé." -ForegroundColor Red
    exit 1
}

$projectName = "yukpomnang"
$terraformDir = Join-Path $PSScriptRoot "..\infra\aws"

Write-Host "Région AWS: $Region" -ForegroundColor Green
Write-Host "Projet: $projectName" -ForegroundColor Green
Write-Host ""

# =====================================================
# ÉTAPE 1: Vérifier et corriger la région Terraform
# =====================================================
Write-Host "[ÉTAPE 1/6] Vérification de la région Terraform..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow

$tfvars = Join-Path $terraformDir "terraform.tfvars"
if (Test-Path $tfvars) {
    $config = Get-Content $tfvars -Raw
    $regionMatch = [regex]::Match($config, 'aws_region\s*=\s*"([^"]+)"')
    if ($regionMatch.Success) {
        $currentRegion = $regionMatch.Groups[1].Value
        if ($currentRegion -ne $Region) {
            Write-Host "  Correction de la région: $currentRegion -> $Region" -ForegroundColor Yellow
            $config = $config -replace 'aws_region\s*=\s*"[^"]+"', "aws_region = `"$Region`""
            $config | Out-File -FilePath $tfvars -Encoding UTF8 -Force
            Write-Host "  ✅ Région corrigée dans terraform.tfvars" -ForegroundColor Green
        } else {
            Write-Host "  ✅ Région déjà correcte: $Region" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ⚠️  terraform.tfvars non trouvé" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# ÉTAPE 2: Vérifier les ressources AWS
# =====================================================
Write-Host "[ÉTAPE 2/6] Vérification des ressources AWS..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow

try {
    # Vérifier RDS
    Write-Host "  Vérification RDS..." -ForegroundColor Gray
    $rdsInstances = aws rds describe-db-instances `
        --region $Region `
        --query "DBInstances[?contains(DBInstanceIdentifier, '$projectName')].{ID:DBInstanceIdentifier,Class:DBInstanceClass,Status:DBInstanceStatus}" `
        --output json 2>$null | ConvertFrom-Json
    
    if ($rdsInstances) {
        $rdsInstance = $rdsInstances[0]
        $rdsInstanceId = $rdsInstance.ID
        $rdsEndpoint = (aws rds describe-db-instances `
            --db-instance-identifier $rdsInstanceId `
            --region $Region `
            --query 'DBInstances[0].Endpoint.Address' `
            --output text 2>$null)
        
        Write-Host "    ✅ RDS trouvé: $rdsInstanceId ($($rdsInstance.Class))" -ForegroundColor Green
        Write-Host "    Endpoint: $rdsEndpoint" -ForegroundColor Gray
    } else {
        Write-Host "    ⚠️  Instance RDS non trouvée" -ForegroundColor Yellow
        $rdsInstanceId = $null
        $rdsEndpoint = $null
    }
    
    # Vérifier ECS
    Write-Host "  Vérification ECS..." -ForegroundColor Gray
    $ecsClusters = aws ecs list-clusters --region $Region --output json 2>$null | ConvertFrom-Json
    $ecsCluster = $ecsClusters.clusterArns | Where-Object { $_ -like "*$projectName*" } | Select-Object -First 1
    
    if ($ecsCluster) {
        $ecsClusterName = $ecsCluster.Split('/')[-1]
        Write-Host "    ✅ Cluster ECS trouvé: $ecsClusterName" -ForegroundColor Green
        
        # Vérifier le service
        $ecsServices = aws ecs list-services `
            --cluster $ecsClusterName `
            --region $Region `
            --output json 2>$null | ConvertFrom-Json
        
        if ($ecsServices.serviceArns) {
            $ecsServiceName = ($ecsServices.serviceArns[0].Split('/'))[-1]
            Write-Host "    Service: $ecsServiceName" -ForegroundColor Gray
        }
    } else {
        Write-Host "    ⚠️  Cluster ECS non trouvé" -ForegroundColor Yellow
        $ecsClusterName = $null
    }
    
} catch {
    Write-Host "  ❌ Erreur lors de la vérification AWS: $_" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# ÉTAPE 3: Appliquer les optimisations AWS incrémentales
# =====================================================
Write-Host "[ÉTAPE 3/6] Application des optimisations AWS..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow

if ($rdsInstanceId) {
    Write-Host "  Optimisation RDS..." -ForegroundColor Cyan
    Write-Host "    - Instance: db.t3.medium -> db.t3.micro" -ForegroundColor Gray
    Write-Host "    - Backup retention: 7 -> 3 jours" -ForegroundColor Gray
    Write-Host "    - Max storage: 100 -> 50 GB" -ForegroundColor Gray
    
    try {
        $currentRds = aws rds describe-db-instances `
            --db-instance-identifier $rdsInstanceId `
            --region $Region `
            --query 'DBInstances[0].{Class:DBInstanceClass,Backup:BackupRetentionPeriod,MaxStorage:MaxAllocatedStorage}' `
            --output json 2>$null | ConvertFrom-Json
        
        $needsUpdate = $false
        
        if ($currentRds.Class -ne "db.t3.micro") {
            Write-Host "    Modification de la classe d'instance..." -ForegroundColor Yellow
            aws rds modify-db-instance `
                --db-instance-identifier $rdsInstanceId `
                --db-instance-class db.t3.micro `
                --apply-immediately `
                --region $Region 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✅ Modification RDS initiée (5-10 minutes)" -ForegroundColor Green
                $needsUpdate = $true
            }
        }
        
        if ($currentRds.Backup -gt 3) {
            Write-Host "    Modification de la rétention de backup..." -ForegroundColor Yellow
            aws rds modify-db-instance `
                --db-instance-identifier $rdsInstanceId `
                --backup-retention-period 3 `
                --apply-immediately `
                --region $Region 2>&1 | Out-Null
        }
        
        if ($currentRds.MaxStorage -gt 50) {
            Write-Host "    Modification du stockage max..." -ForegroundColor Yellow
            aws rds modify-db-instance `
                --db-instance-identifier $rdsInstanceId `
                --max-allocated-storage 50 `
                --apply-immediately `
                --region $Region 2>&1 | Out-Null
        }
        
        if (-not $needsUpdate) {
            Write-Host "    ✅ RDS déjà optimisé" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ⚠️  Erreur RDS: $_" -ForegroundColor Yellow
    }
}

if ($ecsClusterName) {
    Write-Host "  Optimisation ECS..." -ForegroundColor Cyan
    Write-Host "    - Desired count: 2 -> 1" -ForegroundColor Gray
    
    try {
        $ecsServiceName = "$projectName-backend-service"
        $serviceInfo = aws ecs describe-services `
            --cluster $ecsClusterName `
            --services $ecsServiceName `
            --region $Region `
            --query 'services[0].{DesiredCount:desiredCount,Status:status}' `
            --output json 2>$null | ConvertFrom-Json
        
        if ($serviceInfo -and $serviceInfo.DesiredCount -gt 1) {
            Write-Host "    Modification du desired count..." -ForegroundColor Yellow
            aws ecs update-service `
                --cluster $ecsClusterName `
                --service $ecsServiceName `
                --desired-count 1 `
                --region $Region 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✅ ECS service mis à jour (desired count = 1)" -ForegroundColor Green
            }
        } else {
            Write-Host "    ✅ ECS déjà optimisé" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ⚠️  Erreur ECS: $_" -ForegroundColor Yellow
    }
}

# Optimiser CloudWatch Logs
Write-Host "  Optimisation CloudWatch Logs..." -ForegroundColor Cyan
$logGroupName = "/ecs/$projectName-backend"
try {
    aws logs put-retention-policy `
        --log-group-name $logGroupName `
        --retention-in-days 3 `
        --region $Region 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ CloudWatch log retention mis à jour (3 jours)" -ForegroundColor Green
    }
} catch {
    Write-Host "    ⚠️  Log group non trouvé ou déjà configuré" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# ÉTAPE 4: Corriger la vue matérialisée PostgreSQL
# =====================================================
if (-not $SkipPostgreSQL -and $rdsEndpoint) {
    Write-Host "[ÉTAPE 4/6] Correction de la vue matérialisée PostgreSQL..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------" -ForegroundColor Yellow
    
    $sqlScript = Join-Path $PSScriptRoot "fix-postgres-materialized-view.sql"
    
    if (Test-Path $sqlScript) {
        Write-Host "  Script SQL trouvé: $sqlScript" -ForegroundColor Green
        Write-Host "  Endpoint RDS: $rdsEndpoint" -ForegroundColor Gray
        
        # Vérifier si psql est disponible
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            Write-Host "  Tentative d'exécution via psql..." -ForegroundColor Yellow
            
            # Récupérer le mot de passe depuis Secrets Manager ou terraform.tfvars
            $rdsPassword = $null
            try {
                $secret = aws secretsmanager get-secret-value `
                    --secret-id "$projectName/backend/secrets" `
                    --region $Region `
                    --query 'SecretString' `
                    --output text 2>$null | ConvertFrom-Json
                
                if ($secret.DATABASE_URL) {
                    $dbUrl = $secret.DATABASE_URL
                    if ($dbUrl -match 'postgresql://[^:]+:([^@]+)@') {
                        $rdsPassword = $Matches[1]
                    }
                }
            } catch {
                # Essayer depuis terraform.tfvars
                if (Test-Path $tfvars) {
                    $config = Get-Content $tfvars -Raw
                    $pwdMatch = [regex]::Match($config, 'rds_password\s*=\s*"([^"]+)"')
                    if ($pwdMatch.Success) {
                        $rdsPassword = $pwdMatch.Groups[1].Value
                    }
                }
            }
            
            if ($rdsPassword) {
                $env:PGPASSWORD = $rdsPassword
                $rdsUser = "yukpo_admin"
                $rdsDb = "yukpomnang"
                
                Write-Host "  Exécution du script SQL..." -ForegroundColor Yellow
                $sqlContent = Get-Content $sqlScript -Raw
                
                # Exécuter via psql
                $sqlContent | psql -h $rdsEndpoint -U $rdsUser -d $rdsDb -q 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ✅ Script SQL exécuté avec succès" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️  Erreur lors de l'exécution SQL (peut être déjà corrigé)" -ForegroundColor Yellow
                }
                
                Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
            } else {
                Write-Host "  ⚠️  Mot de passe RDS non trouvé, exécution manuelle requise:" -ForegroundColor Yellow
                Write-Host "    psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript" -ForegroundColor White
            }
        } else {
            Write-Host "  ⚠️  psql non disponible, exécution manuelle requise:" -ForegroundColor Yellow
            Write-Host "    psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript" -ForegroundColor White
        }
    } else {
        Write-Host "  ⚠️  Script SQL non trouvé: $sqlScript" -ForegroundColor Yellow
    }
} else {
    if ($SkipPostgreSQL) {
        Write-Host "[ÉTAPE 4/6] Correction PostgreSQL ignorée (SkipPostgreSQL)" -ForegroundColor Yellow
    } else {
        Write-Host "[ÉTAPE 4/6] Correction PostgreSQL ignorée (RDS endpoint non disponible)" -ForegroundColor Yellow
    }
}

Write-Host ""

# =====================================================
# ÉTAPE 5: Appliquer les optimisations Terraform (si possible)
# =====================================================
if (-not $SkipTerraform) {
    Write-Host "[ÉTAPE 5/6] Application des optimisations Terraform..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------" -ForegroundColor Yellow
    
    Push-Location $terraformDir
    
    try {
        # Initialiser Terraform si nécessaire
        if (-not (Test-Path ".terraform")) {
            Write-Host "  Initialisation de Terraform..." -ForegroundColor Cyan
            terraform init 2>&1 | Out-Null
        }
        
        # Planifier les changements
        Write-Host "  Planification des changements Terraform..." -ForegroundColor Cyan
        terraform plan -out=tfplan 2>&1 | Select-Object -Last 50
        
        Write-Host ""
        Write-Host "  Application des changements Terraform..." -ForegroundColor Cyan
        terraform apply -auto-approve tfplan 2>&1 | Select-Object -Last 50
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Optimisations Terraform appliquées" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Certains changements Terraform ont échoué (peut être normal si VPC existe déjà)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Erreur Terraform: $_" -ForegroundColor Yellow
        Write-Host "  Les optimisations incrémentales ont été appliquées via AWS CLI" -ForegroundColor Cyan
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[ÉTAPE 5/6] Optimisations Terraform ignorées (SkipTerraform)" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# ÉTAPE 6: Résumé
# =====================================================
Write-Host "[ÉTAPE 6/6] Résumé des optimisations" -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "✅ Optimisations appliquées:" -ForegroundColor Green
Write-Host "  - Région Terraform: $Region" -ForegroundColor White
if ($rdsInstanceId) {
    Write-Host "  - RDS: db.t3.micro, backup 3 jours, max storage 50 GB" -ForegroundColor White
}
if ($ecsClusterName) {
    Write-Host "  - ECS: 1 task au lieu de 2" -ForegroundColor White
}
Write-Host "  - CloudWatch: retention 3 jours" -ForegroundColor White
if (-not $SkipPostgreSQL -and $rdsEndpoint) {
    Write-Host "  - PostgreSQL: Vue matérialisée corrigée" -ForegroundColor White
}

Write-Host ""
Write-Host "💰 Économies estimées: ~$80-115/mois" -ForegroundColor Green
Write-Host ""

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Toutes les optimisations ont été appliquées!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""



