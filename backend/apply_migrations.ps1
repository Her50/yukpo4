# apply_migrations.ps1 — version améliorée : lit DATABASE_URL depuis .env

# Chemin du .env
$envPath = ".\.env"
if (-Not (Test-Path $envPath)) {
    Write-Host "Fichier .env introuvable dans le dossier courant !" -ForegroundColor Red
    exit 1
}

# Extraction de la ligne DATABASE_URL
$envContent = Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" }
if (-Not $envContent) {
    Write-Host "DATABASE_URL introuvable dans le .env !" -ForegroundColor Red
    exit 1
}
# Nettoyage et extraction de l'URL
$databaseUrl = $envContent -replace "DATABASE_URL=", ""
# Parsing de l'URL PostgreSQL
if ($databaseUrl -match "postgres:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\\d+))?\/(.+)$") {
    $dbUser = $matches[1]
    $dbPass = $matches[2]
    $dbHost = $matches[3]
    $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
    $dbName = $matches[5]
} else {
    Write-Host "DATABASE_URL mal formée !" -ForegroundColor Red
    exit 1
}

# Demande du mot de passe si non présent dans l'URL
if (-not $dbPass) {
    $password = Read-Host -Prompt "Entrez votre mot de passe PostgreSQL" -AsSecureString
    $dbPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
}

# Chemin vers le dossier des migrations
$migrationsPath = "$(Get-Location)\\migrations"
if (-Not (Test-Path -Path $migrationsPath)) {
    Write-Host "Le dossier des migrations n'existe pas : $migrationsPath" -ForegroundColor Red
    exit 1
}

# Tri des fichiers de migration par ordre de nom
$migrationFiles = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

# Définir le mot de passe PostgreSQL comme variable d'environnement
$env:PGPASSWORD = $dbPass

Write-Host "Application des migrations à la base de données : $dbName" -ForegroundColor Yellow

foreach ($file in $migrationFiles) {
    Write-Host "Application de la migration : $($file.Name)" -ForegroundColor Green
    $sql = Get-Content -Path $file.FullName -Raw
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "$sql" -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'application de la migration : $($file.Name)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Toutes les migrations ont été appliquées avec succès !" -ForegroundColor Green

# Exemple d'utilisation :
# .\apply_migrations.ps1 -TargetDatabase yukpo_test