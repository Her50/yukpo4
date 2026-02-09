# Script pour récupérer un fichier depuis un commit Git sans utiliser git show
# Usage: .\scripts\git-get-file.ps1 <commit-hash> <file-path> [output-path]

param(
    [Parameter(Mandatory=$true)]
    [string]$CommitHash,
    
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = $null
)

if (-not $OutputPath) {
    $OutputPath = $FilePath
}

# Créer le répertoire de sortie s'il n'existe pas
$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Utiliser git cat-file qui est plus efficace que git show pour les gros fichiers
# Forcer l'encodage UTF-8 sans BOM
$content = git cat-file -p "${CommitHash}:${FilePath}" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erreur lors de la récupération du fichier: $content"
    exit 1
}

# Écrire le contenu avec encodage UTF-8 sans BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path $OutputPath -ErrorAction SilentlyContinue) -or $OutputPath, $content, $utf8NoBom)

Write-Host "Fichier récupéré depuis commit $CommitHash : $FilePath -> $OutputPath"
