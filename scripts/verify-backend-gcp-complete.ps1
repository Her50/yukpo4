# Script de vérification complète du backend dans GCP
# Vérifie toutes les fonctionnalités et services

param(
    [string]$BackendUrl = "http://localhost:8080",
    [switch]$SkipCompilation = $false,
    [switch]$SkipDatabase = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0
$script:Warnings = 0

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [string]$Details = ""
    )
    
    $script:TotalTests++
    if ($Passed) {
        $script:PassedTests++
        Write-Host "✅ [$TestName]" -ForegroundColor Green
        if ($Message) { Write-Host "   $Message" -ForegroundColor Gray }
    } else {
        $script:FailedTests++
        Write-Host "❌ [$TestName]" -ForegroundColor Red
        if ($Message) { Write-Host "   $Message" -ForegroundColor Yellow }
    }
    if ($Details -and $Verbose) {
        Write-Host "   $Details" -ForegroundColor DarkGray
    }
}

function Write-Warning {
    param([string]$Message)
    $script:Warnings++
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
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
        return @{
            Success = $false
            Error = $_.Exception.Message
            StatusCode = $_.Exception.Response.StatusCode.value__
        }
    }
}

Write-Host "`n🔍 VÉRIFICATION COMPLÈTE DU BACKEND GCP" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# ============================================
# 1. VÉRIFICATION DE LA COMPILATION
# ============================================
Write-Host "`n📦 1. VÉRIFICATION DE LA COMPILATION" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

if (-not $SkipCompilation) {
    Write-Host "Compilation du backend..." -ForegroundColor Gray
    Push-Location backend
    try {
        $compileOutput = cargo check 2>&1
        $compileSuccess = $LASTEXITCODE -eq 0
        
        if ($compileSuccess) {
            Write-TestResult -TestName "Compilation" -Passed $true -Message "Backend compile sans erreurs"
        } else {
            $errors = ($compileOutput | Select-String -Pattern "error:").Count
            Write-TestResult -TestName "Compilation" -Passed $false -Message "$errors erreur(s) de compilation"
            if ($Verbose) {
                Write-Host ($compileOutput | Select-Object -Last 20 | Out-String) -ForegroundColor Red
            }
        }
    } catch {
        Write-TestResult -TestName "Compilation" -Passed $false -Message "Erreur lors de la compilation: $_"
    } finally {
        Pop-Location
    }
} else {
    Write-TestResult -TestName "Compilation" -Passed $true -Message "Ignoré (--SkipCompilation)"
}

# ============================================
# 2. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
# ============================================
Write-Host "`n🔐 2. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow

$requiredVars = @(
    "DATABASE_URL",
    "JWT_SECRET"
)

$recommendedVars = @(
    "REDIS_URL",
    "MONGODB_URL",
    "OPENAI_API_KEY",
    "GOOGLE_MAPS_API_KEY"
)

foreach ($var in $requiredVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-TestResult -TestName "Var: $var" -Passed $true -Message "Présente"
    } else {
        Write-TestResult -TestName "Var: $var" -Passed $false -Message "MANQUANTE (critique)"
    }
}

foreach ($var in $recommendedVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-TestResult -TestName "Var: $var" -Passed $true -Message "Présente"
    } else {
        Write-Warning "Variable recommandée manquante: $var"
    }
}

# ============================================
# 3. VÉRIFICATION DES ENDPOINTS DE SANTÉ
# ============================================
Write-Host "`n🏥 3. VÉRIFICATION DES ENDPOINTS DE SANTÉ" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

$healthEndpoints = @(
    @{ Path = "/healthz"; Name = "Healthz Basic" },
    @{ Path = "/health/version"; Name = "Version Info" },
    @{ Path = "/health/diagnostic"; Name = "Diagnostic" },
    @{ Path = "/health/redis"; Name = "Redis Status" },
    @{ Path = "/health/cache"; Name = "Cache Status" },
    @{ Path = "/health/google-maps"; Name = "Google Maps" },
    @{ Path = "/health/geographic-matching"; Name = "Geographic Matching" },
    @{ Path = "/internal/health/mongo"; Name = "MongoDB Health" },
    @{ Path = "/internal/health/pipeline"; Name = "Pipeline Health" }
)

foreach ($endpoint in $healthEndpoints) {
    $result = Test-HttpEndpoint -Url "$BackendUrl$($endpoint.Path)"
    if ($result.Success -and $result.StatusCode -eq 200) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Status: $($result.StatusCode)"
    } else {
        $status = if ($result.StatusCode) { $result.StatusCode } else { "N/A" }
        Write-TestResult -TestName $endpoint.Name -Passed $false -Message "Status: $status - $($result.Error)"
    }
}

# ============================================
# 4. VÉRIFICATION DES CONNEXIONS
# ============================================
Write-Host "`n🔌 4. VÉRIFICATION DES CONNEXIONS" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

if (-not $SkipDatabase) {
    # Test PostgreSQL via endpoint health
    $dbResult = Test-HttpEndpoint -Url "$BackendUrl/health/diagnostic"
    if ($dbResult.Success) {
        $content = $dbResult.Content | ConvertFrom-Json
        if ($content.database -and $content.database.status -eq "ok") {
            Write-TestResult -TestName "PostgreSQL" -Passed $true -Message "Connexion OK"
        } else {
            Write-TestResult -TestName "PostgreSQL" -Passed $false -Message "Connexion échouée"
        }
    } else {
        Write-TestResult -TestName "PostgreSQL" -Passed $false -Message "Impossible de tester"
    }
    
    # Test Redis
    $redisResult = Test-HttpEndpoint -Url "$BackendUrl/health/redis"
    if ($redisResult.Success) {
        $content = $redisResult.Content | ConvertFrom-Json
        if ($content.status -eq "ok" -or $content.ping_test -eq $true) {
            Write-TestResult -TestName "Redis" -Passed $true -Message "Connexion OK"
        } else {
            Write-TestResult -TestName "Redis" -Passed $false -Message "Connexion échouée"
        }
    } else {
        Write-TestResult -TestName "Redis" -Passed $false -Message "Impossible de tester"
    }
    
    # Test MongoDB
    $mongoResult = Test-HttpEndpoint -Url "$BackendUrl/internal/health/mongo"
    if ($mongoResult.Success) {
        $content = $mongoResult.Content | ConvertFrom-Json
        if ($content.status -eq "ok" -or $content.connected -eq $true) {
            Write-TestResult -TestName "MongoDB" -Passed $true -Message "Connexion OK"
        } else {
            Write-TestResult -TestName "MongoDB" -Passed $false -Message "Connexion échouée"
        }
    } else {
        Write-TestResult -TestName "MongoDB" -Passed $false -Message "Impossible de tester"
    }
} else {
    Write-TestResult -TestName "Connexions DB" -Passed $true -Message "Ignoré (--SkipDatabase)"
}

# ============================================
# 5. VÉRIFICATION DES SERVICES IA
# ============================================
Write-Host "`n🤖 5. VÉRIFICATION DES SERVICES IA" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

$aiEndpoints = @(
    @{ Path = "/api/ia/status"; Name = "IA Status" },
    @{ Path = "/api/ia/chat"; Method = "POST"; Body = '{"message":"test"}'; Name = "IA Chat" }
)

foreach ($endpoint in $aiEndpoints) {
    $method = if ($endpoint.Method) { $endpoint.Method } else { "GET" }
    $body = if ($endpoint.Body) { $endpoint.Body } else { $null }
    
    $result = Test-HttpEndpoint -Url "$BackendUrl$($endpoint.Path)" -Method $method -Body $body
    if ($result.Success -and ($result.StatusCode -eq 200 -or $result.StatusCode -eq 201)) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Status: $($result.StatusCode)"
    } else {
        $status = if ($result.StatusCode) { $result.StatusCode } else { "N/A" }
        Write-TestResult -TestName $endpoint.Name -Passed $false -Message "Status: $status"
    }
}

# ============================================
# 6. VÉRIFICATION DES SERVICES SPÉCIALISÉS
# ============================================
Write-Host "`n🏥 6. VÉRIFICATION DES SERVICES SPÉCIALISÉS" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

$specializedEndpoints = @(
    @{ Path = "/api/hopitaux/ai/recommendations"; Method = "POST"; Body = '{"symptoms":["fievre"]}'; Name = "Hôpitaux IA" },
    @{ Path = "/api/pharmacies/ai/interactions"; Method = "POST"; Body = '{"medications":["paracetamol"]}'; Name = "Pharmacies IA" },
    @{ Path = "/api/laboratoires"; Method = "GET"; Name = "Laboratoires" },
    @{ Path = "/api/banque-sang"; Method = "GET"; Name = "Banque de Sang" }
)

foreach ($endpoint in $specializedEndpoints) {
    $method = if ($endpoint.Method) { $endpoint.Method } else { "GET" }
    $body = if ($endpoint.Body) { $endpoint.Body } else { $null }
    
    $result = Test-HttpEndpoint -Url "$BackendUrl$($endpoint.Path)" -Method $method -Body $body
    if ($result.Success -and ($result.StatusCode -eq 200 -or $result.StatusCode -eq 201)) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Status: $($result.StatusCode)"
    } elseif ($result.StatusCode -eq 401 -or $result.StatusCode -eq 403) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Protégé (auth requise) - Status: $($result.StatusCode)"
    } else {
        $status = if ($result.StatusCode) { $result.StatusCode } else { "N/A" }
        Write-TestResult -TestName $endpoint.Name -Passed $false -Message "Status: $status"
    }
}

# ============================================
# 7. VÉRIFICATION DES SERVICES CORE
# ============================================
Write-Host "`n⚙️  7. VÉRIFICATION DES SERVICES CORE" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow

$coreEndpoints = @(
    @{ Path = "/api/services"; Method = "GET"; Name = "Services List" },
    @{ Path = "/api/products"; Method = "GET"; Name = "Products List" },
    @{ Path = "/api/search"; Method = "GET"; Name = "Search" },
    @{ Path = "/api/delivery/public/quote"; Method = "POST"; Body = '{"origin":{"lat":0,"lon":0},"destination":{"lat":0,"lon":0}}'; Name = "Delivery Quote" }
)

foreach ($endpoint in $coreEndpoints) {
    $method = if ($endpoint.Method) { $endpoint.Method } else { "GET" }
    $body = if ($endpoint.Body) { $endpoint.Body } else { $null }
    
    $result = Test-HttpEndpoint -Url "$BackendUrl$($endpoint.Path)" -Method $method -Body $body
    if ($result.Success -and ($result.StatusCode -eq 200 -or $result.StatusCode -eq 201)) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Status: $($result.StatusCode)"
    } elseif ($result.StatusCode -eq 400) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Endpoint actif (validation requise) - Status: $($result.StatusCode)"
    } else {
        $status = if ($result.StatusCode) { $result.StatusCode } else { "N/A" }
        Write-TestResult -TestName $endpoint.Name -Passed $false -Message "Status: $status"
    }
}

# ============================================
# 8. VÉRIFICATION DES FONCTIONNALITÉS AVANCÉES
# ============================================
Write-Host "`n🚀 8. VÉRIFICATION DES FONCTIONNALITÉS AVANCÉES" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow

$advancedEndpoints = @(
    @{ Path = "/api/studio/sessions"; Method = "GET"; Name = "Studio Sessions" },
    @{ Path = "/api/live/sessions"; Method = "GET"; Name = "Live Sessions" },
    @{ Path = "/api/analytics/overview"; Method = "GET"; Name = "Analytics" },
    @{ Path = "/api/recommendations"; Method = "GET"; Name = "Recommendations" }
)

foreach ($endpoint in $advancedEndpoints) {
    $method = if ($endpoint.Method) { $endpoint.Method } else { "GET" }
    $body = if ($endpoint.Body) { $endpoint.Body } else { $null }
    
    $result = Test-HttpEndpoint -Url "$BackendUrl$($endpoint.Path)" -Method $method -Body $body
    if ($result.Success -and ($result.StatusCode -eq 200 -or $result.StatusCode -eq 201)) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Status: $($result.StatusCode)"
    } elseif ($result.StatusCode -eq 401 -or $result.StatusCode -eq 403) {
        Write-TestResult -TestName $endpoint.Name -Passed $true -Message "Protégé (auth requise) - Status: $($result.StatusCode)"
    } else {
        $status = if ($result.StatusCode) { $result.StatusCode } else { "N/A" }
        Write-TestResult -TestName $endpoint.Name -Passed $false -Message "Status: $status"
    }
}

# ============================================
# 9. VÉRIFICATION GCP SPÉCIFIQUE
# ============================================
Write-Host "`n☁️  9. VÉRIFICATION GCP SPÉCIFIQUE" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

# Vérifier les variables GCP
$gcpVars = @(
    "GCP_PROJECT_ID",
    "S3_BUCKET",
    "S3_ENDPOINT",
    "UPLOAD_BASE_URL"
)

foreach ($var in $gcpVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-TestResult -TestName "GCP: $var" -Passed $true -Message "Configuré"
    } else {
        Write-Warning "Variable GCP manquante: $var"
    }
}

# Test upload/storage
$uploadResult = Test-HttpEndpoint -Url "$BackendUrl/api/upload/health"
if ($uploadResult.Success) {
    Write-TestResult -TestName "GCP Storage" -Passed $true -Message "Service disponible"
} else {
    Write-TestResult -TestName "GCP Storage" -Passed $false -Message "Service non disponible"
}

# ============================================
# RÉSUMÉ FINAL
# ============================================
Write-Host "`n📊 RÉSUMÉ FINAL" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host "Total de tests: $script:TotalTests" -ForegroundColor White
Write-Host "✅ Réussis: $script:PassedTests" -ForegroundColor Green
Write-Host "❌ Échoués: $script:FailedTests" -ForegroundColor Red
Write-Host "⚠️  Avertissements: $script:Warnings" -ForegroundColor Yellow

$successRate = if ($script:TotalTests -gt 0) {
    [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 2)
} else { 0 }

Write-Host "`nTaux de réussite: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 70) { "Yellow" } else { "Red" })

if ($script:FailedTests -eq 0) {
    Write-Host "`n🎉 TOUS LES TESTS SONT PASSÉS!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  CERTAINS TESTS ONT ÉCHOUÉ" -ForegroundColor Yellow
    exit 1
}


