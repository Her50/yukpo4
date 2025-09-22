# fix-cursor-cli.ps1
# Script pour corriger le conflit CLI Cursor

Write-Host "🔧 Correction du conflit CLI Cursor" -ForegroundColor Green

# 1. Identifier les installations
Write-Host "`n📋 Identification des installations Cursor..." -ForegroundColor Yellow

$cursorPaths = @(
    "C:\Program Files\Cursor\Cursor.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor\Cursor.exe",
    "C:\Program Files (x86)\Cursor\Cursor.exe"
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
                    Type = if ($path -like "*Program Files*") { "System" } else { "User" }
                }
                Write-Host "✅ Trouvé: $path - Version: $version" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Erreur avec: $path" -ForegroundColor Yellow
        }
    }
}

# 2. Trouver la version la plus récente
Write-Host "`n🎯 Recherche de la version la plus récente..." -ForegroundColor Yellow

$latestVersion = $null
$latestPath = $null

foreach ($installation in $foundInstallations) {
    $versionParts = $installation.Version -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2]
    
    if ($latestVersion -eq $null -or 
        $major -gt $latestVersion.Major -or 
        ($major -eq $latestVersion.Major -and $minor -gt $latestVersion.Minor) -or
        ($major -eq $latestVersion.Major -and $minor -eq $latestVersion.Minor -and $patch -gt $latestVersion.Patch)) {
        
        $latestVersion = @{ Major = $major; Minor = $minor; Patch = $patch }
        $latestPath = $installation.Path
    }
}

if ($latestPath) {
    Write-Host "✅ Version la plus récente trouvée: $latestPath" -ForegroundColor Green
    Write-Host "   Version: $($latestVersion.Major).$($latestVersion.Minor).$($latestVersion.Patch)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Aucune installation Cursor valide trouvée" -ForegroundColor Red
    exit 1
}

# 3. Corriger le PATH système
Write-Host "`n🔧 Correction du PATH système..." -ForegroundColor Yellow

$cursorDir = Split-Path $latestPath -Parent
$cursorBinDir = Join-Path $cursorDir "resources\app\bin"

if (Test-Path $cursorBinDir) {
    Write-Host "✅ Répertoire bin trouvé: $cursorBinDir" -ForegroundColor Green
    
    # Vérifier le PATH actuel
    $currentPath = $env:PATH
    if ($currentPath -like "*$cursorBinDir*") {
        Write-Host "✅ Le PATH contient déjà le bon répertoire" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Le PATH ne contient pas le bon répertoire" -ForegroundColor Yellow
        Write-Host "   Ajout de $cursorBinDir au PATH de cette session..." -ForegroundColor Cyan
        $env:PATH = "$cursorBinDir;$env:PATH"
    }
    
    # Tester la commande cursor
    try {
        $testVersion = & "$cursorBinDir\cursor.exe" --version
        Write-Host "✅ Test CLI réussi: $testVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Test CLI échoué: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Répertoire bin non trouvé: $cursorBinDir" -ForegroundColor Red
}

# 4. Instructions pour corriger définitivement
Write-Host "`n📋 Instructions pour corriger définitivement le PATH:" -ForegroundColor Yellow
Write-Host "1. Ouvrez les Variables d'environnement système" -ForegroundColor White
Write-Host "   - Windows + R → sysdm.cpl → Avancé → Variables d'environnement" -ForegroundColor Gray
Write-Host "2. Modifiez la variable PATH" -ForegroundColor White
Write-Host "3. Ajoutez ou modifiez l'entrée pour pointer vers:" -ForegroundColor White
Write-Host "   $cursorBinDir" -ForegroundColor Cyan
Write-Host "4. Redémarrez votre terminal/PowerShell" -ForegroundColor White

# 5. Vérification finale
Write-Host "`n🔍 Vérification finale..." -ForegroundColor Yellow
try {
    $finalVersion = cursor --version
    Write-Host "✅ CLI Cursor fonctionne: $finalVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ CLI Cursor nécessite encore une correction du PATH système" -ForegroundColor Yellow
}

Write-Host "`n✅ Script de correction terminé !" -ForegroundColor Green
Write-Host "`n💡 Pour appliquer définitivement, suivez les instructions ci-dessus." -ForegroundColor Cyan


