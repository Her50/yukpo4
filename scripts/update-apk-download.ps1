#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Upload l'APK vers GCS (chemin unique /download) et met a jour Cloud Run pour l'API /app/update/check.

.DESCRIPTION
  - Copie vers gs://yukpo-project-yukpo-backend-media/app/yukpo.apk
  - Headers anti-cache sur l'objet
  - Met a jour ANDROID_LATEST_VERSION_CODE / ANDROID_LATEST_VERSION_NAME / ANDROID_APK_SIZE_BYTES
    sur le service Cloud Run (defaut: yukpo-backend, europe-west1).

  Le versionCode DOIT correspondre a celui dans l'APK (Android refuse souvent la mise a jour sinon).
  Si aapt est introuvable, passez -VersionCode (et optionnellement -VersionName).

.EXAMPLE
  .\update-apk-download.ps1 "C:\Users\23767\Downloads\app.apk"

.EXAMPLE
  .\update-apk-download.ps1 "C:\Users\23767\Downloads\app.apk" -VersionCode 48 -VersionName "1.2.0"
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ApkPath,

    [Parameter(Mandatory = $false)]
    [int]$VersionCode = 0,

    [Parameter(Mandatory = $false)]
    [string]$VersionName = "",

    [Parameter(Mandatory = $false)]
    [string]$CloudRunService = "yukpo-backend",

    [Parameter(Mandatory = $false)]
    [string]$Region = "europe-west1",

    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipCloudRunUpdate
)

function Find-AaptPath {
    $candidates = @()
    if ($env:ANDROID_HOME) {
        $candidates += Get-ChildItem -Path (Join-Path $env:ANDROID_HOME "build-tools") -Recurse -Filter "aapt.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
    }
    $sdkLocal = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
    if (Test-Path $sdkLocal) {
        $candidates += Get-ChildItem -Path $sdkLocal -Recurse -Filter "aapt.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
    }
    if ($candidates.Count -gt 0) {
        return $candidates[0].FullName
    }
    return $null
}

function Get-ApkVersionFromAapt {
    param([string]$ApkPath, [string]$AaptExe)
    $raw = & $AaptExe dump badging $ApkPath 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) {
        return $null
    }
    $line = ($raw | Select-Object -First 1) -as [string]
    $code = $null
    $name = $null
    if ($line -match "versionCode='(\d+)'") {
        $code = [int]$Matches[1]
    }
    if ($line -match "versionName='([^']*)'") {
        $name = $Matches[1]
    }
    return [pscustomobject]@{ VersionCode = $code; VersionName = $name }
}

if (-not (Test-Path $ApkPath)) {
    Write-Error "Fichier APK non trouve: $ApkPath"
    exit 1
}

$ApkPath = (Resolve-Path $ApkPath).Path
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$apkSize = (Get-Item $ApkPath).Length

Write-Host "Timestamp: $timestamp"
Write-Host "Taille APK: $apkSize octets"

# --- Upload GCS ---
Write-Host "Upload du nouvel APK vers GCS..."
gcloud storage cp $ApkPath gs://yukpo-project-yukpo-backend-media/app/yukpo.apk
if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec upload GCS"
    exit $LASTEXITCODE
}

Write-Host "Headers anti-cache..."
gcloud storage objects update gs://yukpo-project-yukpo-backend-media/app/yukpo.apk --cache-control="no-cache, no-store, must-revalidate"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec mise a jour headers objet"
    exit $LASTEXITCODE
}

Write-Host "OK - Lien utilisateurs: https://yukpomnang.com/download"
Write-Host "URL directe: https://storage.googleapis.com/yukpo-project-yukpo-backend-media/app/yukpo.apk?v=$timestamp"

if ($SkipCloudRunUpdate) {
    Write-Host "SkipCloudRunUpdate: pas de mise a jour des variables Cloud Run." -ForegroundColor Yellow
    exit 0
}

# --- VersionCode / VersionName ---
$vc = $VersionCode
$vn = $VersionName

if ($vc -le 0) {
    $aapt = Find-AaptPath
    if ($aapt) {
        Write-Host "aapt: $aapt"
        $meta = Get-ApkVersionFromAapt -ApkPath $ApkPath -AaptExe $aapt
        if ($meta -and $meta.VersionCode) {
            $vc = $meta.VersionCode
            if (-not $vn -and $meta.VersionName) {
                $vn = $meta.VersionName
            }
        }
    }
}

if ($vc -le 0) {
    Write-Error "Impossible de determiner versionCode. Installez Android SDK build-tools (aapt) ou passez -VersionCode <int> (doit correspondre au versionCode dans l'APK)."
    exit 1
}

if (-not $vn) {
    $vn = "build-$vc"
}

Write-Host "Cloud Run: service=$CloudRunService region=$Region -> ANDROID_LATEST_VERSION_CODE=$vc ANDROID_LATEST_VERSION_NAME=$vn ANDROID_APK_SIZE_BYTES=$apkSize"

$gcloudArgs = @(
    "run", "services", "update", $CloudRunService,
    "--region", $Region,
    "--quiet",
    "--update-env-vars", "ANDROID_LATEST_VERSION_CODE=$vc",
    "--update-env-vars", "ANDROID_LATEST_VERSION_NAME=$vn",
    "--update-env-vars", "ANDROID_APK_SIZE_BYTES=$apkSize"
)
if ($ProjectId) {
    $gcloudArgs = @("--project", $ProjectId) + $gcloudArgs
}

& gcloud @gcloudArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec gcloud run services update. Verifiez projet, service, region et droits."
    exit $LASTEXITCODE
}

Write-Host "Termine: les clients verront une mise a jour si leur versionCode est inferieur a $vc" -ForegroundColor Green
