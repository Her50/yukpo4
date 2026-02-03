# Script pour ajouter un listener HTTPS (443) sur l'ALB (version automatique)
# Usage: .\scripts\add-https-listener-alb-auto.ps1 [CERTIFICATE_ARN]

param(
    [string]$CertificateArn = ""
)

Write-Host "Ajout listener HTTPS (443) sur ALB..." -ForegroundColor Cyan

# Variables
$ALB_DNS = "yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
$REGION = "us-east-1"

Write-Host "Parametres:" -ForegroundColor Yellow
Write-Host "  ALB DNS: $ALB_DNS"
Write-Host "  Region: $REGION"
if ($CertificateArn) {
    Write-Host "  Certificate ARN: $CertificateArn"
}
Write-Host ""

# Verifier AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n est pas installe." -ForegroundColor Red
    exit 1
}

# Trouver l'ALB
Write-Host "Recherche de l'ALB..." -ForegroundColor Cyan
$albArn = aws elbv2 describe-load-balancers `
    --region $REGION `
    --query "LoadBalancers[?contains(DNSName, 'yukpomnang-backend-alb')].LoadBalancerArn" `
    --output text

if (-not $albArn) {
    Write-Host "ERREUR: ALB non trouve." -ForegroundColor Red
    exit 1
}

Write-Host "OK: ALB trouve: $albArn" -ForegroundColor Green
Write-Host ""

# Verifier si listener HTTPS existe deja
Write-Host "Verification des listeners existants..." -ForegroundColor Cyan
$existingListeners = aws elbv2 describe-listeners `
    --load-balancer-arn $albArn `
    --region $REGION `
    --query 'Listeners[*].{Port:Port,Protocol:Protocol}' `
    --output json | ConvertFrom-Json

$hasHttps = $false
foreach ($listener in $existingListeners) {
    if ($listener.Port -eq 443 -and $listener.Protocol -eq "HTTPS") {
        $hasHttps = $true
        Write-Host "OK: Listener HTTPS (443) existe deja!" -ForegroundColor Green
        exit 0
    }
}

# Recuperer le Target Group
Write-Host "Recuperation du Target Group..." -ForegroundColor Cyan
$targetGroupArn = aws elbv2 describe-target-groups `
    --load-balancer-arn $albArn `
    --region $REGION `
    --query 'TargetGroups[0].TargetGroupArn' `
    --output text

if (-not $targetGroupArn) {
    Write-Host "ERREUR: Target Group non trouve." -ForegroundColor Red
    exit 1
}

Write-Host "OK: Target Group: $targetGroupArn" -ForegroundColor Green
Write-Host ""

# Chercher un certificat ACM si non fourni
if (-not $CertificateArn) {
    Write-Host "Recherche d un certificat SSL/TLS dans ACM..." -ForegroundColor Cyan
    $certificates = aws acm list-certificates `
        --region $REGION `
        --query 'CertificateSummaryList[*].{Arn:CertificateArn,Domain:DomainName}' `
        --output json | ConvertFrom-Json

    if ($certificates.Count -eq 0) {
        Write-Host "ERREUR: Aucun certificat trouve dans ACM ($REGION)." -ForegroundColor Red
        Write-Host ""
        Write-Host "Vous devez creer un certificat SSL/TLS dans AWS Certificate Manager:" -ForegroundColor Yellow
        Write-Host "  1. AWS Console -> Certificate Manager" -ForegroundColor White
        Write-Host "  2. Request a certificate" -ForegroundColor White
        Write-Host "  3. Domain: *.elb.amazonaws.com ou votre domaine" -ForegroundColor White
        Write-Host "  4. Validation: DNS" -ForegroundColor White
        Write-Host ""
        Write-Host "OU utiliser un certificat existant:" -ForegroundColor Yellow
        Write-Host "  .\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <ARN>" -ForegroundColor Gray
        exit 1
    }

    # Utiliser le premier certificat trouve
    $CertificateArn = $certificates[0].Arn
    Write-Host "OK: Certificat selectionne: $CertificateArn" -ForegroundColor Green
} else {
    Write-Host "OK: Certificat fourni: $CertificateArn" -ForegroundColor Green
}

Write-Host ""

# Creer le listener HTTPS
Write-Host "Creation du listener HTTPS (443)..." -ForegroundColor Cyan
$listenerResult = aws elbv2 create-listener `
    --load-balancer-arn $albArn `
    --protocol HTTPS `
    --port 443 `
    --certificates CertificateArn=$CertificateArn `
    --default-actions Type=forward,TargetGroupArn=$targetGroupArn `
    --region $REGION `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de creer le listener HTTPS." -ForegroundColor Red
    Write-Host "Verifiez que le certificat existe et est valide." -ForegroundColor Yellow
    exit 1
}

$listener = $listenerResult | ConvertFrom-Json
Write-Host "OK: Listener HTTPS cree avec succes!" -ForegroundColor Green
Write-Host "  Listener ARN: $($listener.Listeners[0].ListenerArn)" -ForegroundColor White
Write-Host "  Port: 443" -ForegroundColor White
Write-Host "  Protocol: HTTPS" -ForegroundColor White
Write-Host "  Certificate: $CertificateArn" -ForegroundColor White
Write-Host ""
Write-Host "Le backend est maintenant accessible via HTTPS!" -ForegroundColor Green
Write-Host ""
Write-Host "Test:" -ForegroundColor Cyan
Write-Host "  curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health" -ForegroundColor Gray

