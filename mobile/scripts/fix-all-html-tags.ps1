# Script pour corriger toutes les balises HTML dans les fichiers React Native
Write-Host "🔧 Correction de toutes les balises HTML dans les fichiers React Native" -ForegroundColor Cyan

# Fonction pour corriger un fichier
function Fix-HTMLTags {
    param($filePath)
    
    if (Test-Path $filePath) {
        Write-Host "Correction de: $filePath" -ForegroundColor Yellow
        
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # Corriger les balises HTML par des composants React Native
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
        $content = $content -replace '<input([^>]*)>', '<TextInput$1>'
        $content = $content -replace '</input>', '</TextInput>'
        
        # Corriger les imports manquants
        if ($content -match '<Text' -and $content -notmatch 'import.*Text.*from.*react-native') {
            $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { Text } from ''react-native'';'
        }
        if ($content -match '<View' -and $content -notmatch 'import.*View.*from.*react-native') {
            $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { View } from ''react-native'';'
        }
        if ($content -match '<TouchableOpacity' -and $content -notmatch 'import.*TouchableOpacity.*from.*react-native') {
            $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { TouchableOpacity } from ''react-native'';'
        }
        if ($content -match '<TextInput' -and $content -notmatch 'import.*TextInput.*from.*react-native') {
            $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { TextInput } from ''react-native'';'
        }
        
        # Corriger les erreurs de template literal
        $content = $content -replace '`\s*$', '`;'
        
        # Corriger les erreurs de syntaxe spécifiques
        $content = $content -replace '}\s*\)\s*$', '});'
        
        Set-Content $filePath $content -Encoding UTF8
        Write-Host "✅ Corrigé: $filePath" -ForegroundColor Green
    }
}

# Trouver tous les fichiers .tsx dans src/
Write-Host "`n📝 Recherche des fichiers .tsx..." -ForegroundColor Yellow

$allTsxFiles = Get-ChildItem "src" -Filter "*.tsx" -Recurse
Write-Host "Trouvé $($allTsxFiles.Count) fichiers .tsx" -ForegroundColor Cyan

Write-Host "`n🔧 Correction des fichiers..." -ForegroundColor Yellow

foreach ($file in $allTsxFiles) {
    Fix-HTMLTags $file.FullName
}

Write-Host "`n🎉 Corrections terminées!" -ForegroundColor Green
Write-Host "Vous pouvez maintenant tester la compilation avec: npx tsc --jsx react-native --noEmit --skipLibCheck" -ForegroundColor Yellow

