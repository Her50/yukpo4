# Script pour telecharger Blender manuellement
# Ce script telecharge Blender et le place dans backend/blender/ pour etre copie dans l'image Docker

$ErrorActionPreference = "Stop"

# Obtenir le répertoire du script et le répertoire racine du projet
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Write-Host "Telechargement de Blender pour Docker..." -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$blenderUrl = "https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz"
$blenderDir = Join-Path $projectRoot "backend\blender"
$blenderArchive = Join-Path $blenderDir "blender-4.0.0-linux-x64.tar.xz"

# Creer le dossier blender s'il n'existe pas
if (-not (Test-Path $blenderDir)) {
    New-Item -ItemType Directory -Path $blenderDir -Force | Out-Null
    Write-Host "[OK] Dossier cree: $blenderDir" -ForegroundColor Green
}

# Verifier si Blender est deja telecharge
if (Test-Path $blenderArchive) {
    $fileSize = (Get-Item $blenderArchive).Length / 1MB
    Write-Host "[INFO] Blender deja telecharge: $blenderArchive ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Yellow
    
    # Verifier que le fichier a une taille valide (au moins 100 MB)
    if ($fileSize -ge 100) {
        Write-Host "[OK] Fichier Blender valide, utilisation du fichier existant" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[!] Fichier Blender invalide (trop petit: $([math]::Round($fileSize, 2)) MB)" -ForegroundColor Yellow
        Write-Host "[*] Suppression du fichier invalide et re-telechargement..." -ForegroundColor Cyan
        Remove-Item $blenderArchive -Force -ErrorAction SilentlyContinue
    }
}

# Telecharger Blender avec retry
Write-Host "[*] Telechargement de Blender depuis $blenderUrl" -ForegroundColor Yellow
Write-Host "    Cela peut prendre plusieurs minutes (environ 200-300 MB)..." -ForegroundColor Gray
Write-Host ""

$maxRetries = 3
$retryDelay = 5 # secondes
$success = $false

for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
    Write-Host "[*] Tentative $attempt/$maxRetries..." -ForegroundColor Cyan
    
    try {
        # Utiliser WebClient pour afficher la progression en temps réel
        $ProgressPreference = 'Continue'
        
        Write-Host "    Telechargement en cours..." -ForegroundColor Gray
        
        # Créer un WebClient avec suivi de progression
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        $webClient.Headers.Add("Accept", "*/*")
        
        # Variables pour le suivi de progression
        $lastSize = 0
        $lastTime = Get-Date
        $startTime = Get-Date
        
        # Événement pour suivre la progression
        Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action {
            $current = $EventArgs.BytesReceived / 1MB
            $total = $EventArgs.TotalBytesToReceive / 1MB
            $percent = $EventArgs.ProgressPercentage
            $currentTime = Get-Date
            $elapsed = ($currentTime - $Event.MessageData.StartTime).TotalSeconds
            
            if ($elapsed -gt 0) {
                $speed = ($current - $Event.MessageData.LastSize) / ($elapsed - $Event.MessageData.ElapsedSeconds)
                $remaining = if ($speed -gt 0) { ($total - $current) / $speed } else { 0 }
                
                Write-Host "`r    Progress: $([math]::Round($current, 2)) MB / $([math]::Round($total, 2)) MB ($percent%) | Vitesse: $([math]::Round($speed, 2)) MB/s | Restant: $([math]::Round($remaining, 0))s" -NoNewline -ForegroundColor Cyan
                
                $Event.MessageData.LastSize = $current
                $Event.MessageData.ElapsedSeconds = $elapsed
            }
        } -MessageData @{
            LastSize = 0
            ElapsedSeconds = 0
            StartTime = $startTime
        } | Out-Null
        
        # Télécharger le fichier
        $webClient.DownloadFile($blenderUrl, $blenderArchive)
        
        Write-Host "" # Nouvelle ligne après la progression
        $webClient.Dispose()
        
        # Verifier que le fichier existe et a une taille valide
        if (Test-Path $blenderArchive) {
            Start-Sleep -Seconds 1  # Attendre que le fichier soit complètement écrit
            $fileSize = (Get-Item $blenderArchive).Length / 1MB
            $elapsedTotal = ((Get-Date) - $startTime).TotalSeconds
            
            if ($fileSize -ge 100) { # Au moins 100 MB
                $success = $true
                Write-Host ""
                Write-Host "[OK] Blender telecharge avec succes!" -ForegroundColor Green
                Write-Host "     Fichier: $blenderArchive" -ForegroundColor Gray
                Write-Host "     Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
                Write-Host "     Temps: $([math]::Round($elapsedTotal, 1)) secondes" -ForegroundColor Gray
                Write-Host ""
                Write-Host "Vous pouvez maintenant builder l'image Docker:" -ForegroundColor Cyan
                Write-Host "  .\scripts\build-backend-docker.ps1" -ForegroundColor White
                Write-Host ""
                break
            } else {
                Write-Host "[!] Fichier trop petit ($([math]::Round($fileSize, 2)) MB), reessai..." -ForegroundColor Yellow
                Remove-Item $blenderArchive -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Host "" # Nouvelle ligne si erreur pendant le téléchargement
        $errorMsg = $_.Exception.Message
        Write-Host "[!] Erreur: $errorMsg" -ForegroundColor Yellow
        
        if ($webClient) {
            $webClient.Dispose()
        }
        
        if (Test-Path $blenderArchive) {
            Remove-Item $blenderArchive -Force -ErrorAction SilentlyContinue
        }
        
        if ($attempt -lt $maxRetries) {
            Write-Host "[*] Attente de $retryDelay secondes avant le prochain essai..." -ForegroundColor Gray
            Start-Sleep -Seconds $retryDelay
            $retryDelay = [math]::Min($retryDelay * 2, 30) # Backoff exponentiel, max 30s
        }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "[ERREUR] Echec du telechargement apres $maxRetries tentatives" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions alternatives:" -ForegroundColor Yellow
    Write-Host "  1. Telecharger manuellement depuis:" -ForegroundColor Gray
    Write-Host "     $blenderUrl" -ForegroundColor White
    Write-Host "  2. Placer le fichier dans: $blenderArchive" -ForegroundColor Gray
    Write-Host "  3. Utiliser un navigateur web pour telecharger et placer le fichier manuellement" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: Le fichier doit faire au moins 100 MB pour etre valide" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
