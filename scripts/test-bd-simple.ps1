$url = "https://yukpo-backend-376093909298.europe-west1.run.app"

Write-Host "`n🔍 VÉRIFICATION CONNEXION BASE DE DONNÉES`n" -ForegroundColor Cyan

# Test diagnostic
Write-Host "Test /health/diagnostic..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$url/health/diagnostic" -Method GET -TimeoutSec 10
    $json = $r.Content | ConvertFrom-Json
    
    Write-Host "Status HTTP: $($r.StatusCode)" -ForegroundColor Green
    Write-Host "`nContenu:" -ForegroundColor Cyan
    
    if ($json.database) {
        $dbStatus = $json.database.status
        if ($dbStatus -eq "ok") {
            Write-Host "✅ PostgreSQL: Connecté" -ForegroundColor Green
        } else {
            Write-Host "❌ PostgreSQL: $dbStatus" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  Info DB non disponible" -ForegroundColor Yellow
    }
    
    Write-Host "`nRéponse JSON complète:" -ForegroundColor Cyan
    $json | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}


