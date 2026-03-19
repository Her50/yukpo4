param(
    [string]$DatabaseUrl = "",
    [string]$DbHost = "34.79.199.41",
    [int]$Port = 5432,
    [string]$Database = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "",
    [string]$SourceDir = "backend/migrations",
    [string]$TargetDir = "backend/migrations_strict",
    [string]$AmbiguousMapPath = "backend/scripts/sqlx_ambiguous_map.json"
)

$ErrorActionPreference = "Stop"

function Get-MigrationVersion([string]$name) {
    if ($name -match '^(\d+)_') { return [Int64]$Matches[1] }
    return $null
}

function Get-NormalizedDesc([string]$value) {
    if ($null -eq $value) { return "" }
    return ($value.ToLower().Trim() -replace '\s+', ' ')
}

if (-not (Test-Path $SourceDir)) { throw "SourceDir introuvable: $SourceDir" }
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    if ([string]::IsNullOrWhiteSpace($Password)) {
        if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
            throw "Mot de passe manquant. Passe -Password, définis PGPASSWORD, ou utilise -DatabaseUrl."
        }
    } else {
        $env:PGPASSWORD = $Password
    }
}

$map = @{}
if (Test-Path $AmbiguousMapPath) {
    $j = Get-Content -Path $AmbiguousMapPath -Raw | ConvertFrom-Json
    foreach ($r in $j.rules) {
        $k = "$($r.version)|$(Get-NormalizedDesc $r.db_description)"
        $map[$k] = $r.file_name
    }
}

$files = Get-ChildItem -Path $SourceDir -File -Filter "*.sql" | Sort-Object Name
$localByVersion = @{}
foreach ($f in $files) {
    $v = Get-MigrationVersion $f.Name
    if ($null -eq $v) { continue }
    $d = [System.IO.Path]::GetFileNameWithoutExtension($f.Name) -replace '^\d+_', '' -replace '_', ' '
    $e = [PSCustomObject]@{
        version = $v
        description = $d
        file_name = $f.Name
        full_path = $f.FullName
    }
    if ($localByVersion.ContainsKey($v)) {
        if ($localByVersion[$v] -isnot [System.Collections.IList]) { $localByVersion[$v] = @($localByVersion[$v]) }
        $localByVersion[$v] += $e
    } else {
        $localByVersion[$v] = $e
    }
}

$query = @"
SELECT version::text, description
FROM _sqlx_migrations
ORDER BY version;
"@

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $dbRowsRaw = psql -h $DbHost -p $Port -U $User -d $Database -t -A -F "`t" -c $query
} else {
    $dbRowsRaw = psql -t -A -F "`t" -c $query "$DatabaseUrl"
}
if ($LASTEXITCODE -ne 0) { throw "Lecture _sqlx_migrations échouée." }

$selected = @{}

foreach ($line in $dbRowsRaw) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t", 2
    if ($parts.Count -lt 2) { continue }
    $v = [Int64]$parts[0]
    $dbDesc = $parts[1]
    if (-not $localByVersion.ContainsKey($v)) { continue }

    $candidates = $localByVersion[$v]
    if ($candidates -isnot [System.Collections.IList]) { $candidates = @($candidates) }
    $chosen = $null

    $normDb = Get-NormalizedDesc $dbDesc
    $exact = @($candidates | Where-Object { (Get-NormalizedDesc $_.description) -eq $normDb })
    if ($exact.Count -eq 1) {
        $chosen = $exact[0]
    } else {
        $k = "$v|$normDb"
        if ($map.ContainsKey($k)) {
            $mappedFile = $map[$k]
            $match = @($candidates | Where-Object { $_.file_name -eq $mappedFile })
            if ($match.Count -eq 1) { $chosen = $match[0] }
        }
    }

    if ($null -eq $chosen) {
        # Fallback deterministic for strict source generation
        $chosen = ($candidates | Sort-Object file_name | Select-Object -First 1)
    }
    $selected[$v] = $chosen
}

# Include local versions not in DB yet (pending migrations): one deterministic file per version
foreach ($v in $localByVersion.Keys) {
    if ($selected.ContainsKey($v)) { continue }
    $candidates = $localByVersion[$v]
    if ($candidates -isnot [System.Collections.IList]) {
        $selected[$v] = $candidates
    } else {
        $selected[$v] = ($candidates | Sort-Object file_name | Select-Object -First 1)
    }
}

if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$copied = 0
foreach ($v in ($selected.Keys | Sort-Object)) {
    $src = $selected[$v].full_path
    $dst = Join-Path $TargetDir $selected[$v].file_name
    Copy-Item -Path $src -Destination $dst -Force
    $copied++
}

Write-Host "[OK] Source stricte générée: $TargetDir ($copied fichiers)" -ForegroundColor Green
Write-Host "[INFO] Utilise ensuite: sqlx migrate info --source $TargetDir --database-url <url>" -ForegroundColor Cyan
