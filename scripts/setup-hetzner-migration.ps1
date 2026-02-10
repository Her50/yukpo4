# 🚀 Script de Configuration Migration Hetzner
# Ce script configure les secrets GitHub et prépare Hetzner pour la migration

param(
    [string]$HetznerHost = "46.224.14.85",
    [string]$HetznerUser = "root",
    [string]$HetznerDir = "/opt/yukpo"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Configuration Migration Backend vers Hetzner" -ForegroundColor Cyan
Write-Host ""

# ============================================
# ÉTAPE 1 : Générer la clé SSH
# ============================================
Write-Host "📝 ÉTAPE 1 : Génération de la clé SSH pour Hetzner" -ForegroundColor Yellow
Write-Host ""

$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
$sshKeyPathPub = "$sshKeyPath.pub"

if (Test-Path $sshKeyPath) {
    Write-Host "⚠️  La clé SSH existe déjà : $sshKeyPath" -ForegroundColor Yellow
    $overwrite = Read-Host "Voulez-vous la régénérer ? (o/N)"
    if ($overwrite -ne "o" -and $overwrite -ne "O") {
        Write-Host "✅ Utilisation de la clé existante" -ForegroundColor Green
    } else {
        Remove-Item $sshKeyPath -Force -ErrorAction SilentlyContinue
        Remove-Item $sshKeyPathPub -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $sshKeyPath)) {
    Write-Host "🔑 Génération de la clé SSH..." -ForegroundColor Cyan
    
    # Vérifier si ssh-keygen est disponible
    $sshKeygen = Get-Command ssh-keygen -ErrorAction SilentlyContinue
    if (-not $sshKeygen) {
        Write-Host "❌ ssh-keygen non trouvé. Installez OpenSSH ou Git for Windows." -ForegroundColor Red
        Write-Host "   Téléchargez : https://git-scm.com/download/win" -ForegroundColor Yellow
        exit 1
    }
    
    # Générer la clé
    ssh-keygen -t ed25519 -C "github-actions-hetzner" -f $sshKeyPath -N '""'
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de la génération de la clé SSH" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Clé SSH générée avec succès" -ForegroundColor Green
} else {
    Write-Host "✅ Clé SSH trouvée : $sshKeyPath" -ForegroundColor Green
}

# Afficher la clé privée pour GitHub Secrets
Write-Host ""
Write-Host "📋 CLÉ PRIVÉE (à copier dans GitHub Secrets) :" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
$privateKey = Get-Content $sshKeyPath -Raw
Write-Host $privateKey -ForegroundColor White
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""
Write-Host "👉 Copiez cette clé dans GitHub → Settings → Secrets → HETZNER_SSH_PRIVATE_KEY" -ForegroundColor Yellow
Write-Host ""
$continue = Read-Host "Appuyez sur Entrée une fois la clé copiée dans GitHub Secrets"

# ============================================
# ÉTAPE 2 : Copier la clé publique sur Hetzner
# ============================================
Write-Host ""
Write-Host "📝 ÉTAPE 2 : Copie de la clé publique sur Hetzner" -ForegroundColor Yellow
Write-Host ""

$publicKey = Get-Content $sshKeyPathPub -Raw

Write-Host "🔑 Clé publique à copier :" -ForegroundColor Cyan
Write-Host $publicKey -ForegroundColor White
Write-Host ""

Write-Host "📤 Copie de la clé publique sur Hetzner..." -ForegroundColor Cyan
Write-Host "   (Vous devrez peut-être entrer le mot de passe SSH)" -ForegroundColor Yellow

# Tester la connexion SSH
$testConnection = ssh -o ConnectTimeout=5 -i $sshKeyPath "$HetznerUser@$HetznerHost" "echo 'Connection OK'" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connexion SSH réussie (clé déjà configurée)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Connexion SSH échouée, copie de la clé publique..." -ForegroundColor Yellow
    
    # Copier la clé publique
    $publicKeyContent = Get-Content $sshKeyPathPub -Raw
    ssh-copy-id -i $sshKeyPathPub "$HetznerUser@$HetznerHost" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Clé publique copiée avec succès" -ForegroundColor Green
    } else {
        Write-Host "⚠️  ssh-copy-id non disponible, copie manuelle requise" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Instructions manuelles :" -ForegroundColor Cyan
        Write-Host "1. Connectez-vous à Hetzner : ssh $HetznerUser@$HetznerHost" -ForegroundColor White
        Write-Host "2. Exécutez : mkdir -p ~/.ssh && chmod 700 ~/.ssh" -ForegroundColor White
        Write-Host "3. Ajoutez cette clé publique à ~/.ssh/authorized_keys :" -ForegroundColor White
        Write-Host $publicKey -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Appuyez sur Entrée une fois la clé copiée manuellement"
    }
}

# ============================================
# ÉTAPE 3 : Vérifier Docker sur Hetzner
# ============================================
Write-Host ""
Write-Host "📝 ÉTAPE 3 : Vérification de Docker sur Hetzner" -ForegroundColor Yellow
Write-Host ""

$dockerCheck = ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" "if command -v docker > /dev/null 2>&1; then docker --version; else exit 1; fi" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker installé :" -ForegroundColor Green
    Write-Host $dockerCheck -ForegroundColor White
} else {
    Write-Host "⚠️  Docker non installé sur Hetzner" -ForegroundColor Yellow
    Write-Host "📦 Installation de Docker..." -ForegroundColor Cyan
    
    ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" @"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
"@
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker installé avec succès" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'installation de Docker" -ForegroundColor Red
        exit 1
    }
}

# Vérifier Docker Compose
$dockerComposeCheck = ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" "if command -v docker-compose > /dev/null 2>&1; then docker-compose --version; elif docker compose version > /dev/null 2>&1; then docker compose version; else exit 1; fi" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker Compose disponible" -ForegroundColor Green
} else {
    Write-Host "⚠️  Docker Compose non trouvé, installation..." -ForegroundColor Yellow
    ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" "apt-get update; apt-get install -y docker-compose-plugin"
}

# ============================================
# ÉTAPE 4 : Créer les répertoires sur Hetzner
# ============================================
Write-Host ""
Write-Host "📝 ÉTAPE 4 : Création des répertoires sur Hetzner" -ForegroundColor Yellow
Write-Host ""

ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" @"
    mkdir -p $HetznerDir/backend
    mkdir -p $HetznerDir/nginx
    mkdir -p $HetznerDir/logs
    echo '✅ Répertoires créés'
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Répertoires créés avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la création des répertoires" -ForegroundColor Red
    exit 1
}

# ============================================
# ÉTAPE 5 : Créer le fichier .env
# ============================================
Write-Host ""
Write-Host "📝 ÉTAPE 5 : Création du fichier .env sur Hetzner" -ForegroundColor Yellow
Write-Host ""

Write-Host "📋 Veuillez fournir les informations suivantes :" -ForegroundColor Cyan
Write-Host ""

# Demander les variables d'environnement
$dbPassword = Read-Host "Mot de passe PostgreSQL" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

$redisPassword = Read-Host "Mot de passe Redis" -AsSecureString
$redisPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($redisPassword))

$jwtSecret = Read-Host "JWT Secret (ou appuyez sur Entrée pour générer)"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    # Générer un JWT secret aléatoire
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    Write-Host "✅ JWT Secret généré automatiquement" -ForegroundColor Green
}

$dbUser = Read-Host "Utilisateur PostgreSQL (défaut: yukpo_user)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "yukpo_user"
}

# Créer le contenu du fichier .env
$envContent = @"
# Database PostgreSQL
DATABASE_URL=postgresql://${dbUser}:${dbPasswordPlain}@postgres:5432/yukpomnang
DB_USER=${dbUser}
DB_PASSWORD=${dbPasswordPlain}

# Redis
REDIS_URL=redis://:${redisPasswordPlain}@redis:6379/0
REDIS_PASSWORD=${redisPasswordPlain}

# JWT
JWT_SECRET=${jwtSecret}

# Environnement
ENVIRONMENT=production
RUST_LOG=info
HOST=0.0.0.0
PORT=8080

# CORS
ALLOWED_ORIGINS=https://yukpomnang.com,https://api.yukpomnang.com,https://app.yukpomnang.com

# Autres variables (à compléter selon vos besoins)
# OPENAI_API_KEY=
# GOOGLE_MAPS_API_KEY=
# MONGODB_URL=
"@

# Créer un fichier temporaire
$tempEnvFile = [System.IO.Path]::GetTempFileName()
$envContent | Out-File -FilePath $tempEnvFile -Encoding UTF8

# Copier sur Hetzner
Write-Host ""
Write-Host "📤 Copie du fichier .env sur Hetzner..." -ForegroundColor Cyan
scp -i $sshKeyPath $tempEnvFile "$HetznerUser@${HetznerHost}:${HetznerDir}/.env"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fichier .env créé avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la copie du fichier .env" -ForegroundColor Red
    exit 1
}

# Sécuriser le fichier .env
ssh -i $sshKeyPath "$HetznerUser@$HetznerHost" "chmod 600 ${HetznerDir}/.env"

# Nettoyer le fichier temporaire
Remove-Item $tempEnvFile -Force

# ============================================
# ÉTAPE 6 : Résumé
# ============================================
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ CONFIGURATION TERMINÉE AVEC SUCCÈS !" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green
Write-Host ""
Write-Host "📋 Récapitulatif :" -ForegroundColor Cyan
Write-Host "  ✅ Clé SSH générée : $sshKeyPath" -ForegroundColor White
Write-Host "  ✅ Clé publique copiée sur Hetzner" -ForegroundColor White
Write-Host "  ✅ Docker installé et configuré" -ForegroundColor White
Write-Host "  ✅ Répertoires créés sur Hetzner" -ForegroundColor White
Write-Host "  ✅ Fichier .env créé sur Hetzner" -ForegroundColor White
Write-Host ""
Write-Host "📝 PROCHAINE ÉTAPE :" -ForegroundColor Yellow
Write-Host "  1. Vérifiez que HETZNER_SSH_PRIVATE_KEY est dans GitHub Secrets" -ForegroundColor White
Write-Host "  2. Faites un git push pour déclencher le déploiement automatique" -ForegroundColor White
Write-Host "  3. Ou utilisez GitHub Actions → Run workflow → Deploy to Hetzner" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Vérifier la configuration :" -ForegroundColor Cyan
Write-Host "  ssh -i $sshKeyPath $HetznerUser@$HetznerHost 'cd $HetznerDir && cat .env'" -ForegroundColor Gray
Write-Host ""

