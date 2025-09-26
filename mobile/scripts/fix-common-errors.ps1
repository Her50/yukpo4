# Script pour corriger les erreurs communes dans tous les fichiers
Write-Host "Correction des erreurs communes..." -ForegroundColor Cyan

$files = Get-ChildItem "src" -Filter "*.tsx" -Recurse

foreach ($file in $files) {
    Write-Host "Correction de: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Corriger les imports React
    $content = $content -replace 'import React from "react";', 'import * as React from "react";'
    $content = $content -replace 'import React, \{', 'import * as React from "react";`nimport {'
    
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
    
    # Corriger onClick par onPress
    $content = $content -replace 'onClick=', 'onPress='
    
    # Ajouter les imports React Native manquants si nécessaire
    if ($content -match '<Text' -and $content -notmatch 'import.*Text.*from.*react-native') {
        $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { Text } from ''react-native'';'
    }
    if ($content -match '<View' -and $content -notmatch 'import.*View.*from.*react-native') {
        $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { View } from ''react-native'';'
    }
    if ($content -match '<TouchableOpacity' -and $content -notmatch 'import.*TouchableOpacity.*from.*react-native') {
        $content = $content -replace '(import.*from.*react.*;)', '$1`nimport { TouchableOpacity } from ''react-native'';'
    }
    
    Set-Content $file.FullName $content -Encoding UTF8
}

Write-Host "Corrections communes terminees!" -ForegroundColor Green