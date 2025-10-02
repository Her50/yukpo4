# Script simple pour corriger les balises HTML
Write-Host "Correction des balises HTML..." -ForegroundColor Cyan

$files = Get-ChildItem "src" -Filter "*.tsx" -Recurse

foreach ($file in $files) {
    Write-Host "Correction de: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Corriger les balises HTML
    $content = $content -replace '<p([^>]*)>', '<Text$1>'
    $content = $content -replace '</p>', '</Text>'
    $content = $content -replace '<h1([^>]*)>', '<Text$1>'
    $content = $content -replace '</h1>', '</Text>'
    $content = $content -replace '<h2([^>]*)>', '<Text$1>'
    $content = $content -replace '</h2>', '</Text>'
    $content = $content -replace '<h3([^>]*)>', '<Text$1>'
    $content = $content -replace '</h3>', '</Text>'
    $content = $content -replace '<div([^>]*)>', '<View$1>'
    $content = $content -replace '</div>', '</View>'
    $content = $content -replace '<span([^>]*)>', '<Text$1>'
    $content = $content -replace '</span>', '</Text>'
    $content = $content -replace '<button([^>]*)>', '<TouchableOpacity$1>'
    $content = $content -replace '</button>', '</TouchableOpacity>'
    
    Set-Content $file.FullName $content -Encoding UTF8
}

Write-Host "Corrections terminees!" -ForegroundColor Green














