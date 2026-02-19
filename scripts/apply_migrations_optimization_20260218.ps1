# Script pour appliquer les migrations d'optimisation SQL (18/02/2026)
# Migrations: delivery_matching_queue, delivery_proximity_suggestions, product_orders

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Region = "europe-west1"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application des Migrations d'Optimisation SQL (18/02/2026)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé!" -ForegroundColor Red
    Write-Host "   Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "[1/4] Vérification authentification GCP..." -ForegroundColor Yellow
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authCheck) {
    Write-Host "❌ ERREUR: Vous n'êtes pas authentifié sur GCP!" -ForegroundColor Red
    Write-Host "   Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authentifié: $authCheck" -ForegroundColor Green
Write-Host ""

# Vérifier que l'instance Cloud SQL existe
Write-Host "[2/4] Vérification instance Cloud SQL..." -ForegroundColor Yellow
$instanceCheck = gcloud sql instances describe $InstanceName --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: L'instance Cloud SQL '$InstanceName' n'existe pas!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Instance Cloud SQL trouvée: $InstanceName" -ForegroundColor Green
Write-Host ""

# Créer un fichier temporaire avec toutes les migrations combinées
Write-Host "[3/4] Préparation des migrations..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'

$migrations = @(
    "backend/migrations/20260218_optimize_delivery_matching_queue_final.sql",
    "backend/migrations/20260218_optimize_delivery_proximity_suggestions.sql",
    "backend/migrations/20260218_optimize_product_orders_validation_deadline.sql"
)

$combinedContent = @"
-- ============================================================================
-- Migrations d'Optimisation SQL Combinées (18/02/2026)
-- Appliquées automatiquement via script PowerShell
-- ============================================================================

"@

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "   ✅ Ajout: $migration" -ForegroundColor Green
        $content = Get-Content $migration -Raw
        $combinedContent += "`n-- Migration: $migration`n"
        $combinedContent += $content
        $combinedContent += "`n`n"
    } else {
        Write-Host "   ⚠️  Fichier non trouvé: $migration" -ForegroundColor Yellow
    }
}

$combinedContent | Out-File -FilePath $tempFile -Encoding UTF8
Write-Host "✅ Fichier temporaire créé: $tempFile" -ForegroundColor Green
Write-Host ""

# Demander le mot de passe
Write-Host "[4/4] Application des migrations..." -ForegroundColor Yellow
$securePassword = Read-Host "Entrez le mot de passe pour l'utilisateur '$User'" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

# Définir PGPASSWORD
$env:PGPASSWORD = $password

Write-Host ""
Write-Host "🔧 Connexion à Cloud SQL et application des migrations..." -ForegroundColor Cyan
Write-Host "   Instance: $InstanceName" -ForegroundColor White
Write-Host "   Database: $DatabaseName" -ForegroundColor White
Write-Host "   User: $User" -ForegroundColor White
Write-Host ""

# Méthode 1: Essayer via gcloud sql connect (si disponible)
Write-Host "Tentative via gcloud sql connect..." -ForegroundColor Yellow

# Créer un script SQL qui lit le fichier
$sqlScript = @"
\set ON_ERROR_STOP on
\echo 'Début des migrations...'
\i $tempFile
\echo 'Migrations terminées!'
"@

$sqlScriptFile = [System.IO.Path]::GetTempFileName()
$sqlScriptFile = $sqlScriptFile -replace '\.tmp$', '.sql'
$sqlScript | Out-File -FilePath $sqlScriptFile -Encoding UTF8

# Essayer d'appliquer via psql via gcloud
$connectionString = "${ProjectId}:${Region}:${InstanceName}"
Write-Host "   Connexion: $connectionString" -ForegroundColor Cyan

# Alternative: Utiliser psql directement si disponible
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "✅ psql trouvé, application directe..." -ForegroundColor Green
    
    # Construire la commande psql
    $psqlCmd = "psql `"host=/cloudsql/$connectionString user=$User dbname=$DatabaseName`" -f `"$tempFile`""
    
    Write-Host "   Commande: $psqlCmd" -ForegroundColor Cyan
    Write-Host ""
    
    # Exécuter
    try {
        $env:PGPASSWORD = $password
        $psqlArgs = @(
            "host=/cloudsql/$connectionString",
            "user=$User",
            "dbname=$DatabaseName",
            "-f",
            $tempFile
        )
        & psql $psqlArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  La commande psql a retourné un code d'erreur. Vérifiez les logs ci-dessus." -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Méthode alternative: Application manuelle" -ForegroundColor Yellow
        Write-Host "============================================================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. Connectez-vous à Cloud SQL:" -ForegroundColor White
        Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. Dans psql, exécutez:" -ForegroundColor White
        Write-Host "   \i $tempFile" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   OU copiez-collez le contenu du fichier:" -ForegroundColor White
        Write-Host "   $tempFile" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "⚠️  psql n'est pas disponible. Application manuelle requise." -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Connectez-vous à Cloud SQL:" -ForegroundColor White
    Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Dans psql, exécutez:" -ForegroundColor White
    Write-Host "   \i $tempFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   OU copiez-collez le contenu du fichier:" -ForegroundColor White
    Write-Host "   $tempFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Contenu du fichier:" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Yellow
    Get-Content $tempFile
    Write-Host "============================================================================" -ForegroundColor Yellow
}

# Nettoyer
$env:PGPASSWORD = $null
Write-Host ""
Write-Host "✅ Script terminé!" -ForegroundColor Green
Write-Host "   Fichier temporaire conservé: $tempFile" -ForegroundColor Gray

