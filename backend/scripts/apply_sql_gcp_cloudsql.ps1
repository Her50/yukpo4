# Applique un fichier SQL sur l'instance Cloud SQL GCP (IP publique + secret database-url)
# Usage: .\scripts\apply_sql_gcp_cloudsql.ps1 -SqlPath "..\migrations\20260322_backfill_wallet_transactions_reference_type.sql"
# Prérequis: gcloud auth, secretmanager sur database-url, psql (PostgreSQL client)
#
# DATABASE_URL supportées:
# - postgresql://USER:PASS@HOST:PORT/DB?...
# - postgresql://USER:PASS@/DB?host=/cloudsql/... (socket)
# Le mot de passe peut contenir des caractères spéciaux ; l'URL complète est parsée après le dernier @ du schéma.

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
if (-not $dbUrl) {
    Write-Error "Impossible de lire database-url depuis Secret Manager."
}
if ($dbUrl -notmatch "^(postgres(ql)?://)") {
    Write-Error "Format DATABASE_URL inattendu (attendu postgres:// ou postgresql://)."
}

# Retirer le schéma postgresql:// ou postgres://
$afterScheme = $dbUrl -replace "^postgres(ql)?://", ""
# Dernier @ sépare credentials | host+path (mot de passe peut contenir @)
$lastAt = $afterScheme.LastIndexOf("@")
if ($lastAt -lt 0) {
    Write-Error "DATABASE_URL sans @ (credentials invalides)."
}
$cred = $afterScheme.Substring(0, $lastAt)
$hostAndPath = $afterScheme.Substring($lastAt + 1)

$colonIdx = $cred.IndexOf(":")
if ($colonIdx -lt 0) {
    Write-Error "Utilisateur:mot de passe invalides dans DATABASE_URL (pas de ':')."
}
$dbUser = $cred.Substring(0, $colonIdx)
$dbPass = $cred.Substring($colonIdx + 1)

# Cas Cloud SQL unix socket: hostAndPath = /DBNAME?host=/cloudsql/...
if ($hostAndPath.StartsWith("/")) {
    $dbAndQuery = $hostAndPath.TrimStart("/")
}
else {
    $dbAndQuery = $hostAndPath
}

$qIdx = $dbAndQuery.IndexOf("?")
$dbName = if ($qIdx -ge 0) { $dbAndQuery.Substring(0, $qIdx) } else { $dbAndQuery }

if ([string]::IsNullOrWhiteSpace($dbName)) {
    Write-Error "Nom de base introuvable dans DATABASE_URL."
}

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
