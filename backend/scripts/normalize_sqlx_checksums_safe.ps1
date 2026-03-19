param(
    [string]$DbHost = "34.79.199.41",
    [int]$Port = 5432,
    [string]$Database = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "",
    [string]$MigrationSource = "backend/migrations",
    [string]$AmbiguousMapPath = "backend/scripts/sqlx_ambiguous_map.json",
    [switch]$Apply,
    [string]$ReportDir = "backend/scripts/reports"
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-WarnMsg($msg) {
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Write-Ok($msg) {
    Write-Host "[OK]   $msg" -ForegroundColor Green
}

function ConvertTo-SqlLiteral([string]$value) {
    if ($null -eq $value) { return "" }
    return $value.Replace("'", "''")
}

function Get-MigrationVersion([string]$name) {
    if ($name -match '^(\d+)_') {
        return [Int64]$Matches[1]
    }
    return $null
}

function Get-Sha384Hex([string]$path) {
    $hash = Get-FileHash -Path $path -Algorithm SHA384
    return $hash.Hash.ToLower()
}

function Get-NormalizedDesc([string]$value) {
    if ($null -eq $value) { return "" }
    return ($value.ToLower().Trim() -replace '\s+', ' ')
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "psql introuvable dans PATH."
}
if (-not (Get-Command sqlx -ErrorAction SilentlyContinue)) {
    throw "sqlx introuvable dans PATH."
}

if (-not (Test-Path $MigrationSource)) {
    throw "Dossier migrations introuvable: $MigrationSource"
}

if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportJson = Join-Path $ReportDir "sqlx_checksum_normalization_$timestamp.json"
$reportSql = Join-Path $ReportDir "sqlx_checksum_updates_$timestamp.sql"

if ([string]::IsNullOrWhiteSpace($Password)) {
    if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
        throw "Mot de passe manquant. Passe -Password ou définis PGPASSWORD."
    }
} else {
    $env:PGPASSWORD = $Password
}

$ambiguousMap = @{}
if (Test-Path $AmbiguousMapPath) {
    $mapJson = Get-Content -Path $AmbiguousMapPath -Raw | ConvertFrom-Json
    if ($null -ne $mapJson -and $null -ne $mapJson.rules) {
        foreach ($r in $mapJson.rules) {
            $key = "$($r.version)|$(Get-NormalizedDesc $r.db_description)"
            $ambiguousMap[$key] = $r.file_name
        }
    }
    Write-Info "Règles de mapping ambigu chargées: $($ambiguousMap.Count)"
}

$migrationFiles = Get-ChildItem -Path $MigrationSource -File -Filter "*.sql" | Sort-Object Name
$localByVersion = @{}
$ambiguousVersions = New-Object System.Collections.Generic.HashSet[Int64]

foreach ($f in $migrationFiles) {
    $version = Get-MigrationVersion $f.Name
    if ($null -eq $version) { continue }
    $desc = [System.IO.Path]::GetFileNameWithoutExtension($f.Name) -replace '^\d+_', '' -replace '_', ' '
    $entry = [PSCustomObject]@{
        version      = $version
        file         = $f.FullName
        file_name    = $f.Name
        description  = $desc
        checksum_hex = Get-Sha384Hex $f.FullName
    }
    if ($localByVersion.ContainsKey($version)) {
        $ambiguousVersions.Add($version) | Out-Null
        if ($localByVersion[$version] -isnot [System.Collections.IList]) {
            $localByVersion[$version] = @($localByVersion[$version])
        }
        $localByVersion[$version] += $entry
    } else {
        $localByVersion[$version] = $entry
    }
}

Write-Info "Fichiers migrations locaux analysés: $($migrationFiles.Count)"
Write-Info "Versions locales uniques: $($localByVersion.Keys.Count)"
if ($ambiguousVersions.Count -gt 0) {
    Write-WarnMsg "Versions locales ambiguës (même version dans plusieurs fichiers): $($ambiguousVersions.Count)"
}

$queryApplied = @"
SELECT
    version::text,
    description,
    encode(checksum, 'hex') AS checksum_hex,
    success::text
FROM _sqlx_migrations
ORDER BY version;
"@

$appliedRaw = psql -h $DbHost -p $Port -U $User -d $Database -t -A -F "`t" -c $queryApplied
if ($LASTEXITCODE -ne 0) {
    throw "Lecture de _sqlx_migrations échouée."
}

$applied = @()
foreach ($line in $appliedRaw) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t", 4
    if ($parts.Count -lt 4) { continue }
    $applied += [PSCustomObject]@{
        version      = [Int64]$parts[0]
        description  = $parts[1]
        checksum_hex = $parts[2].ToLower()
        success      = ($parts[3] -eq "t")
    }
}

Write-Info "Migrations en base détectées: $($applied.Count)"

$updates = @()
$missingLocal = @()
$ambiguousInDb = @()
$resolvedAmbiguous = @()
$alreadyAligned = 0

foreach ($row in $applied) {
    if (-not $localByVersion.ContainsKey($row.version)) {
        $missingLocal += $row
        continue
    }

    $local = $localByVersion[$row.version]
    if ($ambiguousVersions.Contains($row.version)) {
        $candidates = $local
        if ($candidates -isnot [System.Collections.IList]) {
            $candidates = @($candidates)
        }

        $rowDescNorm = Get-NormalizedDesc $row.description
        $exact = @($candidates | Where-Object { (Get-NormalizedDesc $_.description) -eq $rowDescNorm })
        $selected = $null

        if ($exact.Count -eq 1) {
            $selected = $exact[0]
        } else {
            $mapKey = "$($row.version)|$rowDescNorm"
            if ($ambiguousMap.ContainsKey($mapKey)) {
                $mappedFile = $ambiguousMap[$mapKey]
                $mapped = @($candidates | Where-Object { $_.file_name -eq $mappedFile })
                if ($mapped.Count -eq 1) {
                    $selected = $mapped[0]
                }
            }
        }

        if ($null -eq $selected) {
            $ambiguousInDb += $row
            continue
        }

        $local = $selected
        $resolvedAmbiguous += [PSCustomObject]@{
            version        = $row.version
            db_description = $row.description
            selected_file  = $local.file_name
        }
    }

    if ($row.checksum_hex -ne $local.checksum_hex -or $row.description -ne $local.description) {
        $updates += [PSCustomObject]@{
            version            = $row.version
            db_description     = $row.description
            db_checksum_hex    = $row.checksum_hex
            local_description  = $local.description
            local_checksum_hex = $local.checksum_hex
            local_file         = $local.file_name
        }
    } else {
        $alreadyAligned++
    }
}

Write-Info "Déjà alignées: $alreadyAligned"
Write-Info "A normaliser (checksum/description): $($updates.Count)"
Write-WarnMsg "En base mais fichier local introuvable: $($missingLocal.Count)"
Write-WarnMsg "En base avec version locale ambiguë: $($ambiguousInDb.Count)"
Write-Info "Ambiguïtés résolues automatiquement: $($resolvedAmbiguous.Count)"

$report = [PSCustomObject]@{
    generated_at            = (Get-Date).ToString("o")
    host                    = $DbHost
    port                    = $Port
    database                = $Database
    migration_source        = (Resolve-Path $MigrationSource).Path
    apply_requested         = [bool]$Apply
    applied_count           = $applied.Count
    local_unique_versions   = $localByVersion.Keys.Count
    aligned_count           = $alreadyAligned
    update_count            = $updates.Count
    missing_local_count     = $missingLocal.Count
    ambiguous_local_count   = $ambiguousInDb.Count
    updates                 = $updates
    resolved_ambiguous      = $resolvedAmbiguous
    missing_local_versions  = $missingLocal
    ambiguous_local_versions= $ambiguousInDb
}

$report | ConvertTo-Json -Depth 6 | Out-File -FilePath $reportJson -Encoding UTF8
Write-Ok "Rapport JSON écrit: $reportJson"

$sqlLines = @()
$sqlLines += "-- SQLx checksum normalization (SAFE) - generated $((Get-Date).ToString("s"))"
$sqlLines += "BEGIN;"
$sqlLines += "CREATE TABLE IF NOT EXISTS _sqlx_migrations_checksum_backup ("
$sqlLines += "    backup_id BIGSERIAL PRIMARY KEY,"
$sqlLines += "    backup_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),"
$sqlLines += "    version BIGINT NOT NULL,"
$sqlLines += "    description TEXT,"
$sqlLines += "    checksum BYTEA,"
$sqlLines += "    success BOOLEAN"
$sqlLines += ");"

if ($updates.Count -gt 0) {
    $versions = ($updates | ForEach-Object { $_.version }) -join ","
    $sqlLines += "INSERT INTO _sqlx_migrations_checksum_backup(version, description, checksum, success)"
    $sqlLines += "SELECT version, description, checksum, success"
    $sqlLines += "FROM _sqlx_migrations"
    $sqlLines += "WHERE version IN ($versions);"
    foreach ($u in $updates) {
        $descEscaped = ConvertTo-SqlLiteral $u.local_description
        $dbDescEscaped = ConvertTo-SqlLiteral $u.db_description
        $sqlLines += "UPDATE _sqlx_migrations"
        $sqlLines += "SET checksum = decode('$($u.local_checksum_hex)', 'hex'),"
        $sqlLines += "    description = '$descEscaped'"
        $sqlLines += "WHERE version = $($u.version)"
        $sqlLines += "  AND description = '$dbDescEscaped';"
    }
}

$sqlLines += "COMMIT;"
$sqlLines -join "`n" | Out-File -FilePath $reportSql -Encoding UTF8
Write-Ok "Plan SQL écrit: $reportSql"

if (-not $Apply) {
    Write-WarnMsg "Mode DRY-RUN: aucune modification DB effectuée."
    Write-Host ""
    Write-Host "Pour appliquer:" -ForegroundColor White
    Write-Host "  .\backend\scripts\normalize_sqlx_checksums_safe.ps1 -Apply -Password '<secret>'" -ForegroundColor Gray
    exit 0
}

if ($updates.Count -eq 0) {
    Write-Ok "Aucune mise à jour nécessaire."
    exit 0
}

Write-Info "Application des mises à jour checksum en transaction..."
psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database -f $reportSql | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Echec application SQL. Aucun changement partiel ne doit rester (transaction)."
}
Write-Ok "Normalisation appliquée avec succès."

$dbUrl = "postgresql://${User}:$($env:PGPASSWORD)@${DbHost}:$Port/$Database"
$sqlxInfo = sqlx migrate info --source $MigrationSource --database-url $dbUrl
if ($LASTEXITCODE -ne 0) {
    Write-WarnMsg "sqlx migrate info a échoué après normalisation. Vérifier la sortie ci-dessus."
    exit 1
}

$differentCount = ($sqlxInfo | Select-String -Pattern "different checksum").Count
Write-Info "Nombre de 'different checksum' restant: $differentCount"
Write-Ok "Terminé."
