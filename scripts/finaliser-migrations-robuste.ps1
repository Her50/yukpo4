# Script robuste pour finaliser les migrations SQLx
# Date: 2026-02-15
# Objectif: Exécuter les migrations manquantes avec gestion d'erreurs et retry

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "TempPassword123!"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FINALISATION MIGRATIONS SQLX ROBUSTE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Verifier que cargo est disponible
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] cargo non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] cargo trouve" -ForegroundColor Green
Write-Host ""

# Etape 1: Recuperer l'IP publique Cloud SQL
Write-Host "[ETAPE 1/6] Recuperation IP publique Cloud SQL..." -ForegroundColor Yellow
$publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0 -or -not $publicIp) {
    Write-Host "   [ERREUR] Impossible de recuperer l'IP publique" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] IP publique: $publicIp" -ForegroundColor Green
Write-Host ""

# Etape 2: Recuperer l'IP publique locale et autoriser
Write-Host "[ETAPE 2/6] Autorisation IP dans Cloud SQL..." -ForegroundColor Yellow
try {
    $localIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content.Trim()
    Write-Host "   [INFO] IP locale: $localIp" -ForegroundColor Cyan
    gcloud sql instances patch $InstanceName --authorized-networks=$localIp/32 --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] IP autorisee" -ForegroundColor Green
    } else {
        Write-Host "   [INFO] IP peut-etre deja autorisee" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ATTENTION] Impossible de recuperer/autoriser l'IP automatiquement" -ForegroundColor Yellow
}
Write-Host ""

# Etape 3: Configurer DATABASE_URL
Write-Host "[ETAPE 3/6] Configuration DATABASE_URL..." -ForegroundColor Yellow
$databaseUrl = "postgresql://${User}:${Password}@${publicIp}:5432/${DatabaseName}?sslmode=require"
$env:DATABASE_URL = $databaseUrl
Write-Host "   [OK] DATABASE_URL configuree" -ForegroundColor Green
Write-Host ""

# Etape 4: Verifier l'etat actuel des migrations
Write-Host "[ETAPE 4/6] Verification etat actuel des migrations..." -ForegroundColor Yellow
Push-Location backend

$migrationInfo = cargo sqlx migrate info 2>&1
$migrationInfo | Out-Host

# Compter les migrations pending
$pendingCount = ($migrationInfo | Select-String -Pattern "pending").Count
$appliedCount = ($migrationInfo | Select-String -Pattern "applied").Count

Write-Host ""
Write-Host "   [INFO] Migrations appliquees: $appliedCount" -ForegroundColor Cyan
Write-Host "   [INFO] Migrations en attente: $pendingCount" -ForegroundColor Cyan
Write-Host ""

if ($pendingCount -eq 0) {
    Write-Host "[OK] Toutes les migrations sont deja appliquees!" -ForegroundColor Green
    Pop-Location
    exit 0
}

# Etape 5: Executer les migrations avec retry
Write-Host "[ETAPE 5/6] Execution des migrations SQLx..." -ForegroundColor Yellow
Write-Host "   [INFO] Cela peut prendre plusieurs minutes..." -ForegroundColor Cyan
Write-Host ""

$maxRetries = 3
$retryCount = 0
$success = $false

while ($retryCount -lt $maxRetries -and -not $success) {
    if ($retryCount -gt 0) {
        Write-Host "   [RETRY $retryCount/$maxRetries] Nouvelle tentative..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    
    # Executer les migrations
    $migrationOutput = cargo sqlx migrate run 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "   [OK] Migrations executees avec succes!" -ForegroundColor Green
        $success = $true
    } else {
        Write-Host ""
        Write-Host "   [ERREUR] Code de sortie: $exitCode" -ForegroundColor Red
        
        # Afficher les dernieres lignes d'erreur
        $errorLines = $migrationOutput | Select-Object -Last 10
        Write-Host "   [INFO] Dernieres lignes d'erreur:" -ForegroundColor Yellow
        $errorLines | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        
        $retryCount++
        
        if ($retryCount -lt $maxRetries) {
            Write-Host "   [INFO] Nouvelle tentative dans 5 secondes..." -ForegroundColor Yellow
        }
    }
}

Pop-Location

# Etape 6: Verification finale
Write-Host ""
Write-Host "[ETAPE 6/6] Verification finale..." -ForegroundColor Yellow

if ($success) {
    Push-Location backend
    $finalInfo = cargo sqlx migrate info 2>&1
    $finalPending = ($finalInfo | Select-String -Pattern "pending").Count
    $finalApplied = ($finalInfo | Select-String -Pattern "applied").Count
    
    Write-Host "   [OK] Migrations appliquees: $finalApplied" -ForegroundColor Green
    Write-Host "   [INFO] Migrations en attente: $finalPending" -ForegroundColor Cyan
    
    if ($finalPending -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Toutes les migrations ont ete appliquees avec succes!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaines etapes:" -ForegroundColor Cyan
        Write-Host "   1. Verifier les tables creees:" -ForegroundColor White
        Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
        Write-Host "      \dt" -ForegroundColor Cyan
        Write-Host "   2. Verifier les migrations:" -ForegroundColor White
        Write-Host "      SELECT COUNT(*) FROM _sqlx_migrations;" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Il reste $finalPending migrations en attente" -ForegroundColor Yellow
        Write-Host "   Relancez ce script pour les appliquer" -ForegroundColor White
    }
    Pop-Location
} else {
    Write-Host ""
    Write-Host "[ERREUR] Impossible d'executer toutes les migrations apres $maxRetries tentatives" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions possibles:" -ForegroundColor Yellow
    Write-Host "   1. Verifier la connexion a la base de donnees" -ForegroundColor White
    Write-Host "   2. Verifier que l'IP est autorisee dans Cloud SQL" -ForegroundColor White
    Write-Host "   3. Verifier les logs d'erreur ci-dessus" -ForegroundColor White
    Write-Host "   4. Executer les migrations manuellement via gcloud sql connect" -ForegroundColor White
}

# Nettoyer
$env:DATABASE_URL = $null

Write-Host ""


