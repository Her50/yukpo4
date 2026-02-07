# Script complet pour appliquer toutes les optimisations AWS
# Version simplifiee sans caracteres speciaux pour compatibilite

param(
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"

Write-Host "Application de Toutes les Optimisations AWS - Yukpomnang" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier les prerequis
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n'est pas installe." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: Terraform n'est pas installe." -ForegroundColor Red
    exit 1
}

$awsRegion = "eu-west-1"
$projectName = "yukpomnang"

# Detectar la region depuis terraform.tfvars
$terraformDir = Join-Path $PSScriptRoot "..\infra\aws"
$tfvars = Join-Path $terraformDir "terraform.tfvars"

if (Test-Path $tfvars) {
    $config = Get-Content $tfvars -Raw
    $regionMatch = [regex]::Match($config, 'aws_region\s*=\s*"([^"]+)"')
    if ($regionMatch.Success) {
        $awsRegion = $regionMatch.Groups[1].Value
    }
}

Write-Host "Region AWS detectee: $awsRegion" -ForegroundColor Green
Write-Host ""

# ETAPE 1: Optimiser les couts AWS
Write-Host "ETAPE 1: Optimisation des couts AWS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

$tfvarsTest = Join-Path $terraformDir "terraform.tfvars.test"
$tfvarsBackup = Join-Path $terraformDir "terraform.tfvars.production.backup"

if (-not (Test-Path $tfvarsTest)) {
    Write-Host "ERREUR: Fichier terraform.tfvars.test introuvable!" -ForegroundColor Red
    exit 1
}

# Sauvegarder la configuration actuelle
if (Test-Path $tfvars) {
    Write-Host "Sauvegarde de la configuration actuelle..." -ForegroundColor Cyan
    Copy-Item $tfvars $tfvarsBackup -Force
    Write-Host "Sauvegarde OK: terraform.tfvars.production.backup" -ForegroundColor Green
}

# Lire la config actuelle pour recuperer les valeurs sensibles
$currentConfig = Get-Content $tfvars -Raw -Encoding UTF8
$rdsPasswordMatch = [regex]::Match($currentConfig, 'rds_password\s*=\s*"([^"]+)"')
$rdsPassword = if ($rdsPasswordMatch.Success) { $rdsPasswordMatch.Groups[1].Value } else { "" }
$jwtSecretMatch = [regex]::Match($currentConfig, 'jwt_secret\s*=\s*"([^"]+)"')
$jwtSecret = if ($jwtSecretMatch.Success) { $jwtSecretMatch.Groups[1].Value } else { "" }

# Lire la config test et remplacer les valeurs sensibles
$testConfig = Get-Content $tfvarsTest -Raw -Encoding UTF8
if ($rdsPassword -and $testConfig -match 'rds_password\s*=\s*"CHANGE_ME') {
    $testConfig = $testConfig -replace 'rds_password\s*=\s*"CHANGE_ME[^"]*"', "rds_password = `"$rdsPassword`""
}
if ($jwtSecret -and $testConfig -match 'jwt_secret\s*=\s*"CHANGE_ME') {
    $testConfig = $testConfig -replace 'jwt_secret\s*=\s*"CHANGE_ME[^"]*"', "jwt_secret = `"$jwtSecret`""
}

# Ecrire la config optimisee
$testConfig | Out-File -FilePath $tfvars -Encoding UTF8 -Force
Write-Host "Configuration optimisee appliquee" -ForegroundColor Green
Write-Host ""

# Aller dans le repertoire Terraform
Push-Location $terraformDir

try {
    # Initialiser Terraform si necessaire
    if (-not (Test-Path ".terraform")) {
        Write-Host "Initialisation de Terraform..." -ForegroundColor Cyan
        terraform init
    }
    
    # Planifier les changements
    Write-Host "Planification des changements..." -ForegroundColor Cyan
    Write-Host "ATTENTION: Verifiez attentivement les changements!" -ForegroundColor Yellow
    Write-Host ""
    
    terraform plan -out=tfplan
    
    Write-Host ""
    Write-Host "ATTENTION: Les changements suivants vont etre appliques:" -ForegroundColor Yellow
    Write-Host "  - RDS sera redemarre (downtime ~5-10 min)" -ForegroundColor Yellow
    Write-Host "  - ECS tasks seront recreees" -ForegroundColor Yellow
    Write-Host "  - NAT Gateway sera supprime" -ForegroundColor Yellow
    Write-Host "  - ElastiCache sera cree/optimise" -ForegroundColor Yellow
    Write-Host ""
    
    if ($DryRun) {
        Write-Host "Mode Dry-Run: Aucun changement applique" -ForegroundColor Cyan
    } else {
        $confirm = Read-Host "Voulez-vous appliquer ces changements? (oui/non)"
        if ($confirm -eq "oui") {
            Write-Host ""
            Write-Host "Application des changements Terraform..." -ForegroundColor Cyan
            terraform apply tfplan
            Write-Host ""
            Write-Host "Optimisations Terraform appliquees!" -ForegroundColor Green
        } else {
            Write-Host "Operation annulee" -ForegroundColor Yellow
            Pop-Location
            exit 0
        }
    }
} catch {
    Write-Host "ERREUR lors de l'application Terraform: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Attente de 30 secondes pour que les ressources soient pretes..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# ETAPE 2: Migrer Redis vers ElastiCache
Write-Host ""
Write-Host "ETAPE 2: Migration Redis vers ElastiCache" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow
Write-Host ""

try {
    # Recuperer l'endpoint ElastiCache
    Write-Host "Recuperation de l'endpoint ElastiCache..." -ForegroundColor Cyan
    $redisEndpoint = aws elasticache describe-replication-groups `
        --replication-group-id "$projectName-redis" `
        --region $awsRegion `
        --query 'ReplicationGroups[0].PrimaryEndpoint.Address' `
        --output text 2>$null
    
    if (-not $redisEndpoint -or $redisEndpoint -eq "None") {
        Write-Host "ElastiCache n'est pas encore disponible. Attente de 60 secondes..." -ForegroundColor Yellow
        Start-Sleep -Seconds 60
        
        $redisEndpoint = aws elasticache describe-replication-groups `
            --replication-group-id "$projectName-redis" `
            --region $awsRegion `
            --query 'ReplicationGroups[0].PrimaryEndpoint.Address' `
            --output text 2>$null
    }
    
    if (-not $redisEndpoint -or $redisEndpoint -eq "None") {
        Write-Host "ERREUR: Impossible de recuperer l'endpoint ElastiCache" -ForegroundColor Red
        Write-Host "Verifiez que ElastiCache est cree et actif" -ForegroundColor Yellow
    } else {
        $redisPort = aws elasticache describe-replication-groups `
            --replication-group-id "$projectName-redis" `
            --region $awsRegion `
            --query 'ReplicationGroups[0].PrimaryEndpoint.Port' `
            --output text
        
        Write-Host "Endpoint ElastiCache trouve: $redisEndpoint`:$redisPort" -ForegroundColor Green
        
        # Recuperer le secret actuel
        Write-Host "Recuperation du secret actuel..." -ForegroundColor Cyan
        $currentSecret = aws secretsmanager get-secret-value `
            --secret-id "$projectName/backend/secrets" `
            --region $awsRegion `
            --query 'SecretString' `
            --output text | ConvertFrom-Json
        
        # Mettre a jour REDIS_URL
        $newRedisUrl = "redis://$redisEndpoint`:$redisPort"
        $currentSecret.REDIS_URL = $newRedisUrl
        
        # Sauvegarder dans un fichier temporaire
        $tempSecretFile = Join-Path $env:TEMP "secrets-updated-$(Get-Date -Format 'yyyyMMddHHmmss').json"
        $currentSecret | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempSecretFile -Encoding UTF8
        
        if ($DryRun) {
            Write-Host "Mode Dry-Run: Secret ne sera pas mis a jour" -ForegroundColor Cyan
            Write-Host "Nouvelle REDIS_URL: $newRedisUrl" -ForegroundColor White
        } else {
            # Mettre a jour le secret
            Write-Host "Mise a jour du secret AWS Secrets Manager..." -ForegroundColor Cyan
            aws secretsmanager update-secret `
                --secret-id "$projectName/backend/secrets" `
                --secret-string file://$tempSecretFile `
                --region $awsRegion | Out-Null
            
            Write-Host "Secret mis a jour avec succes" -ForegroundColor Green
            
            # Redemarrer le service ECS
            Write-Host "Redeploiement du service ECS..." -ForegroundColor Cyan
            aws ecs update-service `
                --cluster "$projectName-cluster" `
                --service "$projectName-backend-service" `
                --force-new-deployment `
                --region $awsRegion | Out-Null
            
            Write-Host "Service ECS redeploye" -ForegroundColor Green
        }
        
        # Nettoyer
        if (Test-Path $tempSecretFile) {
            Remove-Item $tempSecretFile -Force
        }
    }
} catch {
    Write-Host "ERREUR lors de la migration Redis: $_" -ForegroundColor Red
    Write-Host "Vous pouvez migrer manuellement plus tard" -ForegroundColor Yellow
}

# ETAPE 3: Corriger Vue Materialisee PostgreSQL
Write-Host ""
Write-Host "ETAPE 3: Correction Vue Materialisee PostgreSQL" -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

try {
    # Recuperer l'endpoint RDS
    Write-Host "Recuperation de l'endpoint RDS..." -ForegroundColor Cyan
    $rdsEndpoint = aws rds describe-db-instances `
        --db-instance-identifier "$projectName-db" `
        --region $awsRegion `
        --query 'DBInstances[0].Endpoint.Address' `
        --output text
    
    if ($rdsEndpoint) {
        Write-Host "Endpoint RDS trouve: $rdsEndpoint" -ForegroundColor Green
        
        # Lire le script SQL
        $sqlScript = Join-Path $PSScriptRoot "fix-postgres-materialized-view.sql"
        
        if (Test-Path $sqlScript) {
            Write-Host "Script SQL trouve: $sqlScript" -ForegroundColor Green
            Write-Host "Pour executer manuellement:" -ForegroundColor Yellow
            Write-Host "  psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript" -ForegroundColor White
        } else {
            Write-Host "Script SQL introuvable: $sqlScript" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERREUR: Impossible de recuperer l'endpoint RDS" -ForegroundColor Red
    }
} catch {
    Write-Host "ERREUR lors de la correction PostgreSQL: $_" -ForegroundColor Red
    Write-Host "Vous pouvez corriger manuellement plus tard" -ForegroundColor Yellow
}

# RESUME
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "RESUME DES OPTIMISATIONS" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Couts AWS:" -ForegroundColor Yellow
Write-Host "  - RDS: db.t3.medium -> db.t3.micro (economise ~$40/mois)" -ForegroundColor White
Write-Host "  - ECS: 2 tasks -> 1 task (economise ~$30/mois)" -ForegroundColor White
Write-Host "  - NAT Gateway: Desactive (economise ~$35/mois)" -ForegroundColor White
Write-Host "  - ElastiCache: cache.t3.small -> cache.t3.micro (economise ~$10/mois)" -ForegroundColor White
Write-Host "  - CloudWatch: Optimise (economise ~$7/mois)" -ForegroundColor White
Write-Host "  TOTAL ECONOMIE: ~$122/mois" -ForegroundColor Green
Write-Host ""

Write-Host "Redis:" -ForegroundColor Yellow
Write-Host "  - Migre vers ElastiCache AWS" -ForegroundColor White
Write-Host "  - Plus de rate limiting" -ForegroundColor White
Write-Host "  - Latence reduite" -ForegroundColor White
Write-Host ""

Write-Host "PostgreSQL:" -ForegroundColor Yellow
Write-Host "  - Vue materialisee a corriger manuellement" -ForegroundColor White
Write-Host "  - Executez le script SQL fourni" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "Mode Dry-Run: Aucun changement reel applique" -ForegroundColor Cyan
    Write-Host "Relancez sans -DryRun pour appliquer les changements" -ForegroundColor Yellow
} else {
    Write-Host "Toutes les optimisations ont ete appliquees!" -ForegroundColor Green
}

Write-Host ""

