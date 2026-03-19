param(
    [string]$DatabaseUrl = "",
    [string]$DbHost = "34.79.199.41",
    [int]$Port = 5432,
    [string]$Database = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "",
    [string]$SourceDir = "backend/migrations_strict"
)

$ErrorActionPreference = "Stop"

function Get-MigrationVersion([string]$name) {
    if ($name -match '^(\d+)_') { return [Int64]$Matches[1] }
    return $null
}

function Get-Sha384Hex([string]$path) {
    (Get-FileHash -Path $path -Algorithm SHA384).Hash.ToLower()
}

if (-not (Test-Path $SourceDir)) {
    throw "SourceDir introuvable: $SourceDir"
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    if ([string]::IsNullOrWhiteSpace($Password)) {
        if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
            throw "Mot de passe manquant. Passe -Password, définis PGPASSWORD, ou utilise -DatabaseUrl."
        }
    } else {
        $env:PGPASSWORD = $Password
    }
}

$localByVersion = @{}
$files = Get-ChildItem -Path $SourceDir -File -Filter "*.sql" | Sort-Object Name
foreach ($f in $files) {
    $v = Get-MigrationVersion $f.Name
    if ($null -eq $v) { continue }
    $localByVersion[$v] = [PSCustomObject]@{
        file_name = $f.Name
        checksum_hex = Get-Sha384Hex $f.FullName
    }
}

$query = @"
SELECT version::text, description, encode(checksum, 'hex') AS checksum_hex, success::text
FROM _sqlx_migrations
ORDER BY version;
"@

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $dbRowsRaw = psql -h $DbHost -p $Port -U $User -d $Database -t -A -F "`t" -c $query
} else {
    $dbRowsRaw = psql -t -A -F "`t" -c $query "$DatabaseUrl"
}
if ($LASTEXITCODE -ne 0) { throw "Lecture _sqlx_migrations échouée." }

$missing = @()
$mismatch = @()
$ok = 0

foreach ($line in $dbRowsRaw) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t", 4
    if ($parts.Count -lt 4) { continue }

    $v = [Int64]$parts[0]
    $dbChecksum = $parts[2].ToLower()
    if (-not $localByVersion.ContainsKey($v)) {
        $missing += $v
        continue
    }

    $local = $localByVersion[$v]
    if ($local.checksum_hex -ne $dbChecksum) {
        $mismatch += [PSCustomObject]@{
            version = $v
            file_name = $local.file_name
            db_checksum = $dbChecksum
            local_checksum = $local.checksum_hex
        }
    } else {
        $ok++
    }
}

Write-Host "[INFO] Versions vérifiées OK: $ok" -ForegroundColor Cyan
Write-Host "[INFO] Versions manquantes: $($missing.Count)" -ForegroundColor Cyan
Write-Host "[INFO] Versions mismatch: $($mismatch.Count)" -ForegroundColor Cyan

if ($missing.Count -gt 0) {
    Write-Host "[ERROR] Versions absentes dans $SourceDir : $($missing -join ', ')" -ForegroundColor Red
}
if ($mismatch.Count -gt 0) {
    Write-Host "[ERROR] Mismatch checksum détecté dans la source stricte." -ForegroundColor Red
    $mismatch | Select-Object -First 20 | ForEach-Object {
        Write-Host "  v$($_.version) -> $($_.file_name)" -ForegroundColor Red
    }
}

if ($missing.Count -gt 0 -or $mismatch.Count -gt 0) {
    exit 1
}

Write-Host "[OK] Source stricte alignée avec _sqlx_migrations." -ForegroundColor Green
