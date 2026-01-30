# Script PowerShell pour executer les scripts de diagnostic et correction AWS
# Date: 2026-01-30
# Usage: .\run_diagnostic_fix.ps1 [-AutoConfirm] [-UseRust] [-DatabaseUrl "postgresql://..."]

param(
    [switch]$AutoConfirm,
    [switch]$UseRust,
    [string]$DatabaseUrl = ""
)

Write-Host "Execution des scripts de diagnostic et correction AWS" -ForegroundColor Cyan
Write-Host ""

# Determiner DATABASE_URL
if ($DatabaseUrl) {
    $env:DATABASE_URL = $DatabaseUrl
    Write-Host "DATABASE_URL fournie en parametre" -ForegroundColor Green
} elseif ($env:DATABASE_URL) {
    Write-Host "DATABASE_URL trouvee dans l'environnement" -ForegroundColor Green
} else {
    Write-Host "ERREUR: DATABASE_URL n'est pas definie" -ForegroundColor Red
    Write-Host "   Options:" -ForegroundColor Yellow
    Write-Host "   1. Definir DATABASE_URL: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Yellow
    Write-Host "   2. Utiliser -DatabaseUrl 'postgresql://...'" -ForegroundColor Yellow
    Write-Host "   3. Utiliser -UseRust pour recuperer depuis AWS Secrets Manager (si configure)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Utiliser Rust si demande, sinon utiliser psql
if ($UseRust) {
    Write-Host "Utilisation du script Rust (meilleure gestion SSL pour AWS)" -ForegroundColor Cyan
    Write-Host ""
    
    # Verifier que cargo est disponible
    $cargoPath = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $cargoPath) {
        Write-Host "ERREUR: cargo n'est pas trouve dans le PATH" -ForegroundColor Red
        Write-Host "   Installez Rust ou ajoutez cargo au PATH" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "cargo trouve: $($cargoPath.Source)" -ForegroundColor Green
    Write-Host ""
    
    # Definir AUTO_CONFIRM si demande
    if ($AutoConfirm) {
        $env:AUTO_CONFIRM = "true"
    }
    
    # Changer vers le repertoire backend
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $backendDir = Split-Path -Parent $scriptDir
    Set-Location $backendDir
    
    Write-Host "Compilation et execution du script Rust..." -ForegroundColor Yellow
    Write-Host ""
    
    # Executer le script Rust
    $rustOutput = & cargo run --bin execute_diagnostic_fix 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $rustOutput
        Write-Host ""
        Write-Host "Processus termine avec succes" -ForegroundColor Green
        exit 0
    } else {
        Write-Host $rustOutput
        Write-Host ""
        Write-Host "Processus termine avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Sinon, utiliser psql (methode originale)
Write-Host "Utilisation de psql pour la connexion" -ForegroundColor Cyan
Write-Host ""

# Parser DATABASE_URL pour extraire les composants
$dbUrl = $env:DATABASE_URL
# Format avec port: postgresql://user:pass@host:port/db
# Format sans port: postgresql://user:pass@host/db
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^/]+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $hostPort = $matches[3]
    $dbName = $matches[4]
    
    # Separer host et port si present
    if ($hostPort -match '^([^:]+):(\d+)$') {
        $dbHost = $matches[1]
        $dbPort = $matches[2]
    } else {
        $dbHost = $hostPort
        $dbPort = "5432"  # Port par defaut
    }
    
    Write-Host "Utilisation de DATABASE_URL pour la connexion" -ForegroundColor Cyan
    Write-Host "   Host: $dbHost" -ForegroundColor Gray
    Write-Host "   Port: $dbPort" -ForegroundColor Gray
    Write-Host "   Database: $dbName" -ForegroundColor Gray
    Write-Host "   User: $dbUser" -ForegroundColor Gray
    Write-Host ""
    
    # Configurer SSL et mot de passe
    $env:PGPASSWORD = $dbPassword
    # Essayer prefer d'abord, puis require si necessaire
    $env:PGSSLMODE = "prefer"
} else {
    Write-Host "ERREUR: Format de DATABASE_URL invalide" -ForegroundColor Red
    Write-Host "   URL recue: $dbUrl" -ForegroundColor Yellow
    exit 1
}

# Verifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERREUR: psql n'est pas trouve dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client ou ajoutez psql au PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "psql trouve: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Chemin des scripts - utiliser le repertoire actuel ou le repertoire du script
$scriptDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { Get-Location }
$diagnosticScript = Join-Path $scriptDir "diagnostic_migrations_aws.sql"
$fixScript = Join-Path $scriptDir "fix_migrations_aws.sql"

# Verifier que les scripts existent
if (-not (Test-Path $diagnosticScript)) {
    Write-Host "ERREUR: Script de diagnostic non trouve: $diagnosticScript" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $fixScript)) {
    Write-Host "ERREUR: Script de correction non trouve: $fixScript" -ForegroundColor Red
    exit 1
}

Write-Host "Scripts trouves" -ForegroundColor Green
Write-Host ""

# ============================================================================
# ETAPE 1: DIAGNOSTIC
# ============================================================================
$separator = "=" * 80
Write-Host $separator -ForegroundColor Cyan
Write-Host "ETAPE 1: DIAGNOSTIC" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

Write-Host "Execution du script de diagnostic..." -ForegroundColor Yellow
Write-Host ""

$diagnosticOutput = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $diagnosticScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Diagnostic termine avec succes" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultats du diagnostic:" -ForegroundColor Cyan
    Write-Host $diagnosticOutput
    Write-Host ""
} else {
    Write-Host "Diagnostic termine avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Yellow
    Write-Host $diagnosticOutput
    Write-Host ""
    Write-Host "Continuation avec le script de correction..." -ForegroundColor Yellow
    Write-Host ""
}

# Demander confirmation avant d'appliquer les corrections
Write-Host $separator -ForegroundColor Cyan
Write-Host "ATTENTION: Le script de correction va modifier la base de donnees" -ForegroundColor Yellow
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if ($AutoConfirm) {
    Write-Host "Auto-confirmation activee, continuation automatique..." -ForegroundColor Yellow
    Write-Host ""
} else {
    $confirmation = Read-Host "Voulez-vous continuer avec le script de correction? (O/N)"
    
    if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
        Write-Host ""
        Write-Host "Operation annulee par l'utilisateur" -ForegroundColor Red
        exit 0
    }
    Write-Host ""
}

Write-Host ""

# ============================================================================
# ETAPE 2: CORRECTION
# ============================================================================
Write-Host $separator -ForegroundColor Cyan
Write-Host "ETAPE 2: CORRECTION" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

Write-Host "Execution du script de correction..." -ForegroundColor Yellow
Write-Host ""

$fixOutput = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $fixScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Correction terminee avec succes" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultats de la correction:" -ForegroundColor Cyan
    Write-Host $fixOutput
    Write-Host ""
} else {
    Write-Host "Correction terminee avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host $fixOutput
    Write-Host ""
}

# ============================================================================
# ETAPE 3: VERIFICATION FINALE
# ============================================================================
Write-Host $separator -ForegroundColor Cyan
Write-Host "ETAPE 3: VERIFICATION FINALE" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

Write-Host "Execution du diagnostic final..." -ForegroundColor Yellow
Write-Host ""

$finalDiagnostic = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $diagnosticScript 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Verification finale terminee" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultats de la verification finale:" -ForegroundColor Cyan
    Write-Host $finalDiagnostic
    Write-Host ""
} else {
    Write-Host "Verification finale terminee avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Yellow
    Write-Host $finalDiagnostic
    Write-Host ""
}

Write-Host $separator -ForegroundColor Cyan
Write-Host "PROCESSUS TERMINE" -ForegroundColor Green
Write-Host $separator -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Examiner les resultats ci-dessus" -ForegroundColor Gray
Write-Host "   2. Verifier les logs de l'application" -ForegroundColor Gray
Write-Host "   3. Tester les fonctionnalites critiques" -ForegroundColor Gray
Write-Host ""

# Nettoyer les variables d'environnement
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue

