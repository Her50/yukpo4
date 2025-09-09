# Ce script PowerShell installe l'extension pgvector pour PostgreSQL 16 sur Windows
# Il doit être lancé en tant qu'administrateur

$pgVersion = "16"
$pgRoot = "C:\Program Files\PostgreSQL\$pgVersion"
$libDir = "$pgRoot\lib"
$extDir = "$pgRoot\share\extension"

# 1. Télécharger la dernière release Windows de pgvector
$releaseUrl = "https://github.com/pgvector/pgvector/releases/latest/download/pgvector-windows-pg$pgVersion.zip"
$zipPath = "$env:TEMP\pgvector-windows-pg$pgVersion.zip"
$extractPath = "$env:TEMP\pgvector_pg$pgVersion"

Write-Host "Téléchargement de pgvector..."
Invoke-WebRequest -Uri $releaseUrl -OutFile $zipPath

Write-Host "Décompression de l'archive..."
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

# 2. Copier les fichiers dans les bons dossiers
Write-Host "Copie des fichiers dans les dossiers PostgreSQL..."
Copy-Item -Path "$extractPath\lib\vector.dll" -Destination $libDir -Force
Copy-Item -Path "$extractPath\share\extension\vector.control" -Destination $extDir -Force
Copy-Item -Path "$extractPath\share\extension\vector--*.sql" -Destination $extDir -Force

# 3. (Optionnel) Redémarrer le service PostgreSQL
Write-Host "Redémarrage du service PostgreSQL..."
Restart-Service -Name "postgresql-x64-$pgVersion" -ErrorAction SilentlyContinue

# 4. Vérification de la présence des fichiers
if (!(Test-Path "$libDir\vector.dll")) {
    Write-Error "vector.dll n'a pas été copié dans $libDir !"
    exit 1
}
if (!(Test-Path "$extDir\vector.control")) {
    Write-Error "vector.control n'a pas été copié dans $extDir !"
    exit 1
}
if (-not (Get-ChildItem -Path $extDir -Filter "vector--*.sql")) {
    Write-Error "Aucun fichier vector--*.sql trouvé dans $extDir !"
    exit 1
}
Write-Host "Tous les fichiers pgvector sont en place."

# 5. Afficher les instructions SQL pour activer l'extension
Write-Host "`nPour activer l'extension dans votre base, connectez-vous avec psql et exécutez :"
Write-Host "  CREATE EXTENSION vector;"
Write-Host "`nPour vérifier la présence du type vector :"
Write-Host "  SELECT typname FROM pg_type WHERE typname = 'vector';"
Write-Host "`nPour tester la migration, lancez votre script SQL ou migration habituelle."

# (Optionnel) Exécution automatique de la commande SQL si variables d'environnement définies
if ($env:PGVECTOR_AUTO_SQL -eq '1' -and $env:PGUSER -and $env:PGDATABASE) {
    $psql = "$pgRoot\\bin\\psql.exe"
    if (!(Test-Path $psql)) {
        Write-Error "psql.exe introuvable dans $pgRoot\\bin."
        exit 1
    }
    Write-Host "Activation automatique de l'extension vector dans la base $env:PGDATABASE..."
    & $psql -U $env:PGUSER -d $env:PGDATABASE -c "CREATE EXTENSION IF NOT EXISTS vector;"
    if ($LASTEXITCODE -ne 0) { exit 1 }
    & $psql -U $env:PGUSER -d $env:PGDATABASE -c "SELECT typname FROM pg_type WHERE typname = 'vector';"
}

Write-Host "Installation terminée. Vous pouvez maintenant faire CREATE EXTENSION vector; dans psql."
