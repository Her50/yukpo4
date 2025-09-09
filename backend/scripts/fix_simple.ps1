# Script simple pour corriger l'encodage
$files = @(
    "src/controllers/auth_controller.rs",
    "src/controllers/user_controller.rs"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Correction de $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        # Corrections simples
        $content = $content -replace "d\?", "dé"
        $content = $content -replace "r\?", "ré"
        $content = $content -replace "v\?", "vé"
        $content = $content -replace "c\?", "cé"
        $content = $content -replace "n\?", "né"
        $content = $content -replace "p\?", "pé"
        $content = $content -replace "s\?", "sé"
        $content = $content -replace "t\?", "té"
        $content = $content -replace "l\?", "lé"
        $content = $content -replace "m\?", "mé"
        $content = $content -replace "h\?", "hé"
        $content = $content -replace "b\?", "bé"
        $content = $content -replace "g\?", "gé"
        $content = $content -replace "f\?", "fé"
        $content = $content -replace "j\?", "jé"
        $content = $content -replace "k\?", "ké"
        $content = $content -replace "q\?", "qué"
        $content = $content -replace "w\?", "wé"
        $content = $content -replace "x\?", "xé"
        $content = $content -replace "y\?", "yé"
        $content = $content -replace "z\?", "zé"
        
        Set-Content $file -Value $content -Encoding UTF8
        Write-Host "  $file corrigé"
    }
}

Write-Host "Correction terminée !" 