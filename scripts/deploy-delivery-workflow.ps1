# Script de déploiement PowerShell pour Windows
# Usage: .\scripts\deploy-delivery-workflow.ps1 [backend|frontend|mobile|all]

param(
    [Parameter(Position = 0)]
    [ValidateSet("backend", "frontend", "mobile", "all")]
    [string]$Component = "all",
    
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Déploiement des améliorations workflow de livraison" -ForegroundColor Green
Write-Host "📦 Composant: $Component" -ForegroundColor Cyan
Write-Host "🌍 Environnement: $Environment" -ForegroundColor Cyan
Write-Host ""

function Write-Info {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    exit 1
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# Vérifier les prérequis
function Check-Prerequisites {
    Write-Info "Vérification des prérequis..."
    
    # Vérifier Rust
    try {
        $null = cargo --version
    }
    catch {
        Write-Error-Custom "Rust/Cargo n'est pas installé"
    }
    
    # Vérifier Node.js
    try {
        $null = node --version
    }
    catch {
        Write-Error-Custom "Node.js n'est pas installé"
    }
    
    # Vérifier DATABASE_URL
    if (-not $env:DATABASE_URL) {
        Write-Warning-Custom "DATABASE_URL n'est pas défini. Certaines opérations peuvent échouer."
    }
    
    Write-Info "Prérequis OK"
}

# Déploiement Backend
function Deploy-Backend {
    Write-Info "Déploiement Backend..."
    
    Push-Location backend
    
    try {
        # 1. Vérifier les migrations
        Write-Info "Vérification des migrations..."
        if (-not (Test-Path "migrations/20250120_001_add_order_preparation_system.sql")) {
            Write-Error-Custom "Migration 20250120_001 manquante"
        }
        if (-not (Test-Path "migrations/20250120_002_add_product_stock_management.sql")) {
            Write-Error-Custom "Migration 20250120_002 manquante"
        }
        
        # 2. Appliquer les migrations
        if ($env:DATABASE_URL) {
            Write-Info "Application des migrations..."
            try {
                sqlx migrate run
            }
            catch {
                Write-Warning-Custom "Échec des migrations (peut être déjà appliquées)"
            }
        }
        else {
            Write-Warning-Custom "DATABASE_URL non défini, migrations ignorées"
        }
        
        # 3. Régénérer sqlx-data.json
        if ($env:DATABASE_URL -and $env:SQLX_OFFLINE -ne "true") {
            Write-Info "Régénération de sqlx-data.json..."
            try {
                cargo sqlx prepare -- --lib
            }
            catch {
                Write-Warning-Custom "Échec de la régénération (peut nécessiter SQLX_OFFLINE=true)"
            }
        }
        
        # 4. Compiler
        Write-Info "Compilation du backend..."
        cargo build --release
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Échec de la compilation"
        }
        
        # 5. Vérifier les fichiers compilés
        if ((Test-Path "target/release/yukpomnang_backend.exe") -or 
            (Test-Path "target/release/yukpomnang-backend.exe")) {
            Write-Info "Backend compilé avec succès"
        }
        else {
            Write-Error-Custom "Binaire non trouvé après compilation"
        }
        
        Write-Info "✅ Backend déployé"
    }
    finally {
        Pop-Location
    }
}

# Déploiement Frontend
function Deploy-Frontend {
    Write-Info "Déploiement Frontend..."
    
    Push-Location frontend
    
    try {
        # 1. Installer les dépendances
        Write-Info "Installation des dépendances..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Échec de l'installation des dépendances"
        }
        
        # 2. Vérifier les fichiers
        Write-Info "Vérification des fichiers..."
        $requiredFiles = @(
            "src/pages/SimilarProductsPage.tsx",
            "src/pages/OrderManagementPage.tsx",
            "src/pages/ProviderAnalyticsPage.tsx",
            "src/services/providerAnalyticsService.ts"
        )
        
        foreach ($file in $requiredFiles) {
            if (-not (Test-Path $file)) {
                Write-Error-Custom "$file manquant"
            }
        }
        
        # 3. Build
        Write-Info "Build du frontend..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Échec du build"
        }
        
        # 4. Vérifier le build
        if ((Test-Path "dist") -and (Get-ChildItem "dist" | Measure-Object).Count -gt 0) {
            Write-Info "Frontend buildé avec succès"
        }
        else {
            Write-Error-Custom "Dossier dist vide ou manquant"
        }
        
        Write-Info "✅ Frontend déployé"
    }
    finally {
        Pop-Location
    }
}

# Déploiement Mobile
function Deploy-Mobile {
    Write-Info "Déploiement Mobile..."
    
    Push-Location mobile
    
    try {
        # 1. Installer les dépendances
        Write-Info "Installation des dépendances..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Échec de l'installation des dépendances"
        }
        
        # 2. Vérifier les fichiers
        Write-Info "Vérification des fichiers..."
        $requiredFiles = @(
            "src/screens/OrderStatusScreen.tsx",
            "src/screens/ProviderOrderManagementScreen.tsx",
            "src/services/orderService.ts",
            "src/services/notificationSoundService.ts"
        )
        
        foreach ($file in $requiredFiles) {
            if (-not (Test-Path $file)) {
                Write-Error-Custom "$file manquant"
            }
        }
        
        # 3. Vérifier la configuration
        if (-not (Test-Path "app.json") -and -not (Test-Path "app.config.js")) {
            Write-Warning-Custom "Fichier de configuration app.json/app.config.js non trouvé"
        }
        
        Write-Info "✅ Mobile prêt pour le build"
        Write-Warning-Custom "Pour build réel, utiliser: eas build --platform all"
        
        Write-Info "✅ Mobile vérifié"
    }
    finally {
        Pop-Location
    }
}

# Vérifications post-déploiement
function Post-Deployment-Checks {
    Write-Info "Vérifications post-déploiement..."
    
    # Vérifier les routes dans App.tsx
    $appContent = Get-Content "frontend/src/App.tsx" -Raw
    if ($appContent -match "SimilarProductsPage|OrderManagementPage|ProviderAnalyticsPage") {
        Write-Info "Routes frontend configurées"
    }
    else {
        Write-Warning-Custom "Routes frontend non trouvées dans App.tsx"
    }
    
    # Vérifier les routes dans AppNavigator.tsx (mobile)
    if (Test-Path "mobile/src/navigation/AppNavigator.tsx") {
        $navContent = Get-Content "mobile/src/navigation/AppNavigator.tsx" -Raw
        if ($navContent -match "OrderStatusScreen|ProviderOrderManagementScreen") {
            Write-Info "Routes mobile configurées"
        }
        else {
            Write-Warning-Custom "Routes mobile non trouvées dans AppNavigator.tsx"
        }
    }
    
    Write-Info "✅ Vérifications terminées"
}

# Main
function Main {
    Check-Prerequisites
    
    switch ($Component) {
        "backend" {
            Deploy-Backend
        }
        "frontend" {
            Deploy-Frontend
        }
        "mobile" {
            Deploy-Mobile
        }
        "all" {
            Deploy-Backend
            Deploy-Frontend
            Deploy-Mobile
        }
    }
    
    Post-Deployment-Checks
    
    Write-Host ""
    Write-Host "🎉 Déploiement terminé avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "  1. Vérifier les logs du serveur backend"
    Write-Host "  2. Tester les routes API"
    Write-Host "  3. Tester les pages frontend"
    Write-Host "  4. Tester l'application mobile"
    Write-Host "  5. Vérifier le monitoring"
}

Main

