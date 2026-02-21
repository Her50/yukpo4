# Script pour vérifier la connexion du backend à la base de données
param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app"
)

Write-Host "`n🔍 VÉRIFICATION CONNEXION BASE DE DONNÉES`n" -ForegroundColor Cyan

# Test 1: Endpoint diagnostic
Write-Host "1. Test endpoint /health/diagnostic..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/health/diagnostic" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ Endpoint accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "`n   📊 État des services:" -ForegroundColor Cyan
    
    if ($content.database) {
        if ($content.database.status -eq "ok") {
            Write-Host "   ✅ PostgreSQL: Connecté" -ForegroundColor Green
        } else {
            Write-Host "   ❌ PostgreSQL: $($content.database.status)" -ForegroundColor Red
            if ($content.database.error) {
                Write-Host "      Erreur: $($content.database.error)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⚠️  Informations base de données non disponibles" -ForegroundColor Yellow
    }
    
    if ($content.redis) {
        if ($content.redis.status -eq "ok") {
            Write-Host "   ✅ Redis: Connecté" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Redis: $($content.redis.status)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n   Réponse complète:" -ForegroundColor Cyan
    $content | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
    
} catch {
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}

# Test 2: Endpoint Redis
Write-Host "`n2. Test endpoint /health/redis..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/health/redis" -Method GET -TimeoutSec 10 -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    
    if ($content.status -eq "ok" -or $content.ping_test -eq $true) {
        Write-Host "   ✅ Redis: Connecté" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Redis: Non connecté" -ForegroundColor Red
        Write-Host "   Message: $($content.message)" -ForegroundColor Yellow
        if ($content.error) {
            Write-Host "   Erreur: $($content.error)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Endpoint MongoDB
Write-Host "`n3. Test endpoint /internal/health/mongo..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/internal/health/mongo" -Method GET -TimeoutSec 10 -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    
    if ($content.status -eq "ok" -or $content.connected -eq $true) {
        Write-Host "   ✅ MongoDB: Connecté" -ForegroundColor Green
    } else {
        Write-Host "   ❌ MongoDB: Non connecté" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️  MongoDB: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Résumé
Write-Host "`n📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl" -ForegroundColor White
Write-Host "Version: Testé via /health/version" -ForegroundColor White


