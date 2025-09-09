# Script pour lancer seulement les services backend et embedding
# Place ce script à la racine du projet Yukpo

Write-Host "🚀 Démarrage des services Yukpo (Backend + Embedding)..." -ForegroundColor Green

# === 0. Charger les variables d'environnement ===
$envPath = Join-Path $PSScriptRoot "microservice_embedding\.env"

if (Test-Path $envPath) {
    Write-Host "[DEBUG] Chargement des variables d'environnement depuis .env" -ForegroundColor Yellow
    try {
        $envContent = Get-Content $envPath -Encoding UTF8
        foreach ($line in $envContent) {
            if ($line -match '^([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    } catch {
        Write-Host "[ERREUR] Impossible de charger le fichier .env: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[ERREUR] .env absent dans microservice_embedding" -ForegroundColor Red
    exit 1
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
if (-not (Test-Path $activateScript)) {
    Write-Host "[ERREUR] Script d'activation non trouvé" -ForegroundColor Red
    exit 1
}

# Vérification des variables d'environnement
$pineconeKey = [Environment]::GetEnvironmentVariable("PINECONE_API_KEY", "Process")
Write-Host "[DEBUG] PINECONE_API_KEY = $pineconeKey" -ForegroundColor Gray

# === 2. Lancer le microservice embedding ===
Write-Host "[EMBEDDING] Démarrage du microservice embedding..." -ForegroundColor Yellow
$embeddingCommand = "cd '$microservicePath'; & '$activateScript'; python -m uvicorn main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $embeddingCommand -WindowStyle Normal

# === 3. Lancer le backend Rust ===
$backendPath = Join-Path $PSScriptRoot "backend"
Write-Host "[BACKEND] Démarrage du backend Rust..." -ForegroundColor Yellow
$backendCommand = "cd '$backendPath'; `$env:RUST_LOG='info'; cargo run"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand -WindowStyle Normal

# === 4. Attendre le démarrage ===
Write-Host "[WAIT] Attente du démarrage des services (15 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# === 5. Vérifier la connectivité ===
Write-Host "[TEST] Test de connectivité des services..." -ForegroundColor Yellow

# Test embedding
try {
    $embeddingBody = @{
        value = "test"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $embeddingResponse = Invoke-RestMethod -Uri "http://localhost:8000/embedding" -Method POST -Body $embeddingBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "✅ Microservice embedding accessible sur http://localhost:8000" -ForegroundColor Green
} catch {
    Write-Host "❌ Microservice embedding INACCESSIBLE sur http://localhost:8000" -ForegroundColor Red
    Write-Host "   Erreur: $_" -ForegroundColor Gray
}

# Test backend
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 10
    Write-Host "✅ Backend Yukpo accessible sur http://localhost:3001" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend Yukpo INACCESSIBLE sur http://localhost:3001" -ForegroundColor Red
    Write-Host "   Erreur: $_" -ForegroundColor Gray
}

# === 6. Instructions pour le frontend ===
Write-Host "`n🎉 Services démarrés !" -ForegroundColor Green
Write-Host "📝 Pour lancer le frontend, ouvrez un nouveau terminal et exécutez :" -ForegroundColor Cyan
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host "`n🌐 Frontend sera accessible sur : http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend accessible sur : http://localhost:3001" -ForegroundColor Cyan
Write-Host "🧠 Embedding accessible sur : http://localhost:8000" -ForegroundColor Cyan

Write-Host "`n⏸️  Appuyez sur une touche pour fermer ce script..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 