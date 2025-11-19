# Script de Deploiement Prometheus/Grafana sur Hetzner
# Usage: .\deploy-hetzner-monitoring.ps1

$ErrorActionPreference = "Continue"

Write-Host "Deploiement Prometheus/Grafana sur Hetzner" -ForegroundColor Cyan
Write-Host ""

# Configuration
$HETZNER_IP = "46.224.14.85"
$HETZNER_USER = "root"
$HETZNER_PATH = "/opt/yukpo"
$BACKEND_URL = "https://yukpomnang.onrender.com"

# Couleurs
function Write-Step {
    param($Message)
    Write-Host "[*] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param($Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param($Message)
    Write-Host "[ERREUR] $Message" -ForegroundColor Red
}

# Etape 1: Verifier que le backend expose /metrics
Write-Step "Etape 1: Verification du backend Render..."
try {
    # SkipCertificateCheck n'est disponible qu'à partir de PowerShell 6+
    # Pour PowerShell 5, on utilise une approche différente
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/metrics" -SkipCertificateCheck -TimeoutSec 10 -ErrorAction Stop
    }
    else {
        # Pour PowerShell 5, on ignore les erreurs SSL
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/metrics" -TimeoutSec 10 -ErrorAction Stop
    }
    if ($response.StatusCode -eq 200) {
        Write-Success "Backend Render expose /metrics correctement"
        Write-Host "   Premieres lignes:" -ForegroundColor Gray
        ($response.Content -split "`n" | Select-Object -First 5) | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
}
catch {
    Write-Error "Impossible d'acceder a $BACKEND_URL/metrics"
    Write-Host "   Erreur: $_" -ForegroundColor Red
    Write-Host "   Verifiez que le backend est deploye et accessible" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Continuez quand meme? (o/N)" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -ne "o" -and $continue -ne "O") {
        exit 1
    }
}

Write-Host ""

# Etape 2: Verifier les fichiers de configuration
Write-Step "Etape 2: Verification des fichiers de configuration..."
if (-not (Test-Path "prometheus.yml")) {
    Write-Error "Fichier prometheus.yml introuvable"
    exit 1
}
Write-Success "prometheus.yml trouve"

if (-not (Test-Path "docker-compose.yml")) {
    Write-Error "Fichier docker-compose.yml introuvable"
    exit 1
}
Write-Success "docker-compose.yml trouve"

# Verifier que prometheus.yml contient la bonne URL
$prometheusContent = Get-Content "prometheus.yml" -Raw
if ($prometheusContent -notmatch "yukpomnang\.onrender\.com") {
    Write-Error "prometheus.yml ne contient pas l'URL Render correcte"
    exit 1
}
Write-Success "prometheus.yml contient la configuration Render"

Write-Host ""

# Etape 3: Instructions pour la connexion SSH
Write-Step "Etape 3: Instructions pour le deploiement sur Hetzner"
Write-Host ""
Write-Host "Pour deployer sur Hetzner, executez les commandes suivantes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "# 1. Se connecter a Hetzner" -ForegroundColor White
Write-Host "ssh $HETZNER_USER@$HETZNER_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "# 2. Aller au repertoire du projet" -ForegroundColor White
Write-Host "cd $HETZNER_PATH" -ForegroundColor Gray
Write-Host ""
Write-Host "# 3. Mettre a jour le code" -ForegroundColor White
Write-Host "git pull origin master" -ForegroundColor Gray
Write-Host ""
Write-Host "# 4. Verifier la configuration Prometheus" -ForegroundColor White
Write-Host "cat prometheus.yml | grep yukpomnang" -ForegroundColor Gray
Write-Host ""
Write-Host "# 5. Arreter les anciens conteneurs (si existants)" -ForegroundColor White
Write-Host "docker compose stop prometheus grafana" -ForegroundColor Gray
Write-Host "docker compose rm -f prometheus grafana" -ForegroundColor Gray
Write-Host ""
Write-Host "# 6. Lancer Prometheus et Grafana" -ForegroundColor White
Write-Host "docker compose up -d prometheus grafana" -ForegroundColor Gray
Write-Host ""
Write-Host "# 7. Verifier l'etat" -ForegroundColor White
Write-Host "docker compose ps prometheus grafana" -ForegroundColor Gray
Write-Host ""
Write-Host "# 8. Voir les logs" -ForegroundColor White
Write-Host "docker compose logs -f prometheus" -ForegroundColor Gray
Write-Host "docker compose logs -f grafana" -ForegroundColor Gray
Write-Host ""
Write-Host "# 9. Verifier que Prometheus scrape le backend (attendre 15 secondes)" -ForegroundColor White
Write-Host "sleep 15" -ForegroundColor Gray
Write-Host "curl -s http://localhost:9090/api/v1/targets | grep -A 10 yukpo" -ForegroundColor Gray
Write-Host ""
Write-Host "Acces:" -ForegroundColor Cyan
Write-Host "  - Prometheus: http://$HETZNER_IP:9090" -ForegroundColor White
Write-Host "  - Grafana: http://$HETZNER_IP:3002 (admin/admin)" -ForegroundColor White
Write-Host ""

# Etape 4: Option pour executer automatiquement (si SSH configure)
$sshConfigured = $false
if (Test-Path "$HOME\.ssh\config") {
    $sshConfig = Get-Content "$HOME\.ssh\config" -Raw
    if ($sshConfig -match "hetzner-yukpo" -or $sshConfig -match $HETZNER_IP) {
        $sshConfigured = $true
    }
}

if ($sshConfigured) {
    Write-Host ""
    $autoDeploy = Read-Host "SSH semble configure. Voulez-vous deployer automatiquement? (o/N)"
    if ($autoDeploy -eq "o" -or $autoDeploy -eq "O") {
        Write-Step "Deploiement automatique..."
        
        if (-not (Test-Path "deploy-hetzner.sh")) {
            Write-Error "Fichier deploy-hetzner.sh introuvable"
            exit 1
        }
        
        Write-Host "   Envoi du script sur Hetzner..." -ForegroundColor Gray
        scp deploy-hetzner.sh "${HETZNER_USER}@${HETZNER_IP}:/tmp/deploy-monitoring.sh"
        
        Write-Host "   Execution du script..." -ForegroundColor Gray
        ssh "${HETZNER_USER}@${HETZNER_IP}" "chmod +x /tmp/deploy-monitoring.sh && bash /tmp/deploy-monitoring.sh"
        
        Write-Success "Deploiement termine!"
    }
}
else {
    Write-Host ""
    Write-Host "Astuce: Configurez SSH sans mot de passe pour un deploiement automatique" -ForegroundColor Yellow
    Write-Host "   Voir: GUIDE_SSH_SANS_MOT_DE_PASSE.md" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OU copiez le script deploy-hetzner.sh sur Hetzner et executez-le:" -ForegroundColor Yellow
    Write-Host "   scp deploy-hetzner.sh root@${HETZNER_IP}:/tmp/" -ForegroundColor Gray
    Write-Host "   ssh root@${HETZNER_IP} 'bash /tmp/deploy-hetzner.sh'" -ForegroundColor Gray
}

Write-Host ""
Write-Success "Script termine!"
