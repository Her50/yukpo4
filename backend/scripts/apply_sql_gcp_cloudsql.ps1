# Applique un fichier SQL sur l'instance Cloud SQL GCP (IP publique + secret database-url)
# Usage: .\scripts\apply_sql_gcp_cloudsql.ps1 -SqlPath "..\migrations\20260322_backfill_wallet_transactions_reference_type.sql"
# Prérequis: gcloud auth, secretmanager sur database-url, psql (PostgreSQL client)

param(
    [Parameter(Mandatory = $true)]
    [string]$SqlPath,
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$SecretName = "database-url"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SqlPath)) {
    Write-Error "Fichier introuvable: $SqlPath"
}

$sqlFull = (Resolve-Path $SqlPath).Path

Write-Host "[INFO] Lecture du secret $SecretName..." -ForegroundColor Cyan
$dbUrl = (gcloud secrets versions access latest --secret=$SecretName --project=$ProjectId 2>$null).Trim()
if (-not $dbUrl -or $dbUrl -notmatch "^postgresql://") {
    Write-Error "Impossible de lire database-url depuis Secret Manager."
}

# Format attendu: postgresql://USER:PASS@/DBNAME?host=/cloudsql/... (mot de passe peut contenir : ou @)
if (-not $dbUrl.StartsWith("postgresql://") -or $dbUrl -notmatch "@/") {
    Write-Error "Format DATABASE_URL inattendu (attendu postgresql://user:pass@/db?...)"
}
$rest = $dbUrl.Substring("postgresql://".Length)
$atSlash = $rest.IndexOf("@/")
if ($atSlash -lt 0) { Write-Error "Séparateur @/ manquant dans DATABASE_URL" }
$cred = $rest.Substring(0, $atSlash)
$dbAndQuery = $rest.Substring($atSlash + 2)
$qIdx = $dbAndQuery.IndexOf("?")
$dbName = if ($qIdx -ge 0) { $dbAndQuery.Substring(0, $qIdx) } else { $dbAndQuery }
$colonIdx = $cred.IndexOf(":")
if ($colonIdx -lt 0) { Write-Error "Utilisateur:mot de passe invalides dans DATABASE_URL" }
$dbUser = $cred.Substring(0, $colonIdx)
$dbPass = $cred.Substring($colonIdx + 1)

Write-Host "[INFO] Instance Cloud SQL: $InstanceName" -ForegroundColor Cyan
Write-Host "[INFO] Base: $dbName | Utilisateur: $dbUser" -ForegroundColor Cyan

$publicIp = gcloud sql instances describe $InstanceName --project=$ProjectId --format="value(ipAddresses[0].ipAddress)" 2>$null
if (-not $publicIp) {
    Write-Error "IP publique introuvable pour $InstanceName"
}
Write-Host "[INFO] IP publique: $publicIp" -ForegroundColor Cyan

$env:PGPASSWORD = $dbPass
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psql)) {
    $psql = "psql"
}

Write-Host "[INFO] Exécution: $sqlFull" -ForegroundColor Yellow
& $psql -h $publicIp -p 5432 -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $sqlFull
$exit = $LASTEXITCODE
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

if ($exit -ne 0) {
    Write-Error "psql a échoué (code $exit)"
}
Write-Host "[OK] SQL appliqué." -ForegroundColor Green
