# Script pour verifier les Security Groups de l'ALB
# Usage: .\scripts\verify-security-groups-fixed.ps1

Write-Host "Verification des Security Groups de l'ALB..." -ForegroundColor Cyan

# Variables
$ALB_DNS = "yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
$REGION = "us-east-1"

Write-Host "Parametres:" -ForegroundColor Yellow
Write-Host "  ALB DNS: $ALB_DNS"
Write-Host "  Region: $REGION"
Write-Host ""

# Verifier que AWS CLI est installe
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n est pas installe. Veuillez l installer d abord." -ForegroundColor Red
    Write-Host "   Telechargement: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Verifier que AWS CLI est configure
Write-Host "Verification de la configuration AWS CLI..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: AWS CLI n est pas configure. Veuillez executer 'aws configure' d abord." -ForegroundColor Red
    exit 1
}
Write-Host "OK: AWS CLI configure" -ForegroundColor Green
Write-Host ""

# Trouver l'ALB
Write-Host "Recherche de l'ALB..." -ForegroundColor Cyan
$albName = $ALB_DNS.Split('.')[0]
$albs = aws elbv2 describe-load-balancers `
    --region $REGION `
    --query "LoadBalancers[?contains(DNSName, '$albName')]" `
    --output json | ConvertFrom-Json

if ($albs.Count -eq 0) {
    Write-Host "ERREUR: ALB non trouve avec le DNS: $ALB_DNS" -ForegroundColor Red
    Write-Host "   Verifiez que l'ALB existe et que le DNS est correct." -ForegroundColor Yellow
    exit 1
}

$alb = $albs[0]
Write-Host "OK: ALB trouve: $($alb.LoadBalancerName)" -ForegroundColor Green
Write-Host "   ARN: $($alb.LoadBalancerArn)"
Write-Host "   DNS: $($alb.DNSName)"
Write-Host ""

# Recuperer les Security Groups de l'ALB
Write-Host "Recuperation des Security Groups..." -ForegroundColor Cyan
$securityGroupIds = $alb.SecurityGroups

if ($securityGroupIds.Count -eq 0) {
    Write-Host "ERREUR: Aucun Security Group associe a l'ALB." -ForegroundColor Red
    exit 1
}

Write-Host "Security Groups associes:" -ForegroundColor Yellow
foreach ($sgId in $securityGroupIds) {
    Write-Host "  - $sgId"
}
Write-Host ""

# Verifier chaque Security Group
$allCorrect = $true
foreach ($sgId in $securityGroupIds) {
    Write-Host "Verification du Security Group: $sgId" -ForegroundColor Cyan
    
    $sg = aws ec2 describe-security-groups `
        --group-ids $sgId `
        --region $REGION `
        --output json | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERREUR: Erreur lors de la recuperation du Security Group." -ForegroundColor Red
        $allCorrect = $false
        continue
    }
    
    $sgDetails = $sg.SecurityGroups[0]
    Write-Host "  Nom: $($sgDetails.GroupName)"
    Write-Host "  Description: $($sgDetails.Description)"
    Write-Host ""
    
    # Verifier les regles entrantes
    Write-Host "  Regles entrantes:" -ForegroundColor Yellow
    $hasHttps = $false
    $hasHttp = $false
    
    foreach ($rule in $sgDetails.IpPermissions) {
        $port = $rule.FromPort
        $protocol = $rule.IpProtocol
        
        if ($protocol -eq "tcp") {
            if ($port -eq 443) {
                $hasHttps = $true
                Write-Host "    OK: HTTPS (443) autorise" -ForegroundColor Green
                foreach ($ipRange in $rule.IpRanges) {
                    Write-Host "       Source: $($ipRange.CidrIp)" -ForegroundColor Gray
                }
            } elseif ($port -eq 80) {
                $hasHttp = $true
                Write-Host "    OK: HTTP (80) autorise" -ForegroundColor Green
                foreach ($ipRange in $rule.IpRanges) {
                    Write-Host "       Source: $($ipRange.CidrIp)" -ForegroundColor Gray
                }
            }
        }
    }
    
    if (-not $hasHttps) {
        Write-Host "    ERREUR: HTTPS (443) NON autorise" -ForegroundColor Red
        Write-Host "       ACTION REQUISE: Ajouter une regle pour autoriser HTTPS (443) depuis 0.0.0.0/0" -ForegroundColor Yellow
        $allCorrect = $false
    }
    
    if (-not $hasHttp) {
        Write-Host "    ATTENTION: HTTP (80) NON autorise (optionnel, pour redirection HTTPS)" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Resume
Write-Host "Resume:" -ForegroundColor Cyan
if ($allCorrect) {
    Write-Host "  OK: Tous les Security Groups sont correctement configures!" -ForegroundColor Green
} else {
    Write-Host "  ATTENTION: Certains Security Groups necessitent une configuration." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour ajouter HTTPS (443) manuellement:" -ForegroundColor Cyan
    Write-Host "   aws ec2 authorize-security-group-ingress \" -ForegroundColor Gray
    Write-Host "     --group-id <SECURITY_GROUP_ID> \" -ForegroundColor Gray
    Write-Host "     --protocol tcp \" -ForegroundColor Gray
    Write-Host "     --port 443 \" -ForegroundColor Gray
    Write-Host "     --cidr 0.0.0.0/0 \" -ForegroundColor Gray
    Write-Host "     --region $REGION" -ForegroundColor Gray
}




