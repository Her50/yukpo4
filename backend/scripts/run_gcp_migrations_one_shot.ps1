# One-shot GCP Cloud SQL migration runner (PowerShell)
# - Auto elevation (RunAs Administrator)
# - Starts Cloud SQL Proxy locally
# - Applies targeted SQL migrations (migrations + migrations_strict)
# - Final verification queries
#
# Usage (single command):
#   powershell -ExecutionPolicy Bypass -File .\scripts\run_gcp_migrations_one_shot.ps1
#
# Optional:
#   powershell -ExecutionPolicy Bypass -File .\scripts\run_gcp_migrations_one_shot.ps1 -InstanceName yukpo-db
#   powershell -ExecutionPolicy Bypass -File .\scripts\run_gcp_migrations_one_shot.ps1 -IncludeStrict:$false

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$SecretName = "database-url",
    [string]$ProxyPort = "5433",
    [string]$MigrationPattern = "20260331*.sql",
    [bool]$IncludeStrict = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$proxyProc = $null

function Write-Step([string]$msg) {
    Write-Host "[STEP] $msg" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-WarnMsg([string]$msg) {
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Ensure-Admin {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Write-Ok "Session admin detectee."
        return
    }

    Write-WarnMsg "Session non-admin. Relance en admin (UAC)..."
    $argList = @(
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-ProjectId", "`"$ProjectId`"",
        "-InstanceName", "`"$InstanceName`"",
        "-SecretName", "`"$SecretName`"",
        "-ProxyPort", "`"$ProxyPort`"",
        "-MigrationPattern", "`"$MigrationPattern`"",
        "-IncludeStrict", "$IncludeStrict"
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs | Out-Null
    exit 0
}

function Require-Command([string]$cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Commande introuvable: $cmd"
    }
}

function Get-DbConfigFromSecret {
    param(
        [string]$Project,
        [string]$Secret
    )
    Write-Step "Lecture du secret GCP '$Secret'..."
    $raw = gcloud secrets versions access latest --secret=$Secret --project=$Project 2>$null
    if (-not $raw) { throw "Impossible de lire le secret '$Secret'." }
    $dbUrl = [string](($raw | Out-String) -replace "`r`n|`n","").Trim()
    if ($dbUrl -notmatch "^postgres(ql)?://") {
        throw "DATABASE_URL invalide dans le secret."
    }

    $uri = [System.Uri]$dbUrl
    $dbName = $uri.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($dbName)) { throw "Nom de base absent dans DATABASE_URL." }

    $userInfo = $uri.UserInfo
    if ([string]::IsNullOrWhiteSpace($userInfo)) {
        throw "Identifiants absents dans DATABASE_URL (user:password)."
    }
    $parts = $userInfo.Split(':', 2)
    if ($parts.Count -lt 2) { throw "Format user:password invalide dans DATABASE_URL." }
    $dbUser = [System.Uri]::UnescapeDataString($parts[0])
    $dbPass = [System.Uri]::UnescapeDataString($parts[1])

    return @{
        DbName = $dbName
        DbUser = $dbUser
        DbPass = $dbPass
        RawUrl = $dbUrl
    }
}

function Ensure-ProxyBinary {
    param([string]$TargetPath)
    if (Test-Path $TargetPath) {
        return
    }
    Write-Step "Telechargement cloud-sql-proxy local..."
    New-Item -ItemType Directory -Force -Path (Split-Path $TargetPath -Parent) | Out-Null
    $url = "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.x64.exe"
    Invoke-WebRequest -Uri $url -OutFile $TargetPath
    Write-Ok "Proxy telecharge: $TargetPath"
}

function Start-Proxy {
    param(
        [string]$ProxyExe,
        [string]$Project,
        [string]$Instance,
        [string]$Port
    )
    $connName = gcloud sql instances describe $Instance --project $Project --format="value(connectionName)"
    if (-not $connName) { throw "Impossible de recuperer connectionName pour instance '$Instance'." }
    Write-Step "Demarrage proxy local sur 127.0.0.1:$Port..."

    $proc = Start-Process -FilePath $ProxyExe -ArgumentList "`"$connName`" --port $Port" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    if ($proc.HasExited) {
        throw "Cloud SQL Proxy a quitte immediatement (code $($proc.ExitCode))."
    }
    Write-Ok "Proxy en cours (PID=$($proc.Id))."
    return $proc
}

function Get-TargetMigrations {
    param(
        [string]$BackendRoot,
        [string]$Pattern,
        [bool]$Strict
    )
    $all = @()
    $mainDir = Join-Path $BackendRoot "migrations"
    if (Test-Path $mainDir) {
        $all += Get-ChildItem -Path $mainDir -Filter $Pattern -File | Sort-Object Name
    }
    if ($Strict) {
        $strictDir = Join-Path $BackendRoot "migrations_strict"
        if (Test-Path $strictDir) {
            $all += Get-ChildItem -Path $strictDir -Filter $Pattern -File | Sort-Object Name
        }
    }
    return $all
}

function Invoke-SqlFile {
    param(
        [string]$PsqlExe,
        [string]$Host,
        [string]$Port,
        [string]$User,
        [string]$DbName,
        [string]$SqlPath
    )
    Write-Step "Application SQL: $SqlPath"
    & $PsqlExe -h $Host -p $Port -U $User -d $DbName -v ON_ERROR_STOP=1 -f $SqlPath
    if ($LASTEXITCODE -ne 0) {
        throw "Echec psql sur $SqlPath (code $LASTEXITCODE)."
    }
    Write-Ok "Applique: $SqlPath"
}

function Invoke-VerifyQuery {
    param(
        [string]$PsqlExe,
        [string]$Host,
        [string]$Port,
        [string]$User,
        [string]$DbName
    )
    Write-Step "Verification finale schema..."
    $verifySql = @"
SELECT
  EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='agency_departure_schedules'
      AND column_name='bus_model_id'
  ) AS has_bus_model_id;
"@
    & $PsqlExe -h $Host -p $Port -U $User -d $DbName -v ON_ERROR_STOP=1 -c $verifySql
    if ($LASTEXITCODE -ne 0) {
        throw "Verification SQL finale en echec."
    }
    Write-Ok "Verification finale OK."
}

# ------------------------
# Main
# ------------------------
try {
    Ensure-Admin
    Require-Command "gcloud"
    Require-Command "psql"

    $backendRoot = Split-Path -Parent $PSScriptRoot
    $proxyExe = Join-Path $backendRoot "tools\cloud-sql-proxy.exe"
    $db = Get-DbConfigFromSecret -Project $ProjectId -Secret $SecretName
    Ensure-ProxyBinary -TargetPath $proxyExe

    $env:PGPASSWORD = $db.DbPass
    $proxyProc = Start-Proxy -ProxyExe $proxyExe -Project $ProjectId -Instance $InstanceName -Port $ProxyPort

    $migrations = Get-TargetMigrations -BackendRoot $backendRoot -Pattern $MigrationPattern -Strict $IncludeStrict
    if ($migrations.Count -eq 0) {
        throw "Aucune migration ciblee trouvee avec pattern '$MigrationPattern'."
    }

    Write-Step "Migrations ciblees:"
    foreach ($m in $migrations) {
        Write-Host "  - $($m.FullName)"
    }

    foreach ($m in $migrations) {
        Invoke-SqlFile -PsqlExe "psql" -Host "127.0.0.1" -Port $ProxyPort -User $db.DbUser -DbName $db.DbName -SqlPath $m.FullName
    }

    Invoke-VerifyQuery -PsqlExe "psql" -Host "127.0.0.1" -Port $ProxyPort -User $db.DbUser -DbName $db.DbName
    Write-Ok "Termine. Toutes les migrations ciblees sont appliquees."
    Write-Host ""
    Write-Host "Commande one-shot utilisee:" -ForegroundColor Cyan
    Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\run_gcp_migrations_one_shot.ps1"
}
catch {
    Write-Error $_
    exit 1
}
finally {
    if ($env:PGPASSWORD) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    if ($proxyProc -and -not $proxyProc.HasExited) {
        Write-Step "Arret du proxy (PID=$($proxyProc.Id))..."
        Stop-Process -Id $proxyProc.Id -Force -ErrorAction SilentlyContinue
        Write-Ok "Proxy arrete."
    }
}
