# Script pour attendre les DNS et automatiser la configuration HTTPS complète
# Usage: .\scripts\wait-and-automate-https.ps1
# 
# Ce script vérifie périodiquement si les enregistrements DNS sont en place,
# puis automatise toute la configuration HTTPS

param(
    [int]$DnsCheckInterval = 30,    # Intervalle entre vérifications DNS (secondes)
    [int]$DnsMaxAttempts = 20,      # Nombre max de tentatives pour DNS (20 * 30s = 10 minutes)
    [int]$CertCheckInterval = 30,   # Intervalle entre vérifications certificat (secondes)
    [int]$CertMaxAttempts = 40      # Nombre max de tentatives pour certificat (40 * 30s = 20 minutes)
)

Write-Host "=== AUTOMATISATION COMPLÈTE HTTPS ===" -ForegroundColor Cyan
Write-Host ""

# Variables
$certArn = "arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7"
$apiDomain = "api.yukpomnang.com"
$albDns = "yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"

# Étape 1: Attendre que les enregistrements DNS soient en place
Write-Host "Étape 1: Attente des enregistrements DNS..." -ForegroundColor Yellow
Write-Host "Vérification toutes les $DnsCheckInterval secondes (max $DnsMaxAttempts tentatives)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Enregistrements DNS requis:" -ForegroundColor Cyan
Write-Host "  1. CNAME: $apiDomain -> $albDns" -ForegroundColor White
Write-Host "  2. CNAME: _07560c403145510b496c9b8313c6c600.$apiDomain -> validation ACM" -ForegroundColor White
Write-Host ""

$dnsAttempt = 0
$dnsReady = $false

while ($dnsAttempt -lt $DnsMaxAttempts -and -not $dnsReady) {
    Start-Sleep -Seconds $DnsCheckInterval
    $dnsCheck = Resolve-DnsName -Name $apiDomain -Type CNAME -ErrorAction SilentlyContinue
    $dnsAttempt++
    
    if ($dnsCheck) {
        $target = $dnsCheck.NameHost
        Write-Host "  [$dnsAttempt/$DnsMaxAttempts] DNS trouvé: $apiDomain -> $target" -ForegroundColor Green
        
        # Vérifier si ça pointe vers l'ALB
        if ($target -like "*$albDns*" -or $target -eq $albDns) {
            $dnsReady = $true
            Write-Host ""
            Write-Host "✅ OK: Les enregistrements DNS sont en place!" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Pointe vers: $target (attendu: $albDns)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [$dnsAttempt/$DnsMaxAttempts] DNS non résolvable encore..." -ForegroundColor Yellow
    }
}

if (-not $dnsReady) {
    Write-Host ""
    Write-Host "❌ ATTENTION: Les enregistrements DNS ne sont pas encore en place après $DnsMaxAttempts tentatives." -ForegroundColor Red
    Write-Host "   Vérifiez que vous avez ajouté les enregistrements DNS dans votre DNS." -ForegroundColor Yellow
    Write-Host "   Voir ENREGISTREMENTS_DNS_A_CREER.md pour les détails." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Vous pouvez relancer ce script plus tard:" -ForegroundColor Cyan
    Write-Host "     .\scripts\wait-and-automate-https.ps1" -ForegroundColor Gray
    exit 1
}

# Étape 2: Attendre la validation du certificat
Write-Host ""
Write-Host "Étape 2: Attente de la validation du certificat..." -ForegroundColor Yellow
Write-Host "ARN: $certArn" -ForegroundColor Gray
Write-Host "Vérification toutes les $CertCheckInterval secondes (max $CertMaxAttempts tentatives)..." -ForegroundColor Cyan

$certAttempt = 0
$certValidated = $false
$status = ""

while ($certAttempt -lt $CertMaxAttempts -and -not $certValidated) {
    Start-Sleep -Seconds $CertCheckInterval
    $certDetails = aws acm describe-certificate --certificate-arn $certArn --region us-east-1 --output json | ConvertFrom-Json
    $status = $certDetails.Certificate.Status
    $certAttempt++
    
    $color = if ($status -eq "ISSUED") { "Green" } elseif ($status -eq "FAILED") { "Red" } else { "Yellow" }
    Write-Host "  [$certAttempt/$CertMaxAttempts] Status: $status" -ForegroundColor $color
    
    if ($status -eq "ISSUED") {
        $certValidated = $true
        Write-Host ""
        Write-Host "✅ Certificat validé avec succès!" -ForegroundColor Green
    } elseif ($status -eq "FAILED") {
        Write-Host ""
        Write-Host "❌ ERREUR: Le certificat a échoué la validation." -ForegroundColor Red
        Write-Host "   Vérifiez que les enregistrements DNS de validation ont été ajoutés correctement." -ForegroundColor Yellow
        exit 1
    }
}

if (-not $certValidated) {
    Write-Host ""
    Write-Host "⚠️ ATTENTION: Le certificat n'est pas encore validé après $CertMaxAttempts tentatives." -ForegroundColor Yellow
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
Write-Host "Étape 4: Attente de la propagation (15 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

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
    Write-Host "  - https://$apiDomain/api/health" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Configuration complète et opérationnelle!" -ForegroundColor Green
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
Write-Host "  AUTOMATISATION TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


