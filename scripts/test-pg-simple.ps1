$url = "https://yukpo-backend-376093909298.europe-west1.run.app"

Write-Host "`n🔍 VÉRIFICATION CONNEXION POSTGRESQL`n" -ForegroundColor Cyan

try {
    $r = Invoke-RestMethod -Uri "$url/health/diagnostic" -Method GET -TimeoutSec 15
    
    Write-Host "📊 État PostgreSQL:" -ForegroundColor Yellow
    if ($r.database) {
        if ($r.database.status -eq "operational") {
            Write-Host "  ✅ PostgreSQL: Connecté" -ForegroundColor Green
            Write-Host "  Temps de requête: $($r.database.query_time_ms) ms" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ PostgreSQL: $($r.database.status)" -ForegroundColor Red
            if ($r.database.error) {
                Write-Host "  Erreur: $($r.database.error)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠️  PostgreSQL non présent dans la réponse" -ForegroundColor Yellow
        Write-Host "  (Le backend doit être redéployé avec les modifications)" -ForegroundColor Gray
    }
    
    Write-Host "`n📊 État Redis:" -ForegroundColor Yellow
    if ($r.redis.status -eq "operational") {
        Write-Host "  ✅ Redis: Connecté" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Redis: $($r.redis.status)" -ForegroundColor Red
        if ($r.redis.error) {
            Write-Host "  Erreur: $($r.redis.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n📊 Résumé:" -ForegroundColor Yellow
    Write-Host "  $($r.summary.overall_status)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}


