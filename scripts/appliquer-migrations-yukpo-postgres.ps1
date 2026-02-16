# Script pour appliquer les migrations SQLx sur la base yukpo_postgres
# Usage: .\scripts\appliquer-migrations-yukpo-postgres.ps1

param(
    [string]$DatabaseUrl = "",
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_postgres",
    [string]$UserName = "yukpo_user",
    [string]$UserPassword = "",
    [switch]$GenerateCache = $false
)

Write-Host "📦 Application des Migrations SQLx" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "backend\Cargo.toml")) {
    Write-Host "❌ Ce script doit être exécuté depuis la racine du projet" -ForegroundColor Red
    Write-Host "   Répertoire actuel: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Construire DATABASE_URL si non fournie
if (-not $DatabaseUrl) {
    Write-Host "🔧 Construction de la DATABASE_URL..." -ForegroundColor Yellow
    
    # Vérifier que gcloud est installé
    $gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
    if (Test-Path "$gcloudPath\gcloud.cmd") {
        $env:Path += ";$gcloudPath"
    } else {
        Write-Host "❌ gcloud non trouvé" -ForegroundColor Red
        Write-Host "   Installez Google Cloud SDK ou fournissez DATABASE_URL manuellement" -ForegroundColor Yellow
        exit 1
    }
    
    # Récupérer l'IP de l'instance
    $instanceIp = gcloud sql instances describe $InstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -ne 0 -or -not $instanceIp) {
        Write-Host "❌ Impossible de récupérer l'IP de l'instance" -ForegroundColor Red
        Write-Host "   Fournissez DATABASE_URL manuellement avec: -DatabaseUrl 'postgresql://...'" -ForegroundColor Yellow
        exit 1
    }
    
    if (-not $UserPassword) {
        Write-Host "⚠️  Mot de passe requis" -ForegroundColor Yellow
        $UserPassword = Read-Host "Entrez le mot de passe pour $UserName" -AsSecureString
        $UserPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($UserPassword)
        )
        $UserPassword = $UserPasswordPlain
    }
    
    $DatabaseUrl = "postgresql://${UserName}:${UserPassword}@${instanceIp}:5432/${DatabaseName}?sslmode=require"
    Write-Host "✅ DATABASE_URL construite" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Base de données: $DatabaseName" -ForegroundColor White
Write-Host "   DATABASE_URL: $(if ($DatabaseUrl -match '://([^:]+):([^@]+)@') { 
    $user = $matches[1]
    "postgresql://${user}:***@..." 
} else { 
    $DatabaseUrl 
})" -ForegroundColor White
Write-Host ""

# Vérifier la connexion
Write-Host "[ÉTAPE 1/3] Test de connexion à la base de données..." -ForegroundColor Yellow
$env:DATABASE_URL = $DatabaseUrl
$env:SQLX_OFFLINE = "false"

Push-Location backend

try {
    # Test de connexion
    $testResult = cargo sqlx database create 2>&1
    
    if ($LASTEXITCODE -eq 0 -or $testResult -match "already exists") {
        Write-Host "   ✅ Connexion réussie" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  La base existe peut-être déjà (c'est normal)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Erreur de connexion (peut être ignorée si la base existe)" -ForegroundColor Yellow
}

Write-Host ""

# Générer le cache SQLx si demandé
if ($GenerateCache) {
    Write-Host "[ÉTAPE 2/3] Génération du cache SQLx..." -ForegroundColor Yellow
    Write-Host "   Cela peut prendre quelques minutes..." -ForegroundColor Gray
    Write-Host ""
    
    cargo sqlx prepare --workspace -- --lib
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "   ✅ Cache SQLx généré avec succès!" -ForegroundColor Green
        
        if (Test-Path ".sqlx") {
            $fileCount = (Get-ChildItem -Path ".sqlx" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
            Write-Host "   Fichiers générés: $fileCount" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "   ❌ Erreur lors de la génération du cache" -ForegroundColor Red
        Write-Host "   Vérifiez la DATABASE_URL et la connexion" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Appliquer les migrations
Write-Host "[ÉTAPE 3/3] Application des migrations SQLx..." -ForegroundColor Yellow
Write-Host "   Cela peut prendre quelques minutes..." -ForegroundColor Gray
Write-Host ""

cargo sqlx migrate run

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    Write-Host "   Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Yellow
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "✅ Toutes les opérations terminées avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Vérifier que le cache SQLx est committé (si généré)" -ForegroundColor White
Write-Host "   2. Tester la connexion à la base de données" -ForegroundColor White
Write-Host "   3. Vérifier que les tables sont créées" -ForegroundColor White
Write-Host ""

