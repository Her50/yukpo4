# =============================================================================
# Script PowerShell pour lancer le microservice d'embedding Yukpo
# Gestion automatique des ports occupés et des erreurs
# =============================================================================

param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$UseVenv,
    [switch]$Debug,
    [switch]$Help,
    [switch]$AutoPort
)

# Fonction d'aide
function Show-Help {
    Write-Host @"
Usage: .\launch_embedding_microservice.ps1 [Options]

Options:
    -Host <string>     Host d'écoute (défaut: 0.0.0.0)
    -Port <int>        Port d'écoute (défaut: 8000)
    -UseVenv           Activer l'environnement virtuel Python
    -Debug             Mode debug avec logs détaillés
    -AutoPort          Trouver automatiquement un port libre
    -Help              Afficher cette aide

Exemples:
    .\launch_embedding_microservice.ps1
    .\launch_embedding_microservice.ps1 -Port 8001
    .\launch_embedding_microservice.ps1 -UseVenv -Debug
    .\launch_embedding_microservice.ps1 -AutoPort
"@ -ForegroundColor Cyan
}

# Fonction pour vérifier si un port est libre
function Test-PortAvailable {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

# Fonction pour trouver un port libre
function Find-FreePort {
    param([int]$StartPort = 8000, [int]$MaxAttempts = 100)
    
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        $testPort = $StartPort + $i
        if (Test-PortAvailable -Port $testPort) {
            return $testPort
        }
    }
    return $null
}

# Fonction pour tuer les processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
                    Where-Object { $_.State -eq "Listen" } | 
                    ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
        
        if ($processes) {
            Write-Host "🔍 Processus trouvés sur le port $Port :" -ForegroundColor Yellow
            $processes | ForEach-Object {
                Write-Host "   - PID: $($_.Id), Nom: $($_.ProcessName)" -ForegroundColor White
            }
            
            $response = Read-Host "Voulez-vous arrêter ces processus ? (o/n)"
            if ($response -eq "o" -or $response -eq "O") {
                $processes | Stop-Process -Force
                Write-Host "✅ Processus arrêtés" -ForegroundColor Green
                Start-Sleep -Seconds 2
                return $true
            }
        }
    } catch {
        Write-Host "⚠️  Impossible de vérifier les processus sur le port $Port" -ForegroundColor Yellow
    }
    return $false
}

# Afficher l'aide si demandé
if ($Help) {
    Show-Help
    exit 0
}

Write-Host "=============================================================================" -ForegroundColor Green
Write-Host "🚀 LANCEMENT DU MICROSERVICE D'EMBEDDING YUKPO" -ForegroundColor Green
Write-Host "=============================================================================" -ForegroundColor Green

# Chemin vers le microservice
$microservicePath = Join-Path $PSScriptRoot "microservice_embedding"

# Vérifier l'existence du répertoire microservice
if (-not (Test-Path $microservicePath)) {
    Write-Host "❌ ERREUR: Répertoire microservice_embedding introuvable" -ForegroundColor Red
    Write-Host "   Chemin attendu: $microservicePath" -ForegroundColor Red
    exit 1
}

# Changer vers le répertoire du microservice
Set-Location $microservicePath

# Vérifier l'existence du fichier main.py
if (-not (Test-Path "main.py")) {
    Write-Host "❌ ERREUR: Fichier main.py introuvable dans $microservicePath" -ForegroundColor Red
    exit 1
}

# Vérifier Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "🐍 Python détecté: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERREUR: Python n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    exit 1
}

# Activer l'environnement virtuel si demandé
if ($UseVenv) {
    $venvPath = "venv"
    if (Test-Path $venvPath) {
        Write-Host "🔧 Activation de l'environnement virtuel..." -ForegroundColor Yellow
        $activateScript = Join-Path $venvPath "Scripts" "Activate.ps1"
        if (Test-Path $activateScript) {
            & $activateScript
            Write-Host "✅ Environnement virtuel activé" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Script d'activation introuvable, utilisation de Python global" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Environnement virtuel introuvable, utilisation de Python global" -ForegroundColor Yellow
    }
}

# Vérifier les dépendances
Write-Host "📦 Vérification des dépendances..." -ForegroundColor Yellow
try {
    $uvicornCheck = python -c "import uvicorn" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Uvicorn disponible" -ForegroundColor Green
    } else {
        Write-Host "❌ Uvicorn non installé. Installation..." -ForegroundColor Red
        pip install uvicorn
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification d'uvicorn" -ForegroundColor Red
    exit 1
}

# Gestion du port
$finalPort = $Port
if ($AutoPort) {
    Write-Host "🔍 Recherche d'un port libre..." -ForegroundColor Yellow
    $freePort = Find-FreePort -StartPort 8000
    if ($freePort) {
        $finalPort = $freePort
        Write-Host "✅ Port libre trouvé: $finalPort" -ForegroundColor Green
    } else {
        Write-Host "❌ Aucun port libre trouvé dans la plage 8000-8099" -ForegroundColor Red
        exit 1
    }
} else {
    # Vérifier si le port demandé est disponible
    if (-not (Test-PortAvailable -Port $Port)) {
        Write-Host "⚠️  Le port $Port est déjà utilisé" -ForegroundColor Yellow
        
        # Proposer des solutions
        Write-Host "Options disponibles :" -ForegroundColor Cyan
        Write-Host "   1. Utiliser un port différent" -ForegroundColor White
        Write-Host "   2. Arrêter les processus sur le port $Port" -ForegroundColor White
        Write-Host "   3. Trouver automatiquement un port libre" -ForegroundColor White
        Write-Host "   4. Quitter" -ForegroundColor White
        
        $choice = Read-Host "Votre choix (1-4)"
        
        switch ($choice) {
            "1" {
                $newPort = Read-Host "Nouveau port (défaut: 8001)"
                if ($newPort -eq "") { $newPort = 8001 }
                $finalPort = [int]$newPort
                if (-not (Test-PortAvailable -Port $finalPort)) {
                    Write-Host "❌ Le port $finalPort est aussi occupé" -ForegroundColor Red
                    exit 1
                }
            }
            "2" {
                if (Stop-ProcessOnPort -Port $Port) {
                    $finalPort = $Port
                } else {
                    Write-Host "❌ Impossible de libérer le port $Port" -ForegroundColor Red
                    exit 1
                }
            }
            "3" {
                $freePort = Find-FreePort -StartPort 8000
                if ($freePort) {
                    $finalPort = $freePort
                    Write-Host "✅ Port libre trouvé: $finalPort" -ForegroundColor Green
                } else {
                    Write-Host "❌ Aucun port libre trouvé" -ForegroundColor Red
                    exit 1
                }
            }
            "4" {
                Write-Host "👋 Arrêt du script" -ForegroundColor Yellow
                exit 0
            }
            default {
                Write-Host "❌ Choix invalide" -ForegroundColor Red
                exit 1
            }
        }
    }
}

# Configuration du mode debug
$debugFlag = ""
if ($Debug) {
    $debugFlag = "--log-level debug"
    Write-Host "🔍 Mode debug activé" -ForegroundColor Cyan
}

# Affichage de la configuration finale
Write-Host "⚙️  Configuration finale:" -ForegroundColor Cyan
Write-Host "   Host: $Host" -ForegroundColor White
Write-Host "   Port: $finalPort" -ForegroundColor White
Write-Host "   Debug: $Debug" -ForegroundColor White
Write-Host "   Venv: $UseVenv" -ForegroundColor White

Write-Host "=============================================================================" -ForegroundColor Green
Write-Host "🚀 Démarrage du microservice d'embedding..." -ForegroundColor Green
Write-Host "   URL: http://$Host`:$finalPort" -ForegroundColor Cyan
Write-Host "   Ctrl+C pour arrêter" -ForegroundColor Yellow
Write-Host "=============================================================================" -ForegroundColor Green

# Lancer le microservice
try {
    $command = "python -m uvicorn main:app --host $Host --port $finalPort $debugFlag"
    Write-Host "📡 Commande: $command" -ForegroundColor Gray
    
    python -m uvicorn main:app --host $Host --port $finalPort $debugFlag
} catch {
    Write-Host "❌ ERREUR lors du lancement du microservice:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "✅ Microservice d'embedding arrêté" -ForegroundColor Green 