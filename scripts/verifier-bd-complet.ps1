# Script complet pour vérifier la connexion à la base de données
param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app"
)

Write-Host "`n🔍 VÉRIFICATION COMPLÈTE CONNEXION BASE DE DONNÉES`n" -ForegroundColor Cyan

# Test 1: Endpoint diagnostic (avec nouveau test PostgreSQL)
Write-Host "1. Test endpoint /health/diagnostic (avec test PostgreSQL)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health/diagnostic" -Method GET -TimeoutSec 15
    Write-Host "   ✅ Endpoint accessible" -ForegroundColor Green
    
    Write-Host "`n   📊 État PostgreSQL:" -ForegroundColor Cyan
    if ($response.database) {
        if ($response.database.status -eq "operational") {
            Write-Host "   ✅ PostgreSQL: Connecté" -ForegroundColor Green
            Write-Host "      Temps de requête: $($response.database.query_time_ms) ms" -ForegroundColor Gray
        } else {
            Write-Host "   ❌ PostgreSQL: $($response.database.status)" -ForegroundColor Red
            if ($response.database.error) {
                Write-Host "      Erreur: $($response.database.error)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⚠️  Informations PostgreSQL non disponibles (backend pas encore mis à jour)" -ForegroundColor Yellow
    }
    
    Write-Host "`n   📊 État Redis:" -ForegroundColor Cyan
    if ($response.redis.status -eq "operational") {
        Write-Host "   ✅ Redis: Connecté" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Redis: $($response.redis.status)" -ForegroundColor Red
        if ($response.redis.error) {
            Write-Host "      Erreur: $($response.redis.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n   📊 Résumé global:" -ForegroundColor Cyan
    Write-Host "   $($response.summary.overall_status)" -ForegroundColor $(if($response.summary.overall_status -match "✅"){"Green"}elseif($response.summary.overall_status -match "⚠️"){"Yellow"}else{"Red"})
    
    Write-Host "`n   Réponse JSON complète:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
    
} catch {
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}

# Test 2: Test direct de connexion via requête simple
Write-Host "`n2. Test direct connexion PostgreSQL (si backend mis à jour)..." -ForegroundColor Yellow
Write-Host "   (Ce test nécessite que le backend soit redéployé avec les modifications)" -ForegroundColor Gray


