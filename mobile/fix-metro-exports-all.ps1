# Script de correction de TOUS les exports Metro invalides

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Correction des exports Metro" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$fixed = 0
$errors = 0

# Liste de tous les packages Metro à corriger
$metroPackages = @(
    "metro",
    "metro-cache",
    "metro-config",
    "metro-core",
    "metro-file-map",
    "metro-resolver",
    "metro-runtime",
    "metro-source-map",
    "metro-symbolicate",
    "metro-transform-plugins",
    "metro-transform-worker",
    "metro-babel-transformer",
    "metro-cache-key",
    "metro-minify-terser"
)

foreach ($package in $metroPackages) {
    $packageJsonPath = "node_modules\$package\package.json"
    
    if (-not (Test-Path $packageJsonPath)) {
        Write-Host "  - $package : non trouve, ignore" -ForegroundColor Gray
        continue
    }
    
    Write-Host "Correction de $package..." -ForegroundColor Yellow
    
    try {
        # Lire le package.json
        $content = Get-Content $packageJsonPath -Raw -Encoding UTF8
        $originalContent = $content
        
        # Corriger les exports invalides
        # Pattern 1: ".": "src" -> ".": "./src/index.js"
        $content = $content -replace '("\."\s*:\s*)"src"', '$1"./src/index.js"'
        
        # Pattern 2: ".": "src/index.js" -> ".": "./src/index.js"
        $content = $content -replace '("\."\s*:\s*)"src/index\.js"', '$1"./src/index.js"'
        
        # Pattern 3: tous les chemins sans ./ au debut dans exports
        $content = $content -replace '(:\s*)"(src/[^"]+)"', '$1"./$2"'
        
        # Sauvegarder si modifie
        if ($content -ne $originalContent) {
            Set-Content -Path $packageJsonPath -Value $content -Encoding UTF8 -NoNewline
            Write-Host "  OK $package corrige" -ForegroundColor Green
            $fixed++
        }
        else {
            Write-Host "  - $package deja OK" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  ERREUR avec $package : $_" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Correction terminee" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Packages corriges: $fixed" -ForegroundColor Cyan
Write-Host "Erreurs: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($fixed -gt 0) {
    Write-Host "Vous pouvez maintenant lancer:" -ForegroundColor Yellow
    Write-Host "  npx expo start" -ForegroundColor White
    Write-Host ""
}

