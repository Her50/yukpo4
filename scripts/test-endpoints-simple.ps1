$url = "https://yukpo-backend-376093909298.europe-west1.run.app"
Write-Host "`n🔍 RAPPORT DES ENDPOINTS MANQUANTS`n" -ForegroundColor Cyan

$tests = @(
    "/healthz",
    "/api/services",
    "/api/services/recent",
    "/api/products",
    "/api/search",
    "/api/search/direct",
    "/api/ia/chat",
    "/api/ia/auto",
    "/api/hopitaux",
    "/api/analytics/provider",
    "/api/recommendations",
    "/api/upload/health"
)

foreach ($t in $tests) {
    Write-Host "$t" -ForegroundColor Yellow -NoNewline
    try {
        $r = Invoke-WebRequest -Uri "$url$t" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-Host " -> OK: $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $c = $_.Exception.Response.StatusCode.value__
        if ($c -eq 404) {
            Write-Host " -> 404 (Non trouvé)" -ForegroundColor Red
        } elseif ($c -eq 401 -or $c -eq 403) {
            Write-Host " -> $c (Auth requise - endpoint existe)" -ForegroundColor Cyan
        } elseif ($c -eq 500) {
            Write-Host " -> $c (Erreur serveur - endpoint existe)" -ForegroundColor Yellow
        } else {
            Write-Host " -> $c" -ForegroundColor Gray
        }
    }
}


