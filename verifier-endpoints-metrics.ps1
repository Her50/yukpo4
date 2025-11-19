# Script de verification des endpoints metriques
$ErrorActionPreference = "Continue"

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$BACKEND_URL = "https://yukpomnang.onrender.com"
$endpoints = @(
    @{Path = "/metrics"; Name = "Metriques principales" },
    @{Path = "/healthz"; Name = "Health check" },
    @{Path = "/internal/metrics/pipeline"; Name = "Metriques pipeline" },
    @{Path = "/metrics/delivery"; Name = "Metriques delivery" },
    @{Path = "/internal/metrics/preview"; Name = "Metriques preview" }
)

Write-Host "Verification des endpoints metriques du backend Render" -ForegroundColor Cyan
Write-Host "URL: $BACKEND_URL" -ForegroundColor Gray
Write-Host ""

$results = @()

foreach ($endpoint in $endpoints) {
    $url = "$BACKEND_URL$($endpoint.Path)"
    Write-Host "Test: $($endpoint.Name) ($($endpoint.Path))" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -ErrorAction Stop
        $status = $response.StatusCode
        $contentLength = $response.Content.Length
        $firstLines = ($response.Content -split "`n" | Select-Object -First 3) -join " | "
        
        Write-Host "   OK Status: $status" -ForegroundColor Green
        Write-Host "   Taille: $contentLength caracteres" -ForegroundColor Gray
        Write-Host "   Premieres lignes: $firstLines" -ForegroundColor Gray
        
        $results += @{
            Endpoint   = $endpoint.Name
            Path       = $endpoint.Path
            Status     = "OK"
            StatusCode = $status
            Size       = $contentLength
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host "   ERREUR: $errorMsg" -ForegroundColor Red
        
        $results += @{
            Endpoint = $endpoint.Name
            Path     = $endpoint.Path
            Status   = "ERROR"
            Error    = $errorMsg
        }
    }
    Write-Host ""
}

Write-Host "Resume:" -ForegroundColor Cyan
Write-Host ""
$results | ForEach-Object {
    $statusColor = if ($_.Status -eq "OK") { "Green" } else { "Red" }
    Write-Host "   $($_.Endpoint): " -NoNewline
    Write-Host "$($_.Status)" -ForegroundColor $statusColor
}

$okCount = ($results | Where-Object { $_.Status -eq "OK" }).Count
$totalCount = $results.Count

Write-Host ""
$color = if ($okCount -eq $totalCount) { "Green" } else { "Yellow" }
Write-Host "Endpoints accessibles: $okCount/$totalCount" -ForegroundColor $color
