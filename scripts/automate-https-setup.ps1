# Script pour automatiser la configuration HTTPS complète
# Usage: .\scripts\automate-https-setup.ps1
# 
# Prérequis: Les enregistrements DNS doivent être ajoutés manuellement
# 1. CNAME: api.yukpomnang.com -> ALB
# 2. CNAME: validation ACM

param(
    [int]$WaitInterval = 30,  # Intervalle entre vérifications (secondes)
    [int]$MaxAttempts = 40     # Nombre max de tentatives (40 * 30s = 20 minutes)
)

Write-Host "=== AUTOMATISATION CONFIGURATION HTTPS ===" -ForegroundColor Cyan
Write-Host ""

# Variables
$certArn = "arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7"
$apiDomain = "api.yukpomnang.com"

# Étape 1: Vérifier que les enregistrements DNS sont ajoutés
Write-Host "Étape 1: Vérification des enregistrements DNS..." -ForegroundColor Yellow
$dnsCheck = Resolve-DnsName -Name $apiDomain -Type CNAME -ErrorAction SilentlyContinue
if ($dnsCheck) {
    Write-Host "✅ OK: $apiDomain pointe vers: $($dnsCheck.NameHost)" -ForegroundColor Green
} else {
    Write-Host "❌ ATTENTION: $apiDomain n'est pas encore résolvable" -ForegroundColor Red
    Write-Host "   Les enregistrements DNS doivent être ajoutés avant de continuer." -ForegroundColor Yellow
    Write-Host "   Voir ENREGISTREMENTS_DNS_A_CREER.md pour les détails." -ForegroundColor Cyan
    exit 1
}

# Étape 2: Attendre la validation du certificat
Write-Host ""
Write-Host "Étape 2: Attente de la validation du certificat..." -ForegroundColor Yellow
Write-Host "ARN: $certArn" -ForegroundColor Gray
Write-Host "Vérification toutes les $WaitInterval secondes (max $MaxAttempts tentatives)..." -ForegroundColor Cyan

$attempt = 0
$validated = $false
$status = ""

while ($attempt -lt $MaxAttempts -and -not $validated) {
    Start-Sleep -Seconds $WaitInterval
    $certDetails = aws acm describe-certificate --certificate-arn $certArn --region us-east-1 --output json | ConvertFrom-Json
    $status = $certDetails.Certificate.Status
    $attempt++
    
    $color = if ($status -eq "ISSUED") { "Green" } elseif ($status -eq "FAILED") { "Red" } else { "Yellow" }
    Write-Host "  [$attempt/$MaxAttempts] Status: $status" -ForegroundColor $color
    
    if ($status -eq "ISSUED") {
        $validated = $true
        Write-Host ""
        Write-Host "✅ Certificat validé avec succès!" -ForegroundColor Green
    } elseif ($status -eq "FAILED") {
        Write-Host ""
        Write-Host "❌ ERREUR: Le certificat a échoué la validation." -ForegroundColor Red
        Write-Host "   Vérifiez que les enregistrements DNS ont été ajoutés correctement." -ForegroundColor Yellow
        exit 1
    }
}

if (-not $validated) {
    Write-Host ""
    Write-Host "⚠️ ATTENTION: Le certificat n'est pas encore validé après $MaxAttempts tentatives." -ForegroundColor Yellow
    Write-Host "   La validation peut prendre jusqu'à 30 minutes." -ForegroundColor Yellow
    Write-Host "   Vous pouvez relancer ce script plus tard." -ForegroundColor Cyan
    exit 1
}

# Étape 3: Ajouter le listener HTTPS
Write-Host ""
Write-Host "Étape 3: Ajout du listener HTTPS..." -ForegroundColor Yellow
& "$PSScriptRoot\check-certificate-and-add-listener.ps1" -CertificateArn $certArn

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ ERREUR: Impossible d'ajouter le listener HTTPS." -ForegroundColor Red
    exit 1
}

# Étape 4: Attendre la propagation
Write-Host ""
Write-Host "Étape 4: Attente de la propagation (10 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Étape 5: Test de la connexion HTTPS
Write-Host ""
Write-Host "Étape 5: Test de la connexion HTTPS..." -ForegroundColor Yellow
Write-Host "URL: https://$apiDomain/health" -ForegroundColor Gray

$testResult = curl -v https://$apiDomain/health 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCÈS: Connexion HTTPS réussie!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le backend est maintenant accessible via HTTPS:" -ForegroundColor Cyan
    Write-Host "  - https://$apiDomain" -ForegroundColor White
    Write-Host "  - https://$apiDomain/health" -ForegroundColor White
    Write-Host ""
    Write-Host "La configuration est complète!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ ATTENTION: Le test HTTPS a échoué." -ForegroundColor Yellow
    Write-Host "   Causes possibles:" -ForegroundColor Yellow
    Write-Host "   - La propagation DNS n'est pas terminée" -ForegroundColor White
    Write-Host "   - Le listener HTTPS n'est pas encore actif" -ForegroundColor White
    Write-Host "   - Attendre quelques minutes et réessayer" -ForegroundColor White
    Write-Host ""
    Write-Host "Test manuel:" -ForegroundColor Cyan
    Write-Host "  curl -v https://$apiDomain/health" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURATION TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


