# Script pour vérifier les endpoints manquants (404)
# Teste différentes variantes de chemins pour trouver les bons endpoints

param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app"
)

$ErrorActionPreference = "Continue"

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = 10
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Content = $response.Content
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode.value__
        }
        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
    }
}

Write-Host "`n🔍 VÉRIFICATION DES ENDPOINTS MANQUANTS" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Endpoints à tester avec différentes variantes
$endpointsToTest = @(
    @{
        Name = "Healthz"
        Paths = @("/healthz", "/health", "/api/health", "/api/healthz")
    },
    @{
        Name = "Services List"
        Paths = @(
            "/api/services",
            "/api/services/list",
            "/api/services/all",
            "/api/services/search"
        )
    },
    @{
        Name = "Products List"
        Paths = @(
            "/api/products",
            "/api/products/list",
            "/api/products/all"
        )
    },
    @{
        Name = "Search"
        Paths = @(
            "/api/search",
            "/api/search/direct",
            "/api/search/products",
            "/api/autocomplete/search-products"
        )
    },
    @{
        Name = "IA Chat"
        Paths = @(
            "/api/ia/chat",
            "/api/ia/auto",
            "/api/chat/ia",
            "/api/ai/chat"
        )
    },
    @{
        Name = "Hôpitaux IA Recommendations"
        Paths = @(
            "/api/hopitaux/ai/recommendations",
            "/api/hopitaux/ai/search-pathology",
            "/api/hopitaux/search",
            "/api/hopitaux"
        )
    },
    @{
        Name = "Banque de Sang"
        Paths = @(
            "/api/banque-sang",
            "/api/banque/sang",
            "/api/blood-bank",
            "/api/specialized/blood-bank"
        )
    },
    @{
        Name = "Analytics Overview"
        Paths = @(
            "/api/analytics/overview",
            "/api/analytics/provider",
            "/api/analytics/video",
            "/api/analytics"
        )
    },
    @{
        Name = "Recommendations"
        Paths = @(
            "/api/recommendations",
            "/api/recommendations/products",
            "/api/products/popular",
            "/api/recommendations/user"
        )
    },
    @{
        Name = "GCP Storage Upload"
        Paths = @(
            "/api/upload/health",
            "/api/upload",
            "/api/media/upload",
            "/api/uploads/health"
        )
    }
)

$foundEndpoints = @()
$notFoundEndpoints = @()

foreach ($endpointGroup in $endpointsToTest) {
    Write-Host "`n📋 Test: $($endpointGroup.Name)" -ForegroundColor Yellow
    Write-Host "-----------------------------------" -ForegroundColor Yellow
    
    $found = $false
    foreach ($path in $endpointGroup.Paths) {
        $fullUrl = "$BackendUrl$path"
        Write-Host "  Test: $path ... " -NoNewline -ForegroundColor Gray
        
        $result = Test-Endpoint -Url $fullUrl
        
        if ($result.Success -and $result.StatusCode -eq 200) {
            Write-Host "✅ OK (200)" -ForegroundColor Green
            $foundEndpoints += @{
                Name = $endpointGroup.Name
                Path = $path
                Status = $result.StatusCode
            }
            $found = $true
            break
        } elseif ($result.StatusCode -eq 401 -or $result.StatusCode -eq 403) {
            Write-Host "🔒 Protégé ($($result.StatusCode))" -ForegroundColor Cyan
            $foundEndpoints += @{
                Name = $endpointGroup.Name
                Path = $path
                Status = $result.StatusCode
                Note = "Auth requise"
            }
            $found = $true
            break
        } elseif ($result.StatusCode -eq 400) {
            Write-Host "⚠️  Validation requise ($($result.StatusCode))" -ForegroundColor Yellow
            $foundEndpoints += @{
                Name = $endpointGroup.Name
                Path = $path
                Status = $result.StatusCode
                Note = "Validation requise"
            }
            $found = $true
            break
        } elseif ($result.StatusCode -eq 404) {
            Write-Host "❌ 404" -ForegroundColor Red
        } elseif ($result.StatusCode -eq 405) {
            Write-Host "⚠️  Méthode non autorisée ($($result.StatusCode))" -ForegroundColor Yellow
            $foundEndpoints += @{
                Name = $endpointGroup.Name
                Path = $path
                Status = $result.StatusCode
                Note = "Méthode incorrecte"
            }
        } else {
            Write-Host "❌ $($result.StatusCode)" -ForegroundColor Red
        }
    }
    
    if (-not $found) {
        $notFoundEndpoints += $endpointGroup.Name
        Write-Host "  ⚠️  Aucune variante trouvée pour $($endpointGroup.Name)" -ForegroundColor Yellow
    }
}

# Résumé
Write-Host "`n📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan

Write-Host "`n✅ Endpoints trouvés:" -ForegroundColor Green
foreach ($endpoint in $foundEndpoints) {
    $statusInfo = if ($endpoint.Note) { " ($($endpoint.Note))" } else { "" }
    Write-Host "  - $($endpoint.Name): $($endpoint.Path) [$($endpoint.Status)]$statusInfo" -ForegroundColor White
}

if ($notFoundEndpoints.Count -gt 0) {
    Write-Host "`n❌ Endpoints non trouvés:" -ForegroundColor Red
    foreach ($endpoint in $notFoundEndpoints) {
        Write-Host "  - $endpoint" -ForegroundColor White
    }
}

Write-Host "`nTotal trouvés: $($foundEndpoints.Count)" -ForegroundColor Green
Write-Host "Total non trouvés: $($notFoundEndpoints.Count)" -ForegroundColor $(if ($notFoundEndpoints.Count -gt 0) { "Red" } else { "Green" })


