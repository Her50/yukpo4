# Test des Optimisations de Performance Yukpo
# Teste le cache et les améliorations de vitesse

Write-Host "🚀 Test des Optimisations de Performance Yukpo" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Vérifier que le backend est en cours d'exécution
Write-Host "`n📡 Vérification du backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible. Démarrez-le d'abord avec: cargo run" -ForegroundColor Red
    exit 1
}

# Test 1: Performance du cache
Write-Host "`n🧪 TEST 1: Performance du cache" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$testData = @{
    texte = "Je vends des vêtements pour enfants, boutique en ligne, livraison gratuite"
    intention = "creation_service"
    base64_image = @()
} | ConvertTo-Json

# Premier appel (sans cache)
Write-Host "📞 Premier appel (sans cache)..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $testData -ContentType "application/json" -TimeoutSec 30
    $firstCallTime = (Get-Date) - $startTime
    $firstCallMs = $firstCallTime.TotalMilliseconds
    Write-Host "✅ Premier appel réussi en $([math]::Round($firstCallMs))ms" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur premier appel: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Pause courte
Start-Sleep -Seconds 2

# Deuxième appel (avec cache)
Write-Host "⚡ Deuxième appel (avec cache)..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $testData -ContentType "application/json" -TimeoutSec 30
    $secondCallTime = (Get-Date) - $startTime
    $secondCallMs = $secondCallTime.TotalMilliseconds
    Write-Host "✅ Deuxième appel réussi en $([math]::Round($secondCallMs))ms" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur deuxième appel: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Calcul des améliorations
$improvement = (($firstCallMs - $secondCallMs) / $firstCallMs) * 100
$speedup = if ($secondCallMs -gt 0) { $firstCallMs / $secondCallMs } else { [double]::PositiveInfinity }
$cacheWorking = $secondCallMs -lt ($firstCallMs * 0.8)

Write-Host "`n📊 RÉSULTATS DU CACHE:" -ForegroundColor Magenta
Write-Host "Premier appel: $([math]::Round($firstCallMs))ms" -ForegroundColor White
Write-Host "Deuxième appel: $([math]::Round($secondCallMs))ms" -ForegroundColor White
Write-Host "Amélioration: $([math]::Round($improvement, 1))% plus rapide" -ForegroundColor White
Write-Host "Accélération: $([math]::Round($speedup, 1))x plus rapide" -ForegroundColor White

if ($cacheWorking) {
    Write-Host "🎉 Cache fonctionne correctement!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Cache ne semble pas fonctionner (amélioration < 20%)" -ForegroundColor Yellow
}

# Test 2: Requêtes multiples
Write-Host "`n🔄 TEST 2: Requêtes multiples" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

$times = @()
$successCount = 0

for ($i = 1; $i -le 3; $i++) {
    Write-Host "Test #$i..." -ForegroundColor Yellow
    
    $testData = @{
        texte = "Je vends mon ordinateur portable gaming RTX 4070, test #$i"
        intention = "creation_service"
        base64_image = @()
    } | ConvertTo-Json
    
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $testData -ContentType "application/json" -TimeoutSec 30
        $callTime = (Get-Date) - $startTime
        $callMs = $callTime.TotalMilliseconds
        $times += $callMs
        $successCount++
        Write-Host "  ✅ Réussi en $([math]::Round($callMs))ms" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Échec: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    if ($i -lt 3) {
        Start-Sleep -Seconds 1
    }
}

# Analyse des résultats
if ($times.Count -gt 0) {
    $avgTime = ($times | Measure-Object -Average).Average
    $minTime = ($times | Measure-Object -Minimum).Minimum
    $maxTime = ($times | Measure-Object -Maximum).Maximum
    
    Write-Host "`n📊 ANALYSE DES PERFORMANCES:" -ForegroundColor Magenta
    Write-Host "Tests réussis: $successCount/3" -ForegroundColor White
    Write-Host "Temps moyen: $([math]::Round($avgTime))ms" -ForegroundColor White
    Write-Host "Min/Max: $([math]::Round($minTime))ms / $([math]::Round($maxTime))ms" -ForegroundColor White
    
    # Évaluation
    if ($avgTime -lt 5000) {
        Write-Host "🎉 EXCELLENT: Temps moyen < 5s" -ForegroundColor Green
    } elseif ($avgTime -lt 10000) {
        Write-Host "✅ BON: Temps moyen < 10s" -ForegroundColor Green
    } elseif ($avgTime -lt 15000) {
        Write-Host "⚠️ MOYEN: Temps moyen < 15s" -ForegroundColor Yellow
    } else {
        Write-Host "❌ LENT: Temps moyen > 15s" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Aucun test réussi" -ForegroundColor Red
}

# Test 3: Test Python si disponible
Write-Host "`n🐍 TEST 3: Test Python complet" -ForegroundColor Cyan
Write-Host "-----------------------------" -ForegroundColor Cyan

if (Test-Path "benchmark_performance.py") {
    Write-Host "Exécution du benchmark Python..." -ForegroundColor Yellow
    try {
        python benchmark_performance.py
    } catch {
        Write-Host "❌ Erreur exécution Python: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Fichier benchmark_performance.py non trouvé" -ForegroundColor Yellow
}

Write-Host "`n✅ Tests terminés!" -ForegroundColor Green 