# Script PowerShell pour lancer le backend Yukpomnang
Write-Host "=== Initialisation de l'environnement backend Yukpomnang... ==="

# 1. Déterminer le chemin du .env
$envPath = ".env"
if (-not (Test-Path $envPath)) {
    $envPath = "..\.env"
}

# 1bis. Charger les variables depuis .env si présent
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
            $name, $value = $matches[1], $matches[2].Trim('"')
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
    Write-Host "[OK] Variables d'environnement chargées depuis $envPath"
} else {
    Write-Host "[INFO] Aucun fichier .env trouvé dans . ou .."
}

# 2. Vérifier la connexion à la base de données
if (-not $Env:DATABASE_URL) {
    Write-Error "[ERREUR] DATABASE_URL non défini. Ajoutez-le dans .env ou dans vos variables système."
    exit 1
}
Write-Host "[...] Test de connexion à la base de données PostgreSQL..."
try {
      & psql -d $Env:DATABASE_URL -c "\dt" > $null
    Write-Host "[OK] Connexion à la base établie"
} catch {
    Write-Error "[ERREUR] Connexion échouée. Vérifiez que PostgreSQL est démarré et les identifiants valides."
    exit 1
}

# 3. Lancer le serveur
Write-Host "[...] Lancement du serveur (cargo run)"
Start-Process -NoNewWindow powershell -ArgumentList "cargo run" -WorkingDirectory "." 

# 4. Endpoints disponibles
Start-Sleep -Seconds 2
Write-Host ""
Write-Host "=== Endpoints disponibles ==="
Write-Host "   POST   http://localhost:3000/register"
Write-Host "   POST   http://localhost:3000/login"
Write-Host "   POST   http://localhost:3000/services"
Write-Host "   GET    http://localhost:3000/services"
Write-Host ""
Write-Host "[OK] Serveur Yukpomnang actif."
