# Script d'optimisation des coûts AWS pour Yukpomnang
# Réduit les coûts de ~60% en passant à une configuration test/dev

param(
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckCosts = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$ApplyOptimizations = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Script d'Optimisation des Coûts AWS - Yukpomnang" -ForegroundColor Cyan
Write-Host ""

# Vérifier que AWS CLI est installé
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI n'est pas installé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier que Terraform est installé
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Terraform n'est pas installé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

# Fonction pour vérifier les coûts
function Check-AWSCosts {
    Write-Host "📊 Vérification des coûts AWS..." -ForegroundColor Yellow
    
    $startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    
    try {
        $costs = aws ce get-cost-and-usage `
            --time-period Start=$startDate,End=$endDate `
            --granularity DAILY `
            --metrics BlendedCost `
            --group-by Type=DIMENSION,Key=SERVICE `
            --region eu-west-1 `
            --output json | ConvertFrom-Json
        
        Write-Host "✅ Coûts des 7 derniers jours :" -ForegroundColor Green
        Write-Host ""
        
        $totalCost = 0
        foreach ($result in $costs.ResultsByTime) {
            foreach ($group in $result.Groups) {
                $service = $group.Keys[0]
                $amount = [decimal]$group.Metrics.BlendedCost.Amount
                $totalCost += $amount
                
                if ($amount -gt 0) {
                    Write-Host "  $service : $($amount.ToString('F2')) USD" -ForegroundColor White
                }
            }
        }
        
        Write-Host ""
        Write-Host "💰 Total (7 jours) : $($totalCost.ToString('F2')) USD" -ForegroundColor Cyan
        Write-Host "💰 Estimation mensuelle : $(([decimal]$totalCost * 30 / 7).ToString('F2')) USD" -ForegroundColor Cyan
        
    } catch {
        Write-Host "⚠️ Impossible de récupérer les coûts. Vérifiez vos permissions AWS." -ForegroundColor Yellow
        Write-Host "   Erreur : $_" -ForegroundColor Gray
    }
}

# Fonction pour vérifier l'état actuel
function Check-CurrentState {
    Write-Host "🔍 Vérification de l'état actuel de l'infrastructure..." -ForegroundColor Yellow
    Write-Host ""
    
    # Vérifier RDS
    try {
        $rds = aws rds describe-db-instances `
            --db-instance-identifier yukpomnang-db `
            --region eu-west-1 `
            --query 'DBInstances[0].[DBInstanceStatus,DBInstanceClass,AllocatedStorage]' `
            --output json | ConvertFrom-Json
        
        Write-Host "📊 RDS PostgreSQL :" -ForegroundColor Cyan
        Write-Host "   Statut : $($rds[0])" -ForegroundColor White
        Write-Host "   Instance : $($rds[1])" -ForegroundColor White
        Write-Host "   Storage : $($rds[2]) GB" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "⚠️ Impossible de récupérer les infos RDS" -ForegroundColor Yellow
    }
    
    # Vérifier ECS
    try {
        $ecs = aws ecs describe-services `
            --cluster yukpomnang-cluster `
            --services yukpomnang-backend-service `
            --region eu-west-1 `
            --query 'services[0].[status,runningCount,desiredCount]' `
            --output json | ConvertFrom-Json
        
        Write-Host "📊 ECS Service :" -ForegroundColor Cyan
        Write-Host "   Statut : $($ecs[0])" -ForegroundColor White
        Write-Host "   Tasks running : $($ecs[1])" -ForegroundColor White
        Write-Host "   Tasks desired : $($ecs[2])" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "⚠️ Impossible de récupérer les infos ECS" -ForegroundColor Yellow
    }
    
    # Vérifier NAT Gateway
    try {
        $nat = aws ec2 describe-nat-gateways `
            --region eu-west-1 `
            --filter "Name=tag:Name,Values=yukpomnang-nat-gateway" `
            --query 'NatGateways[0].[State,NatGatewayId]' `
            --output json | ConvertFrom-Json
        
        if ($nat) {
            Write-Host "📊 NAT Gateway :" -ForegroundColor Cyan
            Write-Host "   Statut : $($nat[0])" -ForegroundColor White
            Write-Host "   ID : $($nat[1])" -ForegroundColor White
            Write-Host "   ⚠️ Coût : ~$35-45/mois" -ForegroundColor Yellow
            Write-Host ""
        }
    } catch {
        Write-Host "⚠️ Impossible de récupérer les infos NAT Gateway" -ForegroundColor Yellow
    }
}

# Fonction pour appliquer les optimisations
function Apply-Optimizations {
    Write-Host "🔧 Application des optimisations..." -ForegroundColor Yellow
    Write-Host ""
    
    $terraformDir = Join-Path $PSScriptRoot "..\infra\aws"
    $tfvarsTest = Join-Path $terraformDir "terraform.tfvars.test"
    $tfvars = Join-Path $terraformDir "terraform.tfvars"
    $tfvarsBackup = Join-Path $terraformDir "terraform.tfvars.production.backup"
    
    # Vérifier que le fichier test existe
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
    
    # Copier la configuration test
    Write-Host "📝 Application de la configuration optimisée..." -ForegroundColor Cyan
    Copy-Item $tfvarsTest $tfvars -Force
    Write-Host "   ✅ Configuration test appliquée" -ForegroundColor Green
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
        Write-Host ""
        Write-Host "📋 Planification des changements..." -ForegroundColor Cyan
        Write-Host "   ⚠️ Vérifiez attentivement les changements avant d'appliquer !" -ForegroundColor Yellow
        Write-Host ""
        
        terraform plan -out=tfplan
        
        Write-Host ""
        Write-Host "⚠️ ATTENTION : Les changements suivants vont être appliqués :" -ForegroundColor Yellow
        Write-Host "   - RDS sera redémarré (downtime ~5-10 min)" -ForegroundColor Yellow
        Write-Host "   - ECS tasks seront recréées" -ForegroundColor Yellow
        Write-Host "   - NAT Gateway sera supprimé" -ForegroundColor Yellow
        Write-Host ""
        
        if ($DryRun) {
            Write-Host "🔍 Mode Dry-Run : Aucun changement appliqué" -ForegroundColor Cyan
            Write-Host "   Pour appliquer réellement, relancez avec -ApplyOptimizations" -ForegroundColor Yellow
        } else {
            $confirm = Read-Host "Voulez-vous appliquer ces changements ? (oui/non)"
            if ($confirm -eq "oui") {
                Write-Host ""
                Write-Host "🚀 Application des changements..." -ForegroundColor Cyan
                terraform apply tfplan
                Write-Host ""
                Write-Host "✅ Optimisations appliquées avec succès !" -ForegroundColor Green
                Write-Host "   💰 Économie estimée : ~$100-135/mois" -ForegroundColor Cyan
            } else {
                Write-Host "❌ Opération annulée" -ForegroundColor Yellow
            }
        }
    } finally {
        Pop-Location
    }
}

# Menu principal
if ($CheckCosts) {
    Check-AWSCosts
    exit 0
}

if ($ApplyOptimizations) {
    Check-CurrentState
    Write-Host ""
    Apply-Optimizations
    exit 0
}

# Menu interactif
Write-Host "Que voulez-vous faire ?" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Vérifier les coûts AWS (7 derniers jours)"
Write-Host "2. Vérifier l'état actuel de l'infrastructure"
Write-Host "3. Appliquer les optimisations (réduire coûts)"
Write-Host "4. Tout faire (vérifier + optimiser)"
Write-Host ""
$choice = Read-Host "Votre choix (1-4)"

switch ($choice) {
    "1" {
        Check-AWSCosts
    }
    "2" {
        Check-CurrentState
    }
    "3" {
        Check-CurrentState
        Write-Host ""
        Apply-Optimizations
    }
    "4" {
        Check-AWSCosts
        Write-Host ""
        Check-CurrentState
        Write-Host ""
        Apply-Optimizations
    }
    default {
        Write-Host "❌ Choix invalide" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Terminé !" -ForegroundColor Green

