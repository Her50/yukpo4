# fix-cursor-simple.ps1
# Script simple pour corriger le conflit CLI Cursor

Write-Host "Correction du conflit CLI Cursor" -ForegroundColor Green

# 1. Identifier les installations
Write-Host "Identification des installations Cursor..." -ForegroundColor Yellow

$cursorPaths = @(
    "C:\Program Files\Cursor\Cursor.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor\Cursor.exe"
)

$foundInstallations = @()
foreach ($path in $cursorPaths) {
    if (Test-Path $path) {
        try {
            $version = & $path --version 2>$null
            if ($version) {
                $foundInstallations += @{
                    Path = $path
                    Version = $version
                }
                Write-Host "Trouve: $path - Version: $version" -ForegroundColor Green
            }
        } catch {
            Write-Host "Erreur avec: $path" -ForegroundColor Yellow
        }
    }
}

# 2. Trouver la version la plus récente
Write-Host "Recherche de la version la plus recente..." -ForegroundColor Yellow

$latestPath = $null
$latestVersion = "0.0.0"

foreach ($installation in $foundInstallations) {
    if ($installation.Version -gt $latestVersion) {
        $latestVersion = $installation.Version
        $latestPath = $installation.Path
    }
}

if ($latestPath) {
    Write-Host "Version la plus recente: $latestPath" -ForegroundColor Green
    Write-Host "Version: $latestVersion" -ForegroundColor Cyan
} else {
    Write-Host "Aucune installation Cursor valide trouvee" -ForegroundColor Red
    exit 1
}

# 3. Corriger le PATH pour cette session
Write-Host "Correction du PATH pour cette session..." -ForegroundColor Yellow

$cursorDir = Split-Path $latestPath -Parent
$cursorBinDir = Join-Path $cursorDir "resources\app\bin"

if (Test-Path $cursorBinDir) {
    Write-Host "Repertoire bin trouve: $cursorBinDir" -ForegroundColor Green
    
    # Ajouter au PATH de cette session
    $env:PATH = "$cursorBinDir;$env:PATH"
    
    # Tester la commande cursor
    try {
        $testVersion = & "$cursorBinDir\cursor.exe" --version
        Write-Host "Test CLI reussi: $testVersion" -ForegroundColor Green
    } catch {
        Write-Host "Test CLI echoue: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Repertoire bin non trouve: $cursorBinDir" -ForegroundColor Red
}

# 4. Instructions pour corriger definitivement
Write-Host "Instructions pour corriger definitivement le PATH:" -ForegroundColor Yellow
Write-Host "1. Ouvrez les Variables d'environnement systeme" -ForegroundColor White
Write-Host "2. Modifiez la variable PATH" -ForegroundColor White
Write-Host "3. Ajoutez ou modifiez l'entree pour pointer vers:" -ForegroundColor White
Write-Host "   $cursorBinDir" -ForegroundColor Cyan
Write-Host "4. Redemarrez votre terminal/PowerShell" -ForegroundColor White

# 5. Vérification finale
Write-Host "Verification finale..." -ForegroundColor Yellow
try {
    $finalVersion = cursor --version
    Write-Host "CLI Cursor fonctionne: $finalVersion" -ForegroundColor Green
} catch {
    Write-Host "CLI Cursor necessite encore une correction du PATH systeme" -ForegroundColor Yellow
}

Write-Host "Script de correction termine !" -ForegroundColor Green


