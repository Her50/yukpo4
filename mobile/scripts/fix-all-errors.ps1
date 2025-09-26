# Script pour corriger toutes les erreurs dans le code mobile
Write-Host "🔧 Correction de toutes les erreurs dans le code mobile" -ForegroundColor Cyan

# Fonction pour corriger un fichier
function Fix-File {
    param($filePath)
    
    if (Test-Path $filePath) {
        Write-Host "Correction de: $filePath" -ForegroundColor Yellow
        
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # Corriger les imports React
        $content = $content -replace 'import React from ''react'';', 'import * as React from ''react'';'
        $content = $content -replace 'import React, \{', 'import * as React from ''react'';`nimport {'
        
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
        
        # Corriger les imports problématiques
        $content = $content -replace 'import \{ motion \} // Animation React Native;', '// import { motion } from ''framer-motion''; // Animation React Native'
        $content = $content -replace 'import \{ Button \} from "@/components/ui/buttons";', 'import { TouchableOpacity, Text } from ''react-native'';'
        $content = $content -replace 'import \{ ArrowLeft \} from "lucide-react";', 'import { Ionicons } from ''@expo/vector-icons'';'
        $content = $content -replace 'import ResponsiveContainer from ''@/components/layout/ResponsiveContainer'';', '// import ResponsiveContainer from ''@/components/layout/ResponsiveContainer'';'
        $content = $content -replace 'import \{ useTranslation \} from "react-i18next";', '// import { useTranslation } from "react-i18next";'
        $content = $content -replace 'import \{ ROUTES \} from "@/routes/AppRoutesRegistry";', '// import { ROUTES } from "@/routes/AppRoutesRegistry";'
        
        # Corriger les références à useTranslation
        $content = $content -replace 'const \{ t \} = useTranslation\(\);', '// const { t } = useTranslation();'
        $content = $content -replace 't\("([^"]+)", "([^"]+)"\)', '"$2"'
        
        # Corriger les erreurs de template literal
        $content = $content -replace '`\s*$', '`;'
        
        Set-Content $filePath $content -Encoding UTF8
        Write-Host "✅ Corrigé: $filePath" -ForegroundColor Green
    }
}

# Liste de tous les fichiers à corriger
$filesToFix = @(
    "src/screens/StartScreen.tsx",
    "src/screens/ScoringDashboard.tsx", 
    "src/screens/ServiceDetailScreen.tsx",
    "src/screens/ScreenNotFoundMobile.tsx",
    "src/screens/Unauthorized.tsx",
    "src/screens/VideoCall.tsx",
    "src/screens/VoicePanel.tsx",
    "src/screens/YukpoIaHub.tsx",
    "src/components/VideoLangDetector.tsx",
    "src/components/VoiceButton.tsx",
    "src/components/WhyUsSection.tsx",
    "src/components/StarterHero.tsx",
    "src/screens/NotFound.tsx",
    "src/screens/ScreenNotFound.tsx",
    "src/screens/auth/RegisterScreen.tsx",
    "src/navigation/AppNavigator.tsx"
)

Write-Host "`n📝 Correction des fichiers..." -ForegroundColor Yellow

foreach ($file in $filesToFix) {
    Fix-File $file
}

# Corriger tous les fichiers .tsx dans src/
Write-Host "`n🔧 Correction de tous les fichiers .tsx dans src/..." -ForegroundColor Yellow

$allTsxFiles = Get-ChildItem "src" -Filter "*.tsx" -Recurse
foreach ($file in $allTsxFiles) {
    Fix-File $file.FullName
}

Write-Host "`n🎉 Corrections terminées!" -ForegroundColor Green
Write-Host "Vous pouvez maintenant tester la compilation avec: npx expo start" -ForegroundColor Yellow

