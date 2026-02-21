# Test des endpoints manquants
$url = "https://yukpo-backend-376093909298.europe-west1.run.app"

Write-Host "`n🔍 RAPPORT DÉTAILLÉ DES ENDPOINTS MANQUANTS`n" -ForegroundColor Cyan

$endpoints = @(
    @{Path="/healthz"; Method="GET"},
    @{Path="/api/services"; Method="GET"},
    @{Path="/api/services/recent"; Method="GET"},
    @{Path="/api/products"; Method="GET"},
    @{Path="/api/search"; Method="GET"},
    @{Path="/api/search/direct"; Method="POST"; Body='{"query":"test"}'},
    @{Path="/api/ia/chat"; Method="POST"; Body='{"message":"test"}'},
    @{Path="/api/ia/auto"; Method="POST"; Body='{"query":"test"}'},
    @{Path="/api/hopitaux/ai/recommendations"; Method="POST"; Body='{"symptoms":["fievre"]}'},
    @{Path="/api/hopitaux"; Method="GET"},
    @{Path="/api/banque-sang"; Method="GET"},
    @{Path="/api/analytics/overview"; Method="GET"},
    @{Path="/api/analytics/provider"; Method="GET"},
    @{Path="/api/recommendations"; Method="GET"},
    @{Path="/api/upload/health"; Method="GET"}
)

foreach ($ep in $endpoints) {
    Write-Host "Test: $($ep.Path) [$($ep.Method)]" -ForegroundColor Yellow
    try {
        $params = @{
            Uri = "$url$($ep.Path)"
            Method = $ep.Method
            TimeoutSec = 10
            ErrorAction = "Stop"
        }
        if ($ep.Body) {
            $params.Body = $ep.Body
            $params.ContentType = "application/json"
        }
        $r = Invoke-WebRequest @params
        Write-Host "  ✅ Status: $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        $color = if ($code -eq 404) { "Red" } elseif ($code -eq 401 -or $code -eq 403) { "Cyan" } elseif ($code -eq 500) { "Yellow" } else { "Gray" }
        Write-Host "  Status: $code" -ForegroundColor $color
        if ($code -eq 401 -or $code -eq 403) {
            Write-Host "    → Endpoint existe mais nécessite authentification" -ForegroundColor Gray
        } elseif ($code -eq 500) {
            Write-Host "    → Endpoint existe mais erreur serveur" -ForegroundColor Gray
        } elseif ($code -eq 404) {
            Write-Host "    → Endpoint non trouvé" -ForegroundColor Gray
        }
    }
    Write-Host ""
}


