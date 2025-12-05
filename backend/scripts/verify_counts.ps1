# Script PowerShell pour exécuter la vérification Phase 1
# Usage: .\backend\scripts\verify_counts.ps1

Write-Host "🔍 Phase 1 - Vérification des comptages existants" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier DATABASE_URL
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    # Essayer de charger depuis .env
    if (Test-Path "backend\.env") {
        $envContent = Get-Content "backend\.env"
        foreach ($line in $envContent) {
            if ($line -match "^DATABASE_URL=(.+)") {
                $dbUrl = $matches[1]
                break
            }
        }
    }
}

if (-not $dbUrl) {
    Write-Host "❌ ERREUR: DATABASE_URL non trouvée" -ForegroundColor Red
    Write-Host "Veuillez définir DATABASE_URL dans les variables d'environnement ou dans backend/.env" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green
Write-Host ""

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "⚠️  psql non trouvé dans PATH" -ForegroundColor Yellow
    Write-Host "Tentative avec script Rust alternatif..." -ForegroundColor Yellow
    Write-Host ""
    
    # Utiliser le script Rust si disponible
    if (Test-Path "backend\scripts\verify_phase1_counts.rs") {
        Write-Host "Compilation et exécution du script Rust..." -ForegroundColor Blue
        cd backend
        cargo run --bin verify_phase1_counts 2>&1
        cd ..
    }
    else {
        Write-Host "❌ Aucun script disponible pour exécuter la vérification" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "Exécution du script SQL..." -ForegroundColor Blue
    Write-Host ""
    
    # Exécuter le script SQL
    $sqlScript = "backend\scripts\verify_phase1_counts_simple.sql"
    if (Test-Path $sqlScript) {
        psql $dbUrl -f $sqlScript
    }
    else {
        Write-Host "❌ Script SQL non trouvé: $sqlScript" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Green

