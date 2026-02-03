# Script pour vérifier les Security Groups de l'ALB
# Usage: .\scripts\verify-security-groups.ps1

Write-Host "🔍 Vérification des Security Groups de l'ALB..." -ForegroundColor Cyan

# Variables
$ALB_DNS = "yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
$REGION = "us-east-1"

Write-Host "📋 Paramètres:" -ForegroundColor Yellow
Write-Host "  ALB DNS: $ALB_DNS"
Write-Host "  Region: $REGION"
Write-Host ""

# Vérifier que AWS CLI est installé
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI n'est pas installé. Veuillez l'installer d'abord." -ForegroundColor Red
    Write-Host "   Téléchargement: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Vérifier que AWS CLI est configuré
Write-Host "🔍 Vérification de la configuration AWS CLI..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS CLI n'est pas configuré. Veuillez exécuter 'aws configure' d'abord." -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS CLI configuré" -ForegroundColor Green
Write-Host ""

# Trouver l'ALB
Write-Host "🔍 Recherche de l'ALB..." -ForegroundColor Cyan
$albName = $ALB_DNS.Split('.')[0]
$albs = aws elbv2 describe-load-balancers `
    --region $REGION `
    --query "LoadBalancers[?contains(DNSName, '$albName')]" `
    --output json | ConvertFrom-Json

if ($albs.Count -eq 0) {
    Write-Host "❌ ALB non trouvé avec le DNS: $ALB_DNS" -ForegroundColor Red
    Write-Host "   Vérifiez que l'ALB existe et que le DNS est correct." -ForegroundColor Yellow
    exit 1
}

$alb = $albs[0]
Write-Host "✅ ALB trouvé: $($alb.LoadBalancerName)" -ForegroundColor Green
Write-Host "   ARN: $($alb.LoadBalancerArn)"
Write-Host "   DNS: $($alb.DNSName)"
Write-Host ""

# Récupérer les Security Groups de l'ALB
Write-Host "🔍 Récupération des Security Groups..." -ForegroundColor Cyan
$securityGroupIds = $alb.SecurityGroups

if ($securityGroupIds.Count -eq 0) {
    Write-Host "❌ Aucun Security Group associé à l'ALB." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Security Groups associés:" -ForegroundColor Yellow
foreach ($sgId in $securityGroupIds) {
    Write-Host "  - $sgId"
}
Write-Host ""

# Vérifier chaque Security Group
$allCorrect = $true
foreach ($sgId in $securityGroupIds) {
    Write-Host "🔍 Vérification du Security Group: $sgId" -ForegroundColor Cyan
    
    $sg = aws ec2 describe-security-groups `
        --group-ids $sgId `
        --region $REGION `
        --output json | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de la récupération du Security Group." -ForegroundColor Red
        $allCorrect = $false
        continue
    }
    
    $sgDetails = $sg.SecurityGroups[0]
    Write-Host "  Nom: $($sgDetails.GroupName)"
    Write-Host "  Description: $($sgDetails.Description)"
    Write-Host ""
    
    # Vérifier les règles entrantes
    Write-Host "  📥 Règles entrantes:" -ForegroundColor Yellow
    $hasHttps = $false
    $hasHttp = $false
    
    foreach ($rule in $sgDetails.IpPermissions) {
        $port = $rule.FromPort
        $protocol = $rule.IpProtocol
        
        if ($protocol -eq "tcp") {
            if ($port -eq 443) {
                $hasHttps = $true
                Write-Host "    ✅ HTTPS (443) autorisé" -ForegroundColor Green
                foreach ($ipRange in $rule.IpRanges) {
                    Write-Host "       Source: $($ipRange.CidrIp)" -ForegroundColor Gray
                }
            } elseif ($port -eq 80) {
                $hasHttp = $true
                Write-Host "    ✅ HTTP (80) autorisé" -ForegroundColor Green
                foreach ($ipRange in $rule.IpRanges) {
                    Write-Host "       Source: $($ipRange.CidrIp)" -ForegroundColor Gray
                }
            }
        }
    }
    
    if (-not $hasHttps) {
        Write-Host "    ❌ HTTPS (443) NON autorisé" -ForegroundColor Red
        Write-Host "       ⚠️  Action requise: Ajouter une règle pour autoriser HTTPS (443) depuis 0.0.0.0/0" -ForegroundColor Yellow
        $allCorrect = $false
    }
    
    if (-not $hasHttp) {
        Write-Host "    ATTENTION: HTTP (80) NON autorise (optionnel, pour redirection HTTPS)" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Résumé
Write-Host "📊 Résumé:" -ForegroundColor Cyan
if ($allCorrect) {
    Write-Host "  ✅ Tous les Security Groups sont correctement configurés!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Certains Security Groups nécessitent une configuration." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Pour ajouter HTTPS (443) manuellement:" -ForegroundColor Cyan
    Write-Host "   aws ec2 authorize-security-group-ingress \`" -ForegroundColor Gray
    Write-Host "     --group-id <SECURITY_GROUP_ID> \`" -ForegroundColor Gray
    Write-Host "     --protocol tcp \`" -ForegroundColor Gray
    Write-Host "     --port 443 \`" -ForegroundColor Gray
    Write-Host "     --cidr 0.0.0.0/0 \`" -ForegroundColor Gray
    Write-Host "     --region $REGION" -ForegroundColor Gray
}

