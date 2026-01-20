# Script de Build Docker pour le Backend
# Build l'image Docker localement pour tester avant le deploiement AWS

param(
    [Parameter(Mandatory = $false)]
    [switch]$Test = $false,  # Tester l'image apres le build
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipCache = $false  # Ignorer le cache Docker
)

$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-ErrorMsg { Write-Host $args -ForegroundColor Red }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

# Verifier que Docker est disponible
function Test-Docker {
    Write-Info "[*] Verification de Docker..."
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "[ERREUR] Docker n'est pas installe ou non disponible dans le PATH"
            return $false
        }
        Write-Success "[OK] Docker: $dockerVersion"
        
        # Verifier que Docker Desktop est en cours d'execution
        Write-Info "   Verification que Docker Desktop est demarre..."
        $dockerPsResult = docker ps 2>&1
        if ($LASTEXITCODE -ne 0) {
            $errorMsg = $dockerPsResult -join "`n"
            Write-ErrorMsg "[ERREUR] Docker Desktop n'est pas demarre ou ne repond pas"
            Write-Warning "   Erreur: $errorMsg"
            Write-Host ""
            Write-Warning "   Solutions:"
            Write-Host "   1. Demarrez Docker Desktop depuis le menu Demarrer" -ForegroundColor Gray
            Write-Host "   2. Attendez que Docker Desktop soit completement demarre (icone dans la barre des taches)" -ForegroundColor Gray
            Write-Host "   3. Redemarrez Docker Desktop si necessaire" -ForegroundColor Gray
            Write-Host ""
            return $false
        }
        Write-Success "[OK] Docker Desktop est en cours d'execution"
        return $true
    } catch {
        Write-ErrorMsg "[ERREUR] Docker non disponible: $_"
        Write-Warning "   Assurez-vous que Docker Desktop est installe et demarre"
        return $false
    }
}

# Verifier que Blender est telecharge
function Test-Blender {
    Write-Info "[*] Verification de Blender..."
    
    $blenderPath = "backend\blender\blender-4.0.0-linux-x64.tar.xz"
    if (-not (Test-Path $blenderPath)) {
        Write-ErrorMsg "[ERREUR] Blender non trouve: $blenderPath"
        Write-Warning "   Blender est OBLIGATOIRE pour le build Docker"
        Write-Info "   Telechargez Blender avec: .\scripts\download-blender.ps1"
        return $false
    }
    
    $fileSize = (Get-Item $blenderPath).Length / 1MB
    if ($fileSize -lt 100) {
        Write-ErrorMsg "[ERREUR] Fichier Blender invalide (trop petit: $([math]::Round($fileSize, 2)) MB)"
        Write-Info "   Re-telechargez Blender avec: .\scripts\download-blender.ps1"
        return $false
    }
    
    Write-Success "[OK] Blender trouve ($([math]::Round($fileSize, 2)) MB)"
    return $true
}

# Verifier le cache SQLx
function Test-SqlxCache {
    Write-Info "[*] Verification du cache SQLx..."
    
    $sqlxPath = "backend/.sqlx"
    if (-not (Test-Path $sqlxPath)) {
        Write-Warning "[!] Cache SQLx non trouve dans backend/.sqlx"
        Write-Info "   Generation du cache SQLx..."
        
        Push-Location "backend"
        try {
            # Verifier que SQLX_OFFLINE est configure
            $env:SQLX_OFFLINE = "false"
            cargo sqlx prepare -- --lib
            
            if ($LASTEXITCODE -ne 0) {
                Write-ErrorMsg "[ERREUR] Echec de la generation du cache SQLx"
                Write-Warning "   Assurez-vous que DATABASE_URL est configure et que la DB est accessible"
                return $false
            }
            
            Write-Success "[OK] Cache SQLx genere avec succes"
        } catch {
            Write-ErrorMsg "[ERREUR] Erreur lors de la generation du cache SQLx: $_"
            return $false
        } finally {
            Pop-Location
        }
    } else {
        $fileCount = (Get-ChildItem -Path $sqlxPath -Recurse -File | Measure-Object).Count
        Write-Success "[OK] Cache SQLx trouve ($fileCount fichiers)"
        
        # Verifier si le cache est a jour
        Write-Info "   Verification de la fraicheur du cache..."
        $migrationsPath = "backend/migrations"
        if (Test-Path $migrationsPath) {
            $latestMigration = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | 
                Sort-Object LastWriteTime -Descending | 
                Select-Object -First 1
            
            if ($latestMigration) {
                $cacheTime = (Get-ChildItem -Path $sqlxPath -Recurse | 
                    Sort-Object LastWriteTime -Descending | 
                    Select-Object -First 1).LastWriteTime
                
                if ($latestMigration.LastWriteTime -gt $cacheTime) {
                    Write-Warning "[!] Le cache SQLx semble obsolete (migrations plus recentes)"
                    Write-Info "   Regeneration recommandee: cargo sqlx prepare -- --lib"
                }
            }
        }
    }
    
    return $true
}

# Builder l'image Docker
function Build-DockerImage {
    Write-Info "[*] Build de l'image Docker..."
    
    Push-Location "backend"
    
    try {
        $imageName = "yukpomnang-backend:latest"
        $buildArgs = @()
        
        if ($SkipCache) {
            $buildArgs += "--no-cache"
            Write-Info "   Build sans cache (plus long mais plus propre)"
        }
        
        Write-Info "   Image: $imageName"
        Write-Info "   Dockerfile: Dockerfile"
        Write-Info "   Build en cours... (cela peut prendre plusieurs minutes)"
        Write-Info "   Les erreurs detaillees seront affichees ci-dessous:"
        Write-Host ""
        
        # Executer docker build et afficher en temps reel
        Write-Host ""
        Write-Host "=== DEBUT DU BUILD DOCKER ===" -ForegroundColor Cyan
        Write-Host ""
        
        # Executer docker build et afficher directement
        & docker build -t $imageName -f Dockerfile . $buildArgs
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-ErrorMsg "[ERREUR] Le build Docker a echoue (code: $LASTEXITCODE)"
            Write-ErrorMsg ""
            Write-ErrorMsg "   Pour voir toutes les erreurs, lancez manuellement:"
            Write-ErrorMsg "   cd backend"
            Write-ErrorMsg "   docker build -t $imageName -f Dockerfile ."
            throw "Echec du build Docker"
        }
        
        Write-Host ""
        Write-Host "=== FIN DU BUILD DOCKER ===" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Success "[OK] Image Docker buildee avec succes: $imageName"
        
        # Afficher la taille de l'image
        $imageSize = docker images $imageName --format "{{.Size}}"
        Write-Info "   Taille: $imageSize"
        
        return $true
    } catch {
        Write-ErrorMsg "[ERREUR] Erreur lors du build Docker: $_"
        return $false
    } finally {
        Pop-Location
    }
}

# Tester l'image Docker
function Test-DockerImage {
    Write-Info "[*] Test de l'image Docker..."
    
    $imageName = "yukpomnang-backend:latest"
    
    try {
        # Verifier que l'image existe
        docker images $imageName --format "{{.Repository}}:{{.Tag}}" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "[ERREUR] Image $imageName non trouvee"
            return $false
        }
        
        Write-Success "[OK] Image trouvee: $imageName"
        
        # Tester que l'image peut demarrer (sans vraiment lancer le serveur)
        Write-Info "   Verification de la structure de l'image..."
        
        $testResult = docker run --rm $imageName ls -la /app 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[OK] Structure de l'image valide"
            Write-Info "   Contenu de /app:"
            $testResult | Select-Object -First 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        } else {
            Write-Warning "[!] Probleme lors de la verification de l'image"
        }
        
        # Verifier que l'executable existe (en bypasseant l'entrypoint pour eviter le script de demarrage)
        $executableCheck = docker run --rm --entrypoint="" $imageName test -f /app/yukpomnang_backend 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[OK] Executable trouve: /app/yukpomnang_backend"
            # Afficher la taille de l'executable
            $sizeCheck = docker run --rm --entrypoint="" $imageName ls -lh /app/yukpomnang_backend 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Info "   Taille: $($sizeCheck -split '\s+' | Select-Object -Index 4)"
            }
        } else {
            Write-ErrorMsg "[ERREUR] Executable non trouve dans l'image"
            return $false
        }
        
        Write-Success "[OK] Tests de l'image reussis"
        return $true
        
    } catch {
        Write-ErrorMsg "[ERREUR] Erreur lors des tests: $_"
        return $false
    }
}

# Fonction principale
function Main {
    Write-Host "Build Docker Backend - Yukpomnang" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Verifier Docker
    if (-not (Test-Docker)) {
        exit 1
    }
    
    Write-Host ""
    
    # Verifier le cache SQLx
    # Verifier Blender (OBLIGATOIRE)
    $blenderOk = Test-Blender
    if (-not $blenderOk) {
        Write-ErrorMsg "[ERREUR] Blender est requis pour le build Docker"
        exit 1
    }
    
    $sqlxCacheOk = Test-SqlxCache
    if (-not $sqlxCacheOk) {
        Write-Warning "[!] Le build peut echouer sans cache SQLx valide"
        $continue = Read-Host "Continuer quand meme ? (o/n)"
        if ($continue -ne "o" -and $continue -ne "O" -and $continue -ne "oui") {
            exit 1
        }
    } else {
        # Cache existe mais peut etre obsolete - c'est OK pour le build
        Write-Info "   Le cache SQLx sera utilise pour le build (mode offline)"
    }
    
    Write-Host ""
    
    # Builder l'image
    if (-not (Build-DockerImage)) {
        exit 1
    }
    
    Write-Host ""
    
    # Tester l'image si demande
    if ($Test) {
        if (-not (Test-DockerImage)) {
            Write-Warning "[!] Tests echoues, mais l'image a ete buildee"
        }
    }
    
    Write-Host ""
    Write-Success "[OK] Build termine avec succes !"
    Write-Host ""
    Write-Info "Prochaines etapes:"
    Write-Host "   1. Tester l'image localement (optionnel):"
    Write-Host "      docker run --rm -p 8080:8080 yukpomnang-backend:latest" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Deployer sur AWS:"
    Write-Host "      .\scripts\deploy-aws.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Ou mettre a jour uniquement l'image sur AWS:"
    Write-Host "      .\scripts\deploy-aws.ps1 -Action update" -ForegroundColor Gray
    Write-Host ""
}

# Execution
try {
    Main
} catch {
    Write-ErrorMsg "[ERREUR] Erreur fatale: $_"
    exit 1
}
