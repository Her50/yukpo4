# Script pour vérifier le statut du certificat et ajouter le listener HTTPS une fois validé
# Usage: .\scripts\check-certificate-and-add-listener.ps1 [CERTIFICATE_ARN]

param(
    [string]$CertificateArn = "arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7"
)

Write-Host "=== VERIFICATION CERTIFICAT ET AJOUT LISTENER HTTPS ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier le statut du certificat
Write-Host "Vérification du statut du certificat..." -ForegroundColor Yellow
$certDetails = aws acm describe-certificate `
    --certificate-arn $CertificateArn `
    --region us-east-1 `
    --output json | ConvertFrom-Json

$status = $certDetails.Certificate.Status
Write-Host "Status: $status" -ForegroundColor $(if ($status -eq "ISSUED") { "Green" } else { "Yellow" })

if ($status -eq "ISSUED") {
    Write-Host "✅ Certificat valide!" -ForegroundColor Green
    Write-Host ""
    
    # Ajouter le listener HTTPS
    Write-Host "Ajout du listener HTTPS..." -ForegroundColor Cyan
    & "$PSScriptRoot\add-https-listener-alb-auto.ps1" -CertificateArn $CertificateArn
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Configuration terminée!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Le backend est maintenant accessible via:" -ForegroundColor Cyan
        Write-Host "  - HTTPS: https://api.yukpomnang.com" -ForegroundColor White
        Write-Host "  - HTTP: http://api.yukpomnang.com (redirection vers HTTPS)" -ForegroundColor White
        Write-Host ""
        Write-Host "Test:" -ForegroundColor Cyan
        Write-Host "  curl -v https://api.yukpomnang.com/health" -ForegroundColor Gray
    }
} elseif ($status -eq "PENDING_VALIDATION") {
    Write-Host "⏳ Certificat en attente de validation..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Vérifiez que les enregistrements DNS ont été ajoutés:" -ForegroundColor Yellow
    Write-Host "  1. CNAME: api.yukpomnang.com -> yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com" -ForegroundColor White
    Write-Host "  2. CNAME: _07560c403145510b496c9b8313c6c600.api.yukpomnang.com -> _91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws." -ForegroundColor White
    Write-Host ""
    Write-Host "Voir ENREGISTREMENTS_DNS_A_CREER.md pour plus de détails." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Relancez ce script dans quelques minutes:" -ForegroundColor Yellow
    Write-Host "  .\scripts\check-certificate-and-add-listener.ps1" -ForegroundColor Gray
} else {
    Write-Host "❌ Erreur: Statut du certificat: $status" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifiez les enregistrements DNS et réessayez." -ForegroundColor Yellow
    exit 1
}

