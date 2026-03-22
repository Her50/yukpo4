# Applique un fichier SQL sur l'instance Cloud SQL GCP (IP publique + secret database-url)
# Usage: .\scripts\apply_sql_gcp_cloudsql.ps1 -SqlPath "..\migrations\20260322_backfill_wallet_transactions_reference_type.sql"
# Prérequis: gcloud auth, secretmanager sur database-url, psql (PostgreSQL client)
#
# DATABASE_URL supportées:
# - postgresql://USER:PASS@HOST:PORT/DB?...
# - postgresql://USER:PASS@/DB?host=/cloudsql/... (socket)
# - postgresql://HOST:PORT/DB (sans @) : définir YUKPO_GCP_SQL_USER et YUKPO_GCP_SQL_PASSWORD
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
$rawSecret = gcloud secrets versions access latest --secret=$SecretName --project=$ProjectId 2>$null
if (-not $rawSecret) {
    Write-Error "Impossible de lire database-url depuis Secret Manager."
}
# Une seule ligne, type string (évite Char[] / tableaux qui cassent .Substring)
$dbUrl = [string](($rawSecret | Out-String) -replace "`r`n|`n","").Trim()
if ($dbUrl -notmatch "^(postgres(ql)?://)") {
    Write-Error "Format DATABASE_URL inattendu (attendu postgres:// ou postgresql://)."
}

# Retirer le schéma postgresql:// ou postgres://
$afterScheme = [string]($dbUrl -replace "^postgres(ql)?://", "")
$lastAt = $afterScheme.LastIndexOf("@")
$dbUser = $null
$dbPass = $null
$dbName = $null

if ($lastAt -ge 0) {
    $cred = [string]$afterScheme.Substring(0, $lastAt)
    $hostAndPath = [string]$afterScheme.Substring($lastAt + 1)
    $colonIdx = $cred.IndexOf(":")
    if ($colonIdx -lt 0) {
        Write-Error "Utilisateur:mot de passe invalides dans DATABASE_URL (pas de ':' avant @)."
    }
    $dbUser = [string]$cred.Substring(0, $colonIdx)
    $dbPass = [string]$cred.Substring($colonIdx + 1)
    $slashIdx = $hostAndPath.IndexOf("/")
    if ($slashIdx -lt 0) {
        Write-Error "DATABASE_URL: attendu ...@hôte/collection (ex. host:5432/dbname ou /dbname?host=...)."
    }
    $dbAndQuery = [string]$hostAndPath.Substring($slashIdx + 1)
    $qIdx = $dbAndQuery.IndexOf("?")
    $dbName = if ($qIdx -ge 0) { [string]$dbAndQuery.Substring(0, $qIdx) } else { $dbAndQuery }
}
else {
    $slashIdx = $afterScheme.IndexOf("/")
    if ($slashIdx -lt 0) {
        Write-Error "DATABASE_URL sans '@' : attendu postgresql://hôte:port/db ou définir YUKPO_GCP_SQL_USER."
    }
    $dbAndQuery = [string]$afterScheme.Substring($slashIdx + 1)
    $qIdx = $dbAndQuery.IndexOf("?")
    $dbName = if ($qIdx -ge 0) { [string]$dbAndQuery.Substring(0, $qIdx) } else { $dbAndQuery }
    $dbUser = $env:YUKPO_GCP_SQL_USER
    $dbPass = $env:YUKPO_GCP_SQL_PASSWORD
    if (-not $dbUser) {
        Write-Error "DATABASE_URL sans identifiants (pas de '@'). Définissez YUKPO_GCP_SQL_USER et YUKPO_GCP_SQL_PASSWORD, ou mettez postgresql://user:pass@hôte/db dans le secret."
    }
}

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
