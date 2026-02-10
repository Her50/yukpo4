# 📝 Script pour créer le fichier .env sur Hetzner
# Usage: .\scripts\create-hetzner-env.ps1

param(
    [string]$HetznerHost = "46.224.14.85",
    [string]$HetznerUser = "root",
    [string]$HetznerDir = "/opt/yukpo",
    [string]$SshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
)

$ErrorActionPreference = "Stop"

Write-Host "📝 Création du fichier .env sur Hetzner" -ForegroundColor Cyan
Write-Host ""

# Vérifier la connexion SSH
if (-not (Test-Path $SshKeyPath)) {
    Write-Host "❌ Clé SSH non trouvée : $SshKeyPath" -ForegroundColor Red
    Write-Host "   Exécutez d'abord : .\scripts\setup-hetzner-migration.ps1" -ForegroundColor Yellow
    exit 1
}

# Demander les variables d'environnement
Write-Host "📋 Configuration des variables d'environnement" -ForegroundColor Yellow
Write-Host ""

# Database
$dbUser = Read-Host "Utilisateur PostgreSQL (défaut: yukpo_user)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "yukpo_user"
}

$dbPassword = Read-Host "Mot de passe PostgreSQL" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

# Redis
$redisPassword = Read-Host "Mot de passe Redis" -AsSecureString
$redisPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($redisPassword))

# JWT Secret
$jwtSecret = Read-Host "JWT Secret (ou Entrée pour générer)"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    Write-Host "✅ JWT Secret généré : $jwtSecret" -ForegroundColor Green
}

# Variables optionnelles
Write-Host ""
Write-Host "Variables optionnelles (appuyez sur Entrée pour ignorer) :" -ForegroundColor Yellow
$openaiKey = Read-Host "OPENAI_API_KEY"
$googleMapsKey = Read-Host "GOOGLE_MAPS_API_KEY"
$mongodbUrl = Read-Host "MONGODB_URL"

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

# IA (optionnel)
"@

if (-not [string]::IsNullOrWhiteSpace($openaiKey)) {
    $envContent += "`nOPENAI_API_KEY=${openaiKey}"
}

if (-not [string]::IsNullOrWhiteSpace($googleMapsKey)) {
    $envContent += "`nGOOGLE_MAPS_API_KEY=${googleMapsKey}"
}

if (-not [string]::IsNullOrWhiteSpace($mongodbUrl)) {
    $envContent += "`nMONGODB_URL=${mongodbUrl}"
}

# Créer un fichier temporaire
$tempEnvFile = [System.IO.Path]::GetTempFileName()
$envContent | Out-File -FilePath $tempEnvFile -Encoding UTF8

# Copier sur Hetzner
Write-Host ""
Write-Host "📤 Copie du fichier .env sur Hetzner..." -ForegroundColor Cyan
scp -i $SshKeyPath $tempEnvFile "${HetznerUser}@${HetznerHost}:${HetznerDir}/.env"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fichier .env créé avec succès" -ForegroundColor Green
    
    # Sécuriser le fichier
    ssh -i $SshKeyPath "${HetznerUser}@${HetznerHost}" "chmod 600 ${HetznerDir}/.env"
    
    Write-Host "✅ Permissions sécurisées (600)" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la copie du fichier .env" -ForegroundColor Red
    exit 1
}

# Nettoyer
Remove-Item $tempEnvFile -Force

Write-Host ""
Write-Host "✅ Fichier .env créé sur Hetzner : ${HetznerDir}/.env" -ForegroundColor Green
Write-Host ""

