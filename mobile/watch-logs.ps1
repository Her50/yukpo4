# Surveillance continue des logs Metro

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SURVEILLANCE LOGS METRO CONTINUE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

$iteration = 0
$lastErrors = 0
$lastWarnings = 0

while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Vérification #$iteration" -ForegroundColor Cyan
    
    # Vérifier Metro
    $metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($metroProc) {
        Write-Host "  [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
        
        # Tester la connexion web
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            Write-Host "  [OK] Interface web accessible (HTTP $($response.StatusCode))" -ForegroundColor Green
            
            # Analyser le contenu de la réponse
            $content = $response.Content
            
            if ($content -match "Metro") {
                Write-Host "  [OK] Metro Bundler opérationnel" -ForegroundColor Green
            }
            
        } catch {
            Write-Host "  [WARN] Interface web: $($_.Exception.Message)" -ForegroundColor Yellow
            $lastWarnings++
        }
        
    } else {
        Write-Host "  [ERREUR] Metro non actif!" -ForegroundColor Red
        $lastErrors++
    }
    
    # Vérifier les fichiers critiques
    $criticalFiles = @("App.tsx", "package.json", "src\utils\jwtDecode.ts")
    $missingCount = 0
    
    foreach ($file in $criticalFiles) {
        if (-not (Test-Path $file)) {
            Write-Host "  [ERREUR] Fichier manquant: $file" -ForegroundColor Red
            $missingCount++
            $lastErrors++
        }
    }
    
    if ($missingCount -eq 0) {
        Write-Host "  [OK] Fichiers critiques présents" -ForegroundColor Green
    }
    
    # Résumé
    Write-Host "  Erreurs totales: $lastErrors" -ForegroundColor $(if ($lastErrors -eq 0) { "Green" } else { "Red" })
    Write-Host "  Avertissements: $lastWarnings" -ForegroundColor $(if ($lastWarnings -eq 0) { "Green" } else { "Yellow" })
    Write-Host ""
    
    # Attendre 5 secondes
    Start-Sleep -Seconds 5
}

