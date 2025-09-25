# Script pour verifier les fichiers manquants

$FrontendPath = Join-Path $PSScriptRoot "../../frontend/src"
$MobilePath = Join-Path $PSScriptRoot "../src"

Write-Host "Verification des fichiers manquants..." -ForegroundColor Cyan

# Fichiers utilises dans App.tsx du frontend
$RequiredPages = @(
    "ConfirmationPage",
    "HomePage", 
    "LoginPage",
    "PageNotFound",
    "RegisterPage",
    "ChatDialog",
    "CreationService",
    "CreationSmartService", 
    "FormulaireServiceModerne",
    "FormulaireYukpoIntelligent",
    "RechercheBesoin",
    "SoldeDetailPage",
    "YukpoIaHub",
    "AboutPage",
    "ContactPage",
    "Dashboard",
    "MesServices",
    "MonProfil",
    "DashboardPrestataire",
    "RechargeTokensPage",
    "ResultatBesoin",
    "ServicesInteragisPage",
    "ServicesPage",
    "ServiceView",
    "TestResultatBesoin",
    "UserSettingsPage",
    "VideoCall"
)

$RequiredComponents = @(
    "RequireAuth",
    "GPSManager",
    "GlobalIAStats",
    "IntelligentLanguageProvider",
    "ToasterProvider",
    "ServiceFormDynamic",
    "LocationDisplayDemo",
    "ExternalServiceShare"
)

Write-Host "`nVerification des pages..." -ForegroundColor Yellow
$MissingPages = @()
$MobileScreensPath = Join-Path $MobilePath "screens"

foreach ($Page in $RequiredPages) {
    $ScreenName = $Page -replace "Page", "Screen"
    $ScreenPath = Join-Path $MobileScreensPath "$ScreenName.tsx"
    
    if (Test-Path $ScreenPath) {
        Write-Host "OK: $ScreenName" -ForegroundColor Green
    } else {
        Write-Host "MANQUANT: $ScreenName" -ForegroundColor Red
        $MissingPages += $ScreenName
    }
}

Write-Host "`nVerification des composants..." -ForegroundColor Yellow
$MissingComponents = @()
$MobileComponentsPath = Join-Path $MobilePath "components"

foreach ($Component in $RequiredComponents) {
    $ComponentPath = Join-Path $MobileComponentsPath "$Component.tsx"
    
    if (Test-Path $ComponentPath) {
        Write-Host "OK: $Component" -ForegroundColor Green
    } else {
        Write-Host "MANQUANT: $Component" -ForegroundColor Red
        $MissingComponents += $Component
    }
}

Write-Host "`n=== RESUME ===" -ForegroundColor Cyan
Write-Host "Pages manquantes: $($MissingPages.Count)" -ForegroundColor $(if($MissingPages.Count -eq 0) {"Green"} else {"Red"})
Write-Host "Composants manquants: $($MissingComponents.Count)" -ForegroundColor $(if($MissingComponents.Count -eq 0) {"Green"} else {"Red"})

if ($MissingPages.Count -gt 0) {
    Write-Host "`nPages a creer:" -ForegroundColor Yellow
    foreach ($Page in $MissingPages) {
        Write-Host "- $Page" -ForegroundColor Red
    }
}

if ($MissingComponents.Count -gt 0) {
    Write-Host "`nComposants a creer:" -ForegroundColor Yellow
    foreach ($Component in $MissingComponents) {
        Write-Host "- $Component" -ForegroundColor Red
    }
}

if ($MissingPages.Count -eq 0 -and $MissingComponents.Count -eq 0) {
    Write-Host "`nTous les fichiers sont presents!" -ForegroundColor Green
} else {
    Write-Host "`nIl faut creer les fichiers manquants avant le deployement." -ForegroundColor Yellow
}

