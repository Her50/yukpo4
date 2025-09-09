# Script PowerShell générique pour installer pgvector à partir d'un dossier dézippé
# Usage :
#   1. Dézippez votre archive pgvector-windows-pgXX.zip dans un dossier (ex: C:\Temp\pgvector)
#   2. Modifiez la variable $SourceDir ci-dessous si besoin
#   3. Exécutez ce script en mode administrateur

param(
    [string]$SourceDir = "C:\Temp\pgvector",  # Dossier où vous avez dézippé pgvector
    [string]$PgRoot = "C:\Program Files\PostgreSQL\16"  # Racine de PostgreSQL
)

$libDir = Join-Path $PgRoot "lib"
$extDir = Join-Path $PgRoot "share\extension"

Write-Host "Copie de vector.dll dans $libDir ..."
Copy-Item -Path (Join-Path $SourceDir "lib\vector.dll") -Destination $libDir -Force

Write-Host "Copie de vector.control dans $extDir ..."
Copy-Item -Path (Join-Path $SourceDir "share\extension\vector.control") -Destination $extDir -Force

Write-Host "Copie des fichiers vector--*.sql dans $extDir ..."
Copy-Item -Path (Join-Path $SourceDir "share\extension\vector--*.sql") -Destination $extDir -Force

# Redémarrage du service PostgreSQL (optionnel)
$pgService = Get-Service | Where-Object { $_.Name -like "postgresql*16*" }
if ($pgService) {
    Write-Host "Redémarrage du service PostgreSQL ($($pgService.Name)) ..."
    Restart-Service -Name $pgService.Name -Force
} else {
    Write-Host "Service PostgreSQL non trouvé automatiquement. Redémarrez-le manuellement si besoin."
}

Write-Host "Installation pgvector terminée. Vous pouvez maintenant faire CREATE EXTENSION vector; dans psql."
