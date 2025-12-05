# Script PowerShell pour telecharger et installer Blender automatiquement
# Usage: .\telecharger-installer-blender.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Telechargement et Installation Blender" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$blenderVersion = "4.0"
$downloadUrl = "https://download.blender.org/release/Blender$blenderVersion/blender-$blenderVersion.0-windows-x64.msi"
$installerPath = "$env:TEMP\blender-installer.msi"
$installPath = "${env:ProgramFiles}\Blender Foundation\Blender $blenderVersion"
$blenderExe = "$installPath\blender.exe"

# Verifier si Blender est deja installe
Write-Host "Verification de Blender existant..." -ForegroundColor Yellow
if (Test-Path $blenderExe) {
    Write-Host "Blender est deja installe a: $blenderExe" -ForegroundColor Green
    
    try {
        $version = & $blenderExe --version 2>&1 | Select-Object -First 1
        Write-Host "Version detectee: $version" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Impossible de verifier la version" -ForegroundColor Yellow
    }
    
    $response = Read-Host "Voulez-vous le reinstaller? (O/N)"
    if ($response -ne "O" -and $response -ne "o") {
        Write-Host "Installation annulee." -ForegroundColor Yellow
        exit 0
    }
}

# Etape 1: Telechargement
Write-Host ""
Write-Host "Telechargement de Blender $blenderVersion..." -ForegroundColor Cyan
Write-Host "URL: $downloadUrl" -ForegroundColor Gray

try {
    $progressPreference = 'Continue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "Telechargement termine!" -ForegroundColor Green
    Write-Host "   Fichier: $installerPath" -ForegroundColor Gray
}
catch {
    Write-Host "Erreur lors du telechargement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Telechargez manuellement depuis:" -ForegroundColor Yellow
    Write-Host "   https://www.blender.org/download/" -ForegroundColor Cyan
    exit 1
}

# Verifier que le fichier a ete telecharge
if (-not (Test-Path $installerPath)) {
    Write-Host "Le fichier d'installation n'a pas ete trouve!" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $installerPath).Length / 1MB
Write-Host "   Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray

# Etape 2: Installation
Write-Host ""
Write-Host "Installation de Blender..." -ForegroundColor Cyan
Write-Host "   Cela peut prendre plusieurs minutes..." -ForegroundColor Gray

try {
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$installerPath`" /quiet /norestart /L*v `"$env:TEMP\blender-install.log`"" -Wait -PassThru
    
    if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
        Write-Host "Installation terminee!" -ForegroundColor Green
    }
    else {
        Write-Host "Installation terminee avec code: $($process.ExitCode)" -ForegroundColor Yellow
        Write-Host "   (Code 3010 = redemarrage requis, mais installation OK)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "Erreur lors de l'installation: $_" -ForegroundColor Red
    Write-Host "   Consultez le log: $env:TEMP\blender-install.log" -ForegroundColor Yellow
    exit 1
}

# Verifier que Blender est installe
Write-Host ""
Write-Host "Verification de l'installation..." -ForegroundColor Yellow

$foundPaths = @()
$possiblePaths = @(
    "${env:ProgramFiles}\Blender Foundation\Blender $blenderVersion\blender.exe",
    "${env:ProgramFiles(x86)}\Blender Foundation\Blender $blenderVersion\blender.exe",
    "C:\Program Files\Blender Foundation\Blender $blenderVersion\blender.exe",
    "C:\Program Files (x86)\Blender Foundation\Blender $blenderVersion\blender.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $foundPaths += $path
    }
}

if ($foundPaths.Count -eq 0) {
    Write-Host "Blender n'a pas ete trouve aux emplacements attendus." -ForegroundColor Red
    Write-Host ""
    Write-Host "Cherchez Blender manuellement:" -ForegroundColor Yellow
    Write-Host "   1. Ouvrez 'Ajouter ou supprimer des programmes'" -ForegroundColor Gray
    Write-Host "   2. Cherchez 'Blender' et notez le chemin d'installation" -ForegroundColor Gray
    exit 1
}

$blenderPath = $foundPaths[0]
Write-Host "Blender trouve: $blenderPath" -ForegroundColor Green

# Verifier la version
try {
    $versionOutput = & $blenderPath --version 2>&1 | Select-Object -First 1
    Write-Host "Version: $versionOutput" -ForegroundColor Cyan
}
catch {
    Write-Host "Impossible de verifier la version" -ForegroundColor Yellow
}

# Etape 3: Configuration du chemin dans .env
Write-Host ""
Write-Host "Configuration du chemin Blender..." -ForegroundColor Cyan

$envFile = "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "Creation du fichier .env..." -ForegroundColor Yellow
    New-Item -Path $envFile -ItemType File -Force | Out-Null
}

# Lire le contenu actuel
$envContent = Get-Content $envFile -ErrorAction SilentlyContinue

# Verifier si BLENDER_PATH existe deja
$blenderPathLine = "BLENDER_PATH=$blenderPath"

if ($envContent -match "BLENDER_PATH=") {
    Write-Host "Mise a jour de BLENDER_PATH existant..." -ForegroundColor Yellow
    $envContent = $envContent -replace "BLENDER_PATH=.*", $blenderPathLine
}
else {
    Write-Host "Ajout de BLENDER_PATH..." -ForegroundColor Yellow
    if ($envContent) {
        $envContent += ""
    }
    $envContent += "# Blender Configuration"
    $envContent += $blenderPathLine
}

# Sauvegarder
$envContent | Set-Content $envFile
Write-Host "Chemin Blender configure dans: $envFile" -ForegroundColor Green
Write-Host "   BLENDER_PATH=$blenderPath" -ForegroundColor Gray

# Etape 4: Nettoyage
Write-Host ""
Write-Host "Nettoyage..." -ForegroundColor Cyan
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
    Write-Host "Fichier d'installation supprime" -ForegroundColor Green
}

# Resume final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation terminee avec succes!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Blender installe a:" -ForegroundColor Cyan
Write-Host "   $blenderPath" -ForegroundColor White
Write-Host ""
Write-Host "Configuration ajoutee dans:" -ForegroundColor Cyan
Write-Host "   $envFile" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Verifiez que BLENDER_PATH est correct dans backend/.env" -ForegroundColor Gray
Write-Host "   2. Redemarrez votre backend Rust pour prendre en compte la variable" -ForegroundColor Gray
Write-Host "   3. Testez avec: blender --version" -ForegroundColor Gray
Write-Host ""
# Script PowerShell pour télécharger et installer Blender automatiquement
# Usage: .\telecharger-installer-blender.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎨 Téléchargement et Installation Blender" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$blenderVersion = "4.0"  # Version de Blender
$downloadUrl = "https://download.blender.org/release/Blender$blenderVersion/blender-$blenderVersion.0-windows-x64.msi"
$installerPath = "$env:TEMP\blender-installer.msi"
$installPath = "${env:ProgramFiles}\Blender Foundation\Blender $blenderVersion"
$blenderExe = "$installPath\blender.exe"

# Vérifier si Blender est déjà installé
Write-Host "🔍 Vérification de Blender existant..." -ForegroundColor Yellow
if (Test-Path $blenderExe) {
    Write-Host "✅ Blender est déjà installé à: $blenderExe" -ForegroundColor Green
    
    # Vérifier la version
    $version = & $blenderExe --version 2>&1 | Select-Object -First 1
    Write-Host "📌 Version détectée: $version" -ForegroundColor Cyan
    
    $response = Read-Host "Voulez-vous le réinstaller? (O/N)"
    if ($response -ne "O" -and $response -ne "o") {
        Write-Host "Installation annulée." -ForegroundColor Yellow
        exit 0
    }
}

# Étape 1: Téléchargement
Write-Host ""
Write-Host "📥 Téléchargement de Blender $blenderVersion..." -ForegroundColor Cyan
Write-Host "URL: $downloadUrl" -ForegroundColor Gray

try {
    $progressPreference = 'Continue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✅ Téléchargement terminé!" -ForegroundColor Green
    Write-Host "   Fichier: $installerPath" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Erreur lors du téléchargement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: Téléchargez manuellement depuis:" -ForegroundColor Yellow
    Write-Host "   https://www.blender.org/download/" -ForegroundColor Cyan
    exit 1
}

# Vérifier que le fichier a été téléchargé
if (-not (Test-Path $installerPath)) {
    Write-Host "❌ Le fichier d'installation n'a pas été trouvé!" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $installerPath).Length / 1MB
Write-Host "   Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray

# Étape 2: Installation
Write-Host ""
Write-Host "⚙️  Installation de Blender..." -ForegroundColor Cyan
Write-Host "   Cela peut prendre plusieurs minutes..." -ForegroundColor Gray

try {
    # Installer Blender en mode silencieux
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$installerPath`" /quiet /norestart /L*v `"$env:TEMP\blender-install.log`"" -Wait -PassThru
    
    if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
        Write-Host "✅ Installation terminée!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Installation terminée avec code: $($process.ExitCode)" -ForegroundColor Yellow
        Write-Host "   (Code 3010 = redémarrage requis, mais installation OK)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Erreur lors de l'installation: $_" -ForegroundColor Red
    Write-Host "   Consultez le log: $env:TEMP\blender-install.log" -ForegroundColor Yellow
    exit 1
}

# Vérifier que Blender est installé
Write-Host ""
Write-Host "🔍 Vérification de l'installation..." -ForegroundColor Yellow

$foundPaths = @()
$possiblePaths = @(
    "${env:ProgramFiles}\Blender Foundation\Blender $blenderVersion\blender.exe",
    "${env:ProgramFiles(x86)}\Blender Foundation\Blender $blenderVersion\blender.exe",
    "C:\Program Files\Blender Foundation\Blender $blenderVersion\blender.exe",
    "C:\Program Files (x86)\Blender Foundation\Blender $blenderVersion\blender.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $foundPaths += $path
    }
}

if ($foundPaths.Count -eq 0) {
    Write-Host "❌ Blender n'a pas été trouvé aux emplacements attendus." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Cherchez Blender manuellement:" -ForegroundColor Yellow
    Write-Host "   1. Ouvrez 'Ajouter ou supprimer des programmes'" -ForegroundColor Gray
    Write-Host "   2. Cherchez 'Blender' et notez le chemin d'installation" -ForegroundColor Gray
    exit 1
}

$blenderPath = $foundPaths[0]
Write-Host "✅ Blender trouvé: $blenderPath" -ForegroundColor Green

# Vérifier la version
try {
    $versionOutput = & $blenderPath --version 2>&1 | Select-Object -First 1
    Write-Host "📌 Version: $versionOutput" -ForegroundColor Cyan
}
catch {
    Write-Host "⚠️  Impossible de vérifier la version" -ForegroundColor Yellow
}

# Étape 3: Configuration du chemin dans .env
Write-Host ""
Write-Host "⚙️  Configuration du chemin Blender..." -ForegroundColor Cyan

$envFile = "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "📝 Création du fichier .env..." -ForegroundColor Yellow
    New-Item -Path $envFile -ItemType File -Force | Out-Null
}

# Lire le contenu actuel
$envContent = Get-Content $envFile -ErrorAction SilentlyContinue

# Vérifier si BLENDER_PATH existe déjà
$blenderPathLine = "BLENDER_PATH=$blenderPath"
$blenderPathEscaped = $blenderPath.Replace('\', '\\')

if ($envContent -match "BLENDER_PATH=") {
    Write-Host "🔄 Mise à jour de BLENDER_PATH existant..." -ForegroundColor Yellow
    $envContent = $envContent -replace "BLENDER_PATH=.*", $blenderPathLine
}
else {
    Write-Host "➕ Ajout de BLENDER_PATH..." -ForegroundColor Yellow
    if ($envContent) {
        $envContent += ""
    }
    $envContent += "# Blender Configuration"
    $envContent += $blenderPathLine
}

# Sauvegarder
$envContent | Set-Content $envFile
Write-Host "✅ Chemin Blender configuré dans: $envFile" -ForegroundColor Green
Write-Host "   BLENDER_PATH=$blenderPath" -ForegroundColor Gray

# Étape 4: Nettoyage
Write-Host ""
Write-Host "🧹 Nettoyage..." -ForegroundColor Cyan
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
    Write-Host "✅ Fichier d'installation supprimé" -ForegroundColor Green
}

# Résumé final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Installation terminée avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 Blender installé à:" -ForegroundColor Cyan
Write-Host "   $blenderPath" -ForegroundColor White
Write-Host ""
Write-Host "📝 Configuration ajoutée dans:" -ForegroundColor Cyan
Write-Host "   $envFile" -ForegroundColor White
Write-Host ""
Write-Host "💡 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Vérifiez que BLENDER_PATH est correct dans backend/.env" -ForegroundColor Gray
Write-Host "   2. Redémarrez votre backend Rust pour prendre en compte la variable" -ForegroundColor Gray
Write-Host "   3. Testez avec: blender --version" -ForegroundColor Gray
Write-Host ""

