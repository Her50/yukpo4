# Script pour corriger les erreurs de Paragraph
Write-Host "Correction des erreurs Paragraph..." -ForegroundColor Cyan

$files = Get-ChildItem "src" -Filter "*.tsx" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Corriger les erreurs de Paragraph
    $content = $content -replace '<Textaragraph', '<Paragraph'
    $content = $content -replace '</Textaragraph>', '</Paragraph>'
    
    Set-Content $file.FullName $content -Encoding UTF8
}

Write-Host "Corrections Paragraph terminees!" -ForegroundColor Green















