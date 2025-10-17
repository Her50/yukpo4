# Lancement automatique avec monitoring

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  LANCEMENT AUTOMATIQUE + MONITORING" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Vérifier le répertoire
$currentDir = Get-Location
if ($currentDir.Path -notlike "*\mobile") {
    Write-Host "[ERREUR] Mauvais répertoire!" -ForegroundColor Red
    Write-Host "Actuel: $currentDir" -ForegroundColor Yellow
    Write-Host "Doit être: ...\yukpomnang\mobile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Correction..." -ForegroundColor Cyan
    
    # Tenter de corriger
    if (Test-Path "mobile") {
        cd mobile
        Write-Host "[OK] Répertoire corrigé: $(Get-Location)" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Impossible de trouver le répertoire mobile/" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/3] Vérification Metro..." -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($metroProc) {
    Write-Host "  [OK] Metro déjà actif - $($metroProc.Count) processus" -ForegroundColor Green
    Write-Host "  [OK] Serveur: http://localhost:8081" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Metro non actif" -ForegroundColor Yellow
    Write-Host "  [INFO] Lancement de Metro en arrière-plan..." -ForegroundColor Cyan
    
    # Lancer Metro en arrière-plan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start" -WindowStyle Minimized
    
    Write-Host "  [OK] Metro lancé en arrière-plan" -ForegroundColor Green
    Write-Host "  [INFO] Attente du démarrage (15 secondes)..." -ForegroundColor Gray
    Start-Sleep -Seconds 15
    
    # Vérifier que Metro a démarré
    $metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($metroProc) {
        Write-Host "  [OK] Metro démarré avec succès!" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Metro n'a pas démarré. Monitoring continuera..." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[2/3] Ouverture interface web..." -ForegroundColor Yellow
try {
    Start-Process "http://localhost:8081"
    Write-Host "  [OK] Interface web ouverte" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Impossible d'ouvrir automatiquement" -ForegroundColor Yellow
    Write-Host "  [INFO] Ouvrez manuellement: http://localhost:8081" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[3/3] Démarrage du monitoring automatique..." -ForegroundColor Yellow
Write-Host "  [INFO] Le monitoring va détecter automatiquement:" -ForegroundColor Cyan
Write-Host "    - Erreurs critiques" -ForegroundColor Gray
Write-Host "    - Avertissements" -ForegroundColor Gray
Write-Host "    - Fichiers manquants" -ForegroundColor Gray
Write-Host "    - Problèmes de connexion" -ForegroundColor Gray
Write-Host "    - État de Metro" -ForegroundColor Gray
Write-Host ""

# Lancer le monitoring
powershell -ExecutionPolicy Bypass -File monitor-auto.ps1

