# Script PowerShell robuste : lance embedding Python + backend Rust avec environnement virtuel Python
# Place ce script à la racine du projet Yukpo

Write-Host "🚀 Démarrage de la stack Yukpo..." -ForegroundColor Green

# === 0. Charger toutes les variables d'environnement du .env dans l'environnement courant ===
$envPath = Join-Path $PSScriptRoot "microservice_embedding\.env"
$templatePath = Join-Path $PSScriptRoot "microservice_embedding\env_template.txt"

if (Test-Path $envPath) {
    Write-Host "[DEBUG] Chargement des variables d'environnement depuis .env" -ForegroundColor Yellow
    try {
        # Charger le .env de manière sûre avec UTF-8
        $envContent = Get-Content $envPath -Encoding UTF8
        foreach ($line in $envContent) {
            if ($line -match '^([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "[ENV] $key = $value" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "[ERREUR] Impossible de charger le fichier .env: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[ERREUR] .env absent dans microservice_embedding" -ForegroundColor Red
    Write-Host "[INFO] Création d'un fichier .env par défaut..." -ForegroundColor Yellow
    if (Test-Path $templatePath) {
        Copy-Item $templatePath $envPath
        Write-Host "[INFO] Fichier .env créé depuis le template" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Template env_template.txt non trouvé" -ForegroundColor Red
        exit 1
    }
}

# === 0b. DEBUG: Vérification de la présence et du contenu de .env ===
if (Test-Path $envPath) {
    Write-Host "[DEBUG] .env présent dans microservice_embedding" -ForegroundColor Green
    $pineconeLine = Get-Content $envPath -Encoding UTF8 | Where-Object { $_ -match 'PINECONE_API_KEY' }
    if ($pineconeLine) {
        Write-Host "[DEBUG] Contenu .env: $pineconeLine" -ForegroundColor Gray
    }
} else {
    Write-Host "[ERREUR] .env absent dans microservice_embedding" -ForegroundColor Red
}

# === 1. Préparation de l'environnement virtuel Python ===
$microservicePath = Join-Path $PSScriptRoot "microservice_embedding"
Set-Location $microservicePath

$venvPath = Join-Path $microservicePath "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "[PY] Création de l'environnement virtuel Python..." -ForegroundColor Yellow
    & "C:\Python313\python.exe" -m venv venv
}

# Activation de l'environnement virtuel
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
} else {
    Write-Host "[ERREUR] Script d'activation non trouvé" -ForegroundColor Red
    exit 1
}

# Upgrade pip et install requirements
Write-Host "[PY] Installation des dépendances..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# === 1b. Vérification du chargement des variables d'environnement ===
$pineconeKey = [Environment]::GetEnvironmentVariable("PINECONE_API_KEY", "Process")
Write-Host "[DEBUG PYTHON] PINECONE_API_KEY = $pineconeKey" -ForegroundColor Gray

# === 2. Lancer le microservice embedding dans un terminal séparé ===
Write-Host "[EMBEDDING] Démarrage du microservice embedding..." -ForegroundColor Yellow
$embeddingCommand = "cd '$microservicePath'; & '$activateScript'; python -c 'import os; print(\"[DEBUG PYTHON] PINECONE_API_KEY:\", os.getenv(\"PINECONE_API_KEY\"))'; python -m uvicorn main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $embeddingCommand -WindowStyle Normal

# === 3. Lancer le backend Rust dans un terminal séparé ===
$backendPath = Join-Path $PSScriptRoot "backend"
Write-Host "[BACKEND] Démarrage du backend Rust..." -ForegroundColor Yellow
$backendCommand = "cd '$backendPath'; `$env:RUST_LOG='info'; cargo run"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand -WindowStyle Normal

# === 4. Attendre le démarrage ===
Write-Host "[WAIT] Attente du démarrage des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# === 5. Vérifier la connectivité embedding ===
Write-Host "[TEST] Test de connectivité embedding..." -ForegroundColor Yellow
try {
    $embeddingBody = @{
        value = "ping"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $embeddingResponse = Invoke-RestMethod -Uri "http://localhost:8000/embedding" -Method POST -Body $embeddingBody -ContentType "application/json"
    Write-Host "✅ Microservice embedding accessible." -ForegroundColor Green
} catch {
    Write-Host "❌ Microservice embedding INACCESSIBLE sur http://localhost:8000" -ForegroundColor Red
    Write-Host "Erreur: $_" -ForegroundColor Red
}

# === 6. Vérifier la connectivité backend ===
Write-Host "[TEST] Test de connectivité backend..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
    Write-Host "✅ Backend Yukpo accessible." -ForegroundColor Green
} catch {
    Write-Host "❌ Backend Yukpo INACCESSIBLE sur http://localhost:3001" -ForegroundColor Red
    Write-Host "Erreur: $_" -ForegroundColor Red
}

# === 7. Pause ===
Write-Host "`n🎉 Stack Yukpo démarrée ! Appuyez sur une touche pour fermer..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 