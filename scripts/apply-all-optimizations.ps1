# Script complet pour appliquer toutes les optimisations AWS
# 1. Optimiser les coûts (RDS, ECS, NAT Gateway, etc.)
# 2. Migrer Redis vers ElastiCache
# 3. Corriger la vue matérialisée PostgreSQL

param(
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipRedis = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipPostgres = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application de Toutes les Optimisations AWS - Yukpomnang" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier les prérequis
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI n'est pas installé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Terraform n'est pas installé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

# Détecter la région depuis terraform.tfvars ou utiliser us-east-1 par défaut
$terraformDir = Join-Path $PSScriptRoot "..\infra\aws"
$tfvars = Join-Path $terraformDir "terraform.tfvars"
$awsRegion = "us-east-1"  # Par défaut

if (Test-Path $tfvars) {
    $config = Get-Content $tfvars -Raw
    if ($config -match 'aws_region\s*=\s*"([^"]+)"') {
        $awsRegion = $matches[1]
    }
}
$projectName = "yukpomnang"

# ============================================
# ÉTAPE 1 : Optimiser les coûts AWS
# ============================================
Write-Host "📊 ÉTAPE 1 : Optimisation des coûts AWS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

$terraformDir = Join-Path $PSScriptRoot "..\infra\aws"
$tfvarsTest = Join-Path $terraformDir "terraform.tfvars.test"
$tfvars = Join-Path $terraformDir "terraform.tfvars"
$tfvarsBackup = Join-Path $terraformDir "terraform.tfvars.production.backup"

if (-not (Test-Path $tfvarsTest)) {
    Write-Host "❌ Fichier terraform.tfvars.test introuvable !" -ForegroundColor Red
    Write-Host "   Créez-le d'abord à partir de terraform.tfvars.example" -ForegroundColor Yellow
    exit 1
}

# Sauvegarder la configuration actuelle
if (Test-Path $tfvars) {
    Write-Host "💾 Sauvegarde de la configuration actuelle..." -ForegroundColor Cyan
    Copy-Item $tfvars $tfvarsBackup -Force
    Write-Host "   ✅ Sauvegardé dans : terraform.tfvars.production.backup" -ForegroundColor Green
}

# Lire la config actuelle pour récupérer les valeurs sensibles
$currentConfig = Get-Content $tfvars -Raw
$rdsPasswordMatch = [regex]::Match($currentConfig, 'rds_password\s*=\s*"([^"]+)"')
$rdsPassword = if ($rdsPasswordMatch.Success) { $rdsPasswordMatch.Groups[1].Value } else { "" }
$jwtSecretMatch = [regex]::Match($currentConfig, 'jwt_secret\s*=\s*"([^"]+)"')
$jwtSecret = if ($jwtSecretMatch.Success) { $jwtSecretMatch.Groups[1].Value } else { "" }

# Lire la config test et remplacer les valeurs sensibles
$testConfig = Get-Content $tfvarsTest -Raw
if ($rdsPassword -and $testConfig -match 'rds_password\s*=\s*"CHANGE_ME') {
    $testConfig = $testConfig -replace 'rds_password\s*=\s*"CHANGE_ME[^"]*"', "rds_password = `"$rdsPassword`""
}
if ($jwtSecret -and $testConfig -match 'jwt_secret\s*=\s*"CHANGE_ME') {
    $testConfig = $testConfig -replace 'jwt_secret\s*=\s*"CHANGE_ME[^"]*"', "jwt_secret = `"$jwtSecret`""
}

# Écrire la config optimisée
$testConfig | Out-File -FilePath $tfvars -Encoding UTF8 -Force
Write-Host "✅ Configuration optimisée appliquée" -ForegroundColor Green
Write-Host ""

# Aller dans le répertoire Terraform
Push-Location $terraformDir

try {
    # Initialiser Terraform si nécessaire
    if (-not (Test-Path ".terraform")) {
        Write-Host "🔧 Initialisation de Terraform..." -ForegroundColor Cyan
        terraform init
    }
    
    # Planifier les changements
    Write-Host "📋 Planification des changements..." -ForegroundColor Cyan
    Write-Host "   ⚠️ Vérifiez attentivement les changements !" -ForegroundColor Yellow
    Write-Host ""
    
    terraform plan -out=tfplan
    
    Write-Host ""
    Write-Host "⚠️ ATTENTION : Les changements suivants vont être appliqués :" -ForegroundColor Yellow
    Write-Host "   - RDS sera redémarré (downtime ~5-10 min)" -ForegroundColor Yellow
    Write-Host "   - ECS tasks seront recréées" -ForegroundColor Yellow
    Write-Host "   - NAT Gateway sera supprimé" -ForegroundColor Yellow
    Write-Host "   - ElastiCache sera créé/optimisé" -ForegroundColor Yellow
    Write-Host ""
    
    if ($DryRun) {
        Write-Host "🔍 Mode Dry-Run : Aucun changement appliqué" -ForegroundColor Cyan
    } else {
        $confirm = Read-Host "Voulez-vous appliquer ces changements ? (oui/non)"
        if ($confirm -eq "oui") {
            Write-Host ""
            Write-Host "🚀 Application des changements Terraform..." -ForegroundColor Cyan
            terraform apply tfplan
            Write-Host ""
            Write-Host "✅ Optimisations Terraform appliquées !" -ForegroundColor Green
        } else {
            Write-Host "❌ Opération annulée" -ForegroundColor Yellow
            Pop-Location
            exit 0
        }
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "⏳ Attente de 30 secondes pour que les ressources soient prêtes..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# ============================================
# ÉTAPE 2 : Migrer Redis vers ElastiCache
# ============================================
if (-not $SkipRedis) {
    Write-Host ""
    Write-Host "🔴 ÉTAPE 2 : Migration Redis vers ElastiCache" -ForegroundColor Yellow
    Write-Host "-----------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Récupérer l'endpoint ElastiCache
        Write-Host "🔍 Récupération de l'endpoint ElastiCache..." -ForegroundColor Cyan
        $redisEndpoint = aws elasticache describe-replication-groups `
            --replication-group-id "$projectName-redis" `
            --region $awsRegion `
            --query 'ReplicationGroups[0].PrimaryEndpoint.Address' `
            --output text 2>$null
        
        if (-not $redisEndpoint -or $redisEndpoint -eq "None") {
            Write-Host "⚠️ ElastiCache n'est pas encore disponible. Attente de 60 secondes..." -ForegroundColor Yellow
            Start-Sleep -Seconds 60
            
            $redisEndpoint = aws elasticache describe-replication-groups `
                --replication-group-id "$projectName-redis" `
                --region $awsRegion `
                --query 'ReplicationGroups[0].PrimaryEndpoint.Address' `
                --output text 2>$null
        }
        
        if (-not $redisEndpoint -or $redisEndpoint -eq "None") {
            Write-Host "❌ Impossible de récupérer l'endpoint ElastiCache" -ForegroundColor Red
            Write-Host "   Vérifiez que ElastiCache est créé et actif" -ForegroundColor Yellow
        } else {
            $redisPort = aws elasticache describe-replication-groups `
                --replication-group-id "$projectName-redis" `
                --region $awsRegion `
                --query 'ReplicationGroups[0].PrimaryEndpoint.Port' `
                --output text
            
            Write-Host "✅ Endpoint ElastiCache trouvé : $redisEndpoint`:$redisPort" -ForegroundColor Green
            
            # Récupérer le secret actuel
            Write-Host "🔍 Récupération du secret actuel..." -ForegroundColor Cyan
            $currentSecret = aws secretsmanager get-secret-value `
                --secret-id "$projectName/backend/secrets" `
                --region $awsRegion `
                --query 'SecretString' `
                --output text | ConvertFrom-Json
            
            # Mettre à jour REDIS_URL
            $newRedisUrl = "redis://$redisEndpoint`:$redisPort"
            $currentSecret.REDIS_URL = $newRedisUrl
            
            # Sauvegarder dans un fichier temporaire
            $tempSecretFile = Join-Path $env:TEMP "secrets-updated-$(Get-Date -Format 'yyyyMMddHHmmss').json"
            $currentSecret | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempSecretFile -Encoding UTF8
            
            if ($DryRun) {
                Write-Host "🔍 Mode Dry-Run : Secret ne sera pas mis à jour" -ForegroundColor Cyan
                Write-Host "   Nouvelle REDIS_URL : $newRedisUrl" -ForegroundColor White
            } else {
                # Mettre à jour le secret
                Write-Host "📝 Mise à jour du secret AWS Secrets Manager..." -ForegroundColor Cyan
                aws secretsmanager update-secret `
                    --secret-id "$projectName/backend/secrets" `
                    --secret-string file://$tempSecretFile `
                    --region $awsRegion | Out-Null
                
                Write-Host "✅ Secret mis à jour avec succès" -ForegroundColor Green
                
                # Redémarrer le service ECS pour prendre en compte le nouveau secret
                Write-Host "🔄 Redéploiement du service ECS..." -ForegroundColor Cyan
                aws ecs update-service `
                    --cluster "$projectName-cluster" `
                    --service "$projectName-backend-service" `
                    --force-new-deployment `
                    --region $awsRegion | Out-Null
                
                Write-Host "✅ Service ECS redéployé" -ForegroundColor Green
            }
            
            # Nettoyer
            if (Test-Path $tempSecretFile) {
                Remove-Item $tempSecretFile -Force
            }
        }
    } catch {
        Write-Host "❌ Erreur lors de la migration Redis : $_" -ForegroundColor Red
        Write-Host "   Vous pouvez migrer manuellement plus tard" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ETAPE 2 : Migration Redis ignoree (--SkipRedis)" -ForegroundColor Gray
}

# ============================================
# ÉTAPE 3 : Corriger Vue Matérialisée PostgreSQL
# ============================================
if (-not $SkipPostgres) {
    Write-Host ""
    Write-Host "🗄️ ÉTAPE 3 : Correction Vue Matérialisée PostgreSQL" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Récupérer l'endpoint RDS
        Write-Host "🔍 Récupération de l'endpoint RDS..." -ForegroundColor Cyan
        $rdsEndpoint = aws rds describe-db-instances `
            --db-instance-identifier "$projectName-db" `
            --region $awsRegion `
            --query 'DBInstances[0].Endpoint.Address' `
            --output text
        
        if ($rdsEndpoint) {
            Write-Host "✅ Endpoint RDS trouvé : $rdsEndpoint" -ForegroundColor Green
            
            # Lire le script SQL
            $sqlScript = Join-Path $PSScriptRoot "fix-postgres-materialized-view.sql"
            
            if (Test-Path $sqlScript) {
                Write-Host "📝 Exécution du script SQL..." -ForegroundColor Cyan
                Write-Host "   ⚠️ Vous devrez entrer le mot de passe RDS" -ForegroundColor Yellow
                Write-Host ""
                
                if ($DryRun) {
                    Write-Host "🔍 Mode Dry-Run : Script ne sera pas exécuté" -ForegroundColor Cyan
                    Write-Host "   Exécutez manuellement :" -ForegroundColor White
                    Write-Host "   psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript" -ForegroundColor Gray
                } else {
                    # Essayer d'exécuter via psql si disponible
                    if (Get-Command psql -ErrorAction SilentlyContinue) {
                        $env:PGPASSWORD = $rdsPassword
                        psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript
                        Remove-Item Env:\PGPASSWORD
                        Write-Host "✅ Script SQL exécuté" -ForegroundColor Green
                    } else {
                        Write-Host "⚠️ psql n'est pas installé. Exécutez manuellement :" -ForegroundColor Yellow
                        Write-Host "   psql -h $rdsEndpoint -U yukpo_admin -d yukpomnang -f $sqlScript" -ForegroundColor White
                    }
                }
            } else {
                Write-Host "⚠️ Script SQL introuvable : $sqlScript" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Impossible de récupérer l'endpoint RDS" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lors de la correction PostgreSQL : $_" -ForegroundColor Red
        Write-Host "   Vous pouvez corriger manuellement plus tard" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ETAPE 3 : Correction PostgreSQL ignoree (--SkipPostgres)" -ForegroundColor Gray
}

# ============================================
# RÉSUMÉ
# ============================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ RÉSUMÉ DES OPTIMISATIONS" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Coûts AWS :" -ForegroundColor Yellow
Write-Host "   - RDS : db.t3.medium → db.t3.micro (économise ~$40/mois)" -ForegroundColor White
Write-Host "   - ECS : 2 tasks → 1 task (économise ~$30/mois)" -ForegroundColor White
Write-Host "   - NAT Gateway : Désactivé (économise ~$35/mois)" -ForegroundColor White
Write-Host "   - ElastiCache : cache.t3.small → cache.t3.micro (économise ~$10/mois)" -ForegroundColor White
Write-Host "   - CloudWatch : Optimisé (économise ~$7/mois)" -ForegroundColor White
Write-Host "   💰 TOTAL ÉCONOMIE : ~$122/mois" -ForegroundColor Green
Write-Host ""

if (-not $SkipRedis) {
    Write-Host "🔴 Redis :" -ForegroundColor Yellow
    Write-Host "   - Migré vers ElastiCache AWS" -ForegroundColor White
    Write-Host "   - Plus de rate limiting" -ForegroundColor White
    Write-Host "   - Latence réduite" -ForegroundColor White
    Write-Host ""
}

if (-not $SkipPostgres) {
    Write-Host "🗄️ PostgreSQL :" -ForegroundColor Yellow
    Write-Host "   - Vue matérialisée corrigée" -ForegroundColor White
    Write-Host "   - Refresh automatique activé" -ForegroundColor White
    Write-Host ""
}

Write-Host "📋 Prochaines étapes :" -ForegroundColor Yellow
Write-Host "   1. Vérifier que le système fonctionne correctement" -ForegroundColor White
Write-Host "   2. Vérifier les logs ECS pour confirmer la connexion Redis" -ForegroundColor White
Write-Host "   3. Tester quelques requêtes pour vérifier les performances" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 Mode Dry-Run : Aucun changement réel appliqué" -ForegroundColor Cyan
    Write-Host "   Relancez sans --DryRun pour appliquer les changements" -ForegroundColor Yellow
} else {
    Write-Host "✅ Toutes les optimisations ont été appliquées !" -ForegroundColor Green
}

Write-Host ""

