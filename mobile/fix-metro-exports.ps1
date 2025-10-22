# Script pour corriger les exports des packages Metro 0.83
$metroPackages = @(
    "metro",
    "metro-cache",
    "metro-transform-worker",
    "metro-config",
    "metro-core",
    "metro-file-map",
    "metro-resolver",
    "metro-runtime",
    "metro-source-map",
    "metro-symbolicate",
    "metro-transform-plugins",
    "metro-babel-transformer",
    "metro-cache-key",
    "metro-minify-terser"
)

foreach ($package in $metroPackages) {
    $packageJsonPath = "node_modules\$package\package.json"
    if (Test-Path $packageJsonPath) {
        Write-Host "Fixing $package..." -ForegroundColor Yellow
        $content = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        
        # Ajouter les exports manquants
        if ($content.exports) {
            # Convertir en hashtable pour manipulation
            $exports = @{}
            $content.exports.PSObject.Properties | ForEach-Object {
                $exports[$_.Name] = $_.Value
            }
            
            # Ajouter les nouveaux exports
            $exports["./src/*"] = "./src/*.js"
            $exports["./src/**/*"] = "./src/**/*.js"
            
            # Reconvertir
            $content.exports = $exports
            
            # Sauvegarder
            $content | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath
            Write-Host "  ✓ Fixed $package" -ForegroundColor Green
        }
    }
}

Write-Host "`nAll Metro packages fixed!" -ForegroundColor Green










