# Script de nettoyage et reinstallation des dependances
# Resout le probleme "Queue is not a constructor" lors du prebuild

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  NETTOYAGE ET REINSTALLATION" -ForegroundColor Cyan
Write-Host "  DES DEPENDANCES" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verifier qu'on est dans le bon repertoire
if (-not (Test-Path "package.json")) {
    Write-Host "ERREUR: package.json non trouve" -ForegroundColor Red
    Write-Host "Executez ce script depuis le dossier mobile/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Repertoire correct detecte" -ForegroundColor Green
Write-Host ""

# Etape 1: Verification de package.json
Write-Host "[1/5] Verification de package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "   package.json trouve" -ForegroundColor Green
    $packageContent = Get-Content "package.json" -Raw | ConvertFrom-Json
    $depCount = ($packageContent.dependencies.PSObject.Properties | Measure-Object).Count
    $devDepCount = ($packageContent.devDependencies.PSObject.Properties | Measure-Object).Count
    Write-Host "   $depCount dependances principales" -ForegroundColor Cyan
    Write-Host "   $devDepCount dependances de developpement" -ForegroundColor Cyan
}
Write-Host ""

# Etape 2: Nettoyage des fichiers generes
Write-Host "[2/5] Nettoyage des fichiers generes..." -ForegroundColor Yellow

# Supprimer node_modules
if (Test-Path "node_modules") {
    Write-Host "   Suppression de node_modules..." -ForegroundColor Gray
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   node_modules supprime" -ForegroundColor Green
}

# Supprimer package-lock.json
if (Test-Path "package-lock.json") {
    Write-Host "   Suppression de package-lock.json..." -ForegroundColor Gray
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "   package-lock.json supprime" -ForegroundColor Green
}

# Nettoyer les caches Expo
if (Test-Path ".expo") {
    Write-Host "   Suppression du cache .expo..." -ForegroundColor Gray
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   Cache Expo supprime" -ForegroundColor Green
}

# Nettoyer le cache npm
Write-Host "   Nettoyage du cache npm..." -ForegroundColor Gray
npm cache clean --force 2>$null
Write-Host "   Cache npm nettoye" -ForegroundColor Green
Write-Host ""

# Etape 3: Verifier les versions Node et npm
Write-Host "[3/5] Verification des versions..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ERREUR: Node.js non trouve" -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "   npm: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ERREUR: npm non trouve" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Etape 4: Reinstaller les dependances
Write-Host "[4/5] Installation des dependances..." -ForegroundColor Yellow
Write-Host "   Cela peut prendre plusieurs minutes..." -ForegroundColor Gray
Write-Host ""

$installStart = Get-Date
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "   ERREUR lors de l'installation" -ForegroundColor Red
    Write-Host "   Code de sortie: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

$installDuration = (Get-Date) - $installStart
Write-Host ""
Write-Host "   Installation reussie en $([math]::Round($installDuration.TotalSeconds, 1)) secondes" -ForegroundColor Green
Write-Host ""

# Etape 5: Verification finale
Write-Host "[5/5] Verification finale..." -ForegroundColor Yellow

if (Test-Path "node_modules") {
    $moduleCount = (Get-ChildItem "node_modules" -Directory | Measure-Object).Count
    Write-Host "   $moduleCount modules installes" -ForegroundColor Green
}
else {
    Write-Host "   ERREUR: node_modules non trouve apres installation" -ForegroundColor Red
    exit 1
}

if (Test-Path "package-lock.json") {
    Write-Host "   package-lock.json cree" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  NETTOYAGE TERMINE !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes recommandees:" -ForegroundColor Cyan
Write-Host "   1. Testez le prebuild: npx expo prebuild --clean" -ForegroundColor White
Write-Host "   2. Ou lancez l'app: npm start" -ForegroundColor White
Write-Host ""
