# Script pour analyser les logs et vérifier si le matching de coursier fonctionne
# Usage: .\scripts\analyze_matching_logs.ps1 -LogFile "path/to/logs.json"

param(
    [Parameter(Mandatory=$false)]
    [string]$LogFile = ""
)

Write-Host "🔍 Analyse des logs pour vérifier le matching de coursier..." -ForegroundColor Cyan

# Indicateurs à rechercher
$indicators = @{
    "DeliveryMatchingWorker" = @(
        "DeliveryMatchingWorker",
        "livraison\(s\) retraitées",
        "Aucune livraison à traiter",
        "Cache actif"
    )
    "DeliveryMatchingQueue" = @(
        "delivery_matching_queue",
        "status IN.*queued.*searching",
        "next_attempt_at"
    )
    "MatchingCandidates" = @(
        "list_matching_candidates",
        "find_nearby_couriers",
        "courier_availability_snapshots",
        "ST_Distance"
    )
    "MatchingService" = @(
        "DeliveryMatching",
        "Cache hit",
        "Cache miss",
        "Tentative échouée",
        "Matching réussi"
    )
    "MatchingErrors" = @(
        "error.*matching",
        "failed.*matching",
        "timeout.*matching"
    )
}

$results = @{
    "DeliveryMatchingWorker" = $false
    "DeliveryMatchingQueue" = $false
    "MatchingCandidates" = $false
    "MatchingService" = $false
    "MatchingErrors" = $false
}

if ($LogFile -and (Test-Path $LogFile)) {
    Write-Host "📄 Lecture du fichier de logs: $LogFile" -ForegroundColor Gray
    $logContent = Get-Content $LogFile -Raw
} else {
    Write-Host "⚠️ Aucun fichier de logs fourni. Analyse des indicateurs dans les logs récents..." -ForegroundColor Yellow
    Write-Host "💡 Pour analyser un fichier de logs, utilisez: .\scripts\analyze_matching_logs.ps1 -LogFile 'path/to/logs.json'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 Résumé des indicateurs à rechercher:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($category in $indicators.Keys) {
        Write-Host "  ✅ $category" -ForegroundColor Green
        foreach ($pattern in $indicators[$category]) {
            Write-Host "     - $pattern" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "🔍 Pour vérifier manuellement, recherchez dans vos logs:" -ForegroundColor Yellow
    Write-Host "   1. Logs du worker: '[DeliveryMatchingWorker]'" -ForegroundColor White
    Write-Host "   2. Requêtes SQL: 'delivery_matching_queue'" -ForegroundColor White
    Write-Host "   3. Requêtes de matching: 'list_matching_candidates' ou 'find_nearby_couriers'" -ForegroundColor White
    Write-Host "   4. Logs du service: '[DeliveryMatching]'" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Si aucun de ces indicateurs n'est présent, le matching ne fonctionne probablement pas." -ForegroundColor Yellow
    exit 0
}

# Analyser les logs
Write-Host "🔍 Analyse en cours..." -ForegroundColor Cyan

foreach ($category in $indicators.Keys) {
    $found = $false
    foreach ($pattern in $indicators[$category]) {
        if ($logContent -match $pattern) {
            $found = $true
            break
        }
    }
    $results[$category] = $found
    
    if ($found) {
        Write-Host "  ✅ $category: Trouvé" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $category: Non trouvé" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📊 Résumé de l'analyse:" -ForegroundColor Cyan
Write-Host ""

$allFound = $true
foreach ($category in $results.Keys) {
    if ($results[$category]) {
        Write-Host "  ✅ $category" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $category" -ForegroundColor Red
        $allFound = $false
    }
}

Write-Host ""

if ($allFound) {
    Write-Host "✅ Le matching de coursier semble fonctionner correctement!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Le matching de coursier ne semble pas fonctionner ou n'est pas utilisé." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Vérifications à faire:" -ForegroundColor Cyan
    Write-Host "   1. Vérifier que le worker est démarré (ligne 737 de main.rs)" -ForegroundColor White
    Write-Host "   2. Vérifier qu'il y a des livraisons dans delivery_matching_queue" -ForegroundColor White
    Write-Host "   3. Vérifier le niveau de log (RUST_LOG=debug pour plus de détails)" -ForegroundColor White
    Write-Host "   4. Vérifier qu'il y a des coursiers disponibles (courier_availability_snapshots)" -ForegroundColor White
}

