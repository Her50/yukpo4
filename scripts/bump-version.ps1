#!/usr/bin/env pwsh
# Script pour incrémenter la version de l'application backend
# Utilise le versioning sémantique (SemVer): MAJOR.MINOR.PATCH

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("major", "minor", "patch", "pre-release")]
    [string]$Type,
    
    [Parameter(Mandatory=$false)]
    [string]$PreReleaseLabel = ""
)

$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "🚀 Incrémentation de version - Type: $Type"

# Chemin vers Cargo.toml
$cargoTomlPath = Join-Path $PSScriptRoot ".." "backend" "Cargo.toml"

if (-not (Test-Path $cargoTomlPath)) {
    Write-Error "❌ Cargo.toml introuvable: $cargoTomlPath"
    exit 1
}

# Lire la version actuelle
$cargoContent = Get-Content $cargoTomlPath -Raw
$currentVersionMatch = [regex]::Match($cargoContent, 'version\s*=\s*"([^"]+)"')

if (-not $currentVersionMatch.Success) {
    Write-Error "❌ Impossible de trouver la version dans Cargo.toml"
    exit 1
}

$currentVersion = $currentVersionMatch.Groups[1].Value
Write-Info "📋 Version actuelle: $currentVersion"

# Parser la version (SemVer: MAJOR.MINOR.PATCH[-PRE-RELEASE])
$versionParts = $currentVersion.Split('-')
$baseVersion = $versionParts[0]
$preRelease = if ($versionParts.Length -gt 1) { $versionParts[1] } else { "" }

$semverParts = $baseVersion.Split('.')
if ($semverParts.Length -ne 3) {
    Write-Error "❌ Format de version invalide (attendu: MAJOR.MINOR.PATCH): $currentVersion"
    exit 1
}

$major = [int]$semverParts[0]
$minor = [int]$semverParts[1]
$patch = [int]$semverParts[2]

# Calculer la nouvelle version selon le type
$newVersion = switch ($Type) {
    "major" {
        "$($major + 1).0.0"
    }
    "minor" {
        "$major.$($minor + 1).0"
    }
    "patch" {
        "$major.$minor.$($patch + 1)"
    }
    "pre-release" {
        if ($preRelease -eq "") {
            # Première pre-release: incrémenter patch et ajouter pre-release
            $newPatch = $patch + 1
            if ($PreReleaseLabel -eq "") {
                $PreReleaseLabel = "alpha.1"
            }
            "$major.$minor.$newPatch-$PreReleaseLabel"
        } else {
            # Incrémenter le numéro de pre-release
            $preParts = $preRelease.Split('.')
            if ($preParts.Length -ge 2) {
                $preType = $preParts[0]
                $preNumber = [int]$preParts[1]
                "$baseVersion-$preType.$($preNumber + 1)"
            } else {
                "$baseVersion-$preRelease.1"
            }
        }
    }
}

Write-Info "✨ Nouvelle version: $newVersion"

# Demander confirmation
$confirmation = Read-Host "Confirmer l'incrémentation vers $newVersion ? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Warning "❌ Opération annulée"
    exit 0
}

# Remplacer la version dans Cargo.toml
$newContent = $cargoContent -replace 'version\s*=\s*"[^"]+"', "version = `"$newVersion`""
Set-Content -Path $cargoTomlPath -Value $newContent -NoNewline

Write-Success "✅ Version mise à jour dans Cargo.toml: $currentVersion → $newVersion"

# Afficher les prochaines étapes
Write-Info ""
Write-Info "📝 Prochaines étapes recommandées:"
Write-Info "   1. Vérifier les changements: git diff backend/Cargo.toml"
Write-Info "   2. Commit: git add backend/Cargo.toml && git commit -m `"chore: bump version to $newVersion`""
Write-Info "   3. Créer un tag: git tag -a v$newVersion -m `"Version $newVersion`""
Write-Info "   4. Push: git push origin master && git push origin v$newVersion"
Write-Info ""
Write-Info "💡 Pour voir la version dans l'API: GET /api/health/version"







