# Script de monitoring du déploiement
Write-Host "=== MONITORING DEPLOIEMENT YUKPOMNANG ===" -ForegroundColor Magenta
Write-Host "Heure: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "URL Backend: https://yukpomnang.onrender.com" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "https://yukpomnang.onrender.com"
$attempts = 0
$maxAttempts = 20

while ($attempts -lt $maxAttempts) {
    $attempts++
    Write-Host "[$attempts/$maxAttempts] Test de connectivite..." -ForegroundColor White
    
    try {
        # Test avec timeout plus court
        $response = Invoke-WebRequest -Uri "$backendUrl/" -Method GET -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "*** SUCCESS *** Backend accessible!" -ForegroundColor Green
            Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Content: $($response.Content)" -ForegroundColor Gray
            Write-Host "Headers CORS:" -ForegroundColor Yellow
            
            # Vérifier les headers CORS
            $corsHeaders = @(
                "access-control-allow-origin",
                "access-control-allow-methods", 
                "access-control-allow-headers"
            )
            
            foreach ($header in $corsHeaders) {
                $value = $response.Headers[$header]
                if ($value) {
                    Write-Host "  $header`: $value" -ForegroundColor Green
                } else {
                    Write-Host "  $header`: MANQUANT" -ForegroundColor Red
                }
            }
            
            Write-Host "`n*** DEPLOIEMENT REUSSI ***" -ForegroundColor Green
            break
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host "FAILED: $errorMsg" -ForegroundColor Red
        
        if ($errorMsg -like "*404*") {
            Write-Host "  -> Backend en cours de deploiement..." -ForegroundColor Yellow
        } elseif ($errorMsg -like "*timeout*") {
            Write-Host "  -> Timeout - backend peut-etre surcharge..." -ForegroundColor Yellow
        } elseif ($errorMsg -like "*Failed to fetch*" -or $errorMsg -like "*connection*") {
            Write-Host "  -> Probleme de connectivite reseau..." -ForegroundColor Yellow
        }
    }
    
    if ($attempts -lt $maxAttempts) {
        Write-Host "Attente 30 secondes..." -ForegroundColor Gray
        Start-Sleep -Seconds 30
    }
}

if ($attempts -eq $maxAttempts) {
    Write-Host "`n*** TIMEOUT *** Deploiement non termine apres $maxAttempts tentatives" -ForegroundColor Red
    Write-Host "Consultez les logs Render pour plus d'informations." -ForegroundColor Yellow
}

Write-Host "`n=== FIN DU MONITORING ===" -ForegroundColor Magenta
