param(
    [string]$DatabaseUrl = $env:STAGING_DATABASE_URL
)

if (-not $DatabaseUrl) {
    $DatabaseUrl = $env:DATABASE_URL
}

if (-not $DatabaseUrl) {
    Write-Error "[seed-staging] Aucune variable STAGING_DATABASE_URL ou DATABASE_URL fournie."
    exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $root "..")
Set-Location $repoRoot

$seedFiles = @(
    "backend/scripts/seed_delivery_staging.sql"
)

Write-Host "[seed-staging] ▶️ Application des seeds QA sur $DatabaseUrl"

foreach ($file in $seedFiles) {
    if (-not (Test-Path $file)) {
        Write-Warning "[seed-staging] Fichier introuvable : $file"
        continue
    }

    Write-Host "[seed-staging] → Exécution de $file"
    & psql $DatabaseUrl -f $file
}

Write-Host "[seed-staging] ✅ Seeds appliqués."


