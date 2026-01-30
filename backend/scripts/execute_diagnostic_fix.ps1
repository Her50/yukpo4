# Script PowerShell pour exécuter les scripts de diagnostic et correction
# Date: 2026-01-30

Write-Host "🔍 Exécution des scripts de diagnostic et correction AWS" -ForegroundColor Cyan
Write-Host ""

# Vérifier que DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "   Définissez-la avec: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green
Write-Host ""

# Utiliser DATABASE_URL directement avec psql
$dbUrl = $env:DATABASE_URL

Write-Host "📋 Utilisation de DATABASE_URL pour la connexion" -ForegroundColor Cyan
Write-Host ""

# Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERREUR: psql n'est pas trouvé dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client ou ajoutez psql au PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql trouvé: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Pas besoin de PGPASSWORD si on utilise DATABASE_URL directement

# Chemin des scripts
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$diagnosticScript = Join-Path $scriptDir "diagnostic_migrations_aws.sql"
$fixScript = Join-Path $scriptDir "fix_migrations_aws.sql"

# Vérifier que les scripts existent
if (-not (Test-Path $diagnosticScript)) {
    Write-Host "❌ ERREUR: Script de diagnostic non trouvé: $diagnosticScript" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $fixScript)) {
    Write-Host "❌ ERREUR: Script de correction non trouvé: $fixScript" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Scripts trouvés" -ForegroundColor Green
Write-Host ""

# ============================================================================
# ÉTAPE 1: DIAGNOSTIC
# ============================================================================
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "ÉTAPE 1: DIAGNOSTIC" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Exécution du script de diagnostic..." -ForegroundColor Yellow
Write-Host ""

$diagnosticOutput = & psql $dbUrl -f $diagnosticScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Diagnostic terminé avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Résultats du diagnostic:" -ForegroundColor Cyan
    Write-Host $diagnosticOutput
    Write-Host ""
} else {
    Write-Host "⚠️  Diagnostic terminé avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Yellow
    Write-Host $diagnosticOutput
    Write-Host ""
    Write-Host "💡 Continuation avec le script de correction..." -ForegroundColor Yellow
    Write-Host ""
}

# Demander confirmation avant d'appliquer les corrections
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "⚠️  ATTENTION: Le script de correction va modifier la base de données" -ForegroundColor Yellow
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""
$confirmation = Read-Host "Voulez-vous continuer avec le script de correction? (O/N)"

if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
    Write-Host ""
    Write-Host "❌ Opération annulée par l'utilisateur" -ForegroundColor Red
    exit 0
}

Write-Host ""

# ============================================================================
# ÉTAPE 2: CORRECTION
# ============================================================================
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "ÉTAPE 2: CORRECTION" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 Exécution du script de correction..." -ForegroundColor Yellow
Write-Host ""

$fixOutput = & psql $dbUrl -f $fixScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Correction terminée avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Résultats de la correction:" -ForegroundColor Cyan
    Write-Host $fixOutput
    Write-Host ""
} else {
    Write-Host "❌ Correction terminée avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host $fixOutput
    Write-Host ""
}

# ============================================================================
# ÉTAPE 3: VÉRIFICATION FINALE
# ============================================================================
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "ÉTAPE 3: VÉRIFICATION FINALE" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Exécution du diagnostic final..." -ForegroundColor Yellow
Write-Host ""

$finalDiagnostic = & psql $dbUrl -f $diagnosticScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Vérification finale terminée" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Résultats de la vérification finale:" -ForegroundColor Cyan
    Write-Host $finalDiagnostic
    Write-Host ""
} else {
    Write-Host "⚠️  Vérification finale terminée avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Yellow
    Write-Host $finalDiagnostic
    Write-Host ""
}

# Pas de nettoyage nécessaire

Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "✅ PROCESSUS TERMINÉ" -ForegroundColor Green
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Examiner les résultats ci-dessus" -ForegroundColor Gray
Write-Host "   2. Verifier les logs de l'application" -ForegroundColor Gray
Write-Host "   3. Tester les fonctionnalités critiques" -ForegroundColor Gray
Write-Host ""

