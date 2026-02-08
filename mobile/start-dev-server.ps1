# Script pour démarrer le serveur de développement Expo
# Usage: .\start-dev-server.ps1 [tunnel|lan]

param(
    [string]$Mode = "lan"
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG - SERVEUR DE DEVELOPPEMENT EXPO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis .env
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Chargement des variables depuis .env..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Vérifier et créer la règle de pare-feu
Write-Host "Vérification du pare-feu..." -ForegroundColor Cyan
$firewallRule = Get-NetFirewallRule -DisplayName "Expo Dev Server 8081" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    Write-Host "Création de la règle de pare-feu pour le port 8081..." -ForegroundColor Yellow
    try {
        New-NetFirewallRule -DisplayName "Expo Dev Server 8081" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -ErrorAction Stop | Out-Null
        Write-Host "  ✓ Règle de pare-feu créée" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Impossible de créer la règle (droits admin requis)" -ForegroundColor Yellow
        Write-Host "    Vous devrez peut-être autoriser le port 8081 manuellement" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✓ Règle de pare-feu déjà présente" -ForegroundColor Green
}

# Arrêter les serveurs existants
Write-Host ""
Write-Host "Arrêt des serveurs Expo existants..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*expo*" -or $_.Path -like "*expo*"
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Afficher l'IP Wi-Fi
Write-Host ""
Write-Host "Adresses réseau:" -ForegroundColor Cyan
$wifiIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" 
} | Select-Object -First 1).IPAddress
if ($wifiIP) {
    Write-Host "  IP locale: $wifiIP" -ForegroundColor Green
    Write-Host "  URL de connexion: exp://$wifiIP`:8081" -ForegroundColor Yellow
} else {
    Write-Host "  IP non détectée" -ForegroundColor Yellow
}

# Démarrer le serveur
Write-Host ""
if ($Mode -eq "tunnel") {
    Write-Host "Démarrage en mode TUNNEL..." -ForegroundColor Green
    Write-Host "  (Fonctionne même si les appareils sont sur des réseaux différents)" -ForegroundColor Gray
    Write-Host ""
    npx expo start --dev-client --host tunnel
} else {
    Write-Host "Démarrage en mode LAN (réseau local)..." -ForegroundColor Green
    Write-Host "  (Les appareils doivent être sur le même réseau Wi-Fi)" -ForegroundColor Gray
    Write-Host ""
    npx expo start --dev-client --lan
}



