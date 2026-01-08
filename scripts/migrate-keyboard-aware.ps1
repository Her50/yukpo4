# Script PowerShell pour migrer automatiquement les écrans vers KeyboardAwareScreen
# Usage: .\scripts\migrate-keyboard-aware.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Migration automatique vers KeyboardAwareScreen" -ForegroundColor Cyan
Write-Host ""

# Liste des fichiers à modifier
$files = @(
    "mobile/src/screens/auth/LoginScreen.tsx",
    "mobile/src/screens/auth/PartnerRegisterScreen.tsx",
    "mobile/src/screens/specialized/PharmacieFormScreen.tsx",
    "mobile/src/screens/specialized/HopitalFormScreen.tsx",
    "mobile/src/screens/specialized/LaboratoireFormScreen.tsx",
    "mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx",
    "mobile/src/screens/specialized/BanqueSangFormScreen.tsx",
    "mobile/src/screens/specialized/ImmobilierFormScreen.tsx",
    "mobile/src/screens/specialized/LivreScolaireFormScreen.tsx",
    "mobile/src/screens/specialized/OffresEmploiFormScreen.tsx",
    "mobile/src/screens/specialized/TaxiFormScreen.tsx",
    "mobile/src/screens/specialized/CovoiturageFormScreen.tsx",
    "mobile/src/screens/specialized/BusReturnRequestFormScreen.tsx",
    "mobile/src/screens/ResultatBesoinScreen.tsx",
    "mobile/src/screens/specialized/CovoiturageSearchScreen.tsx",
    "mobile/src/screens/specialized/ImmobilierSearchScreen.tsx",
    "mobile/src/screens/specialized/RecipeSearchScreen.tsx",
    "mobile/src/screens/offres-emploi/OffreSearchScreen.tsx"
)

$successCount = 0
$errorCount = 0

foreach ($file in $files) {
    $filePath = Join-Path $PSScriptRoot ".." $file
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠️  Fichier non trouvé: $file" -ForegroundColor Yellow
        $errorCount++
        continue
    }
    
    Write-Host "📝 Traitement de $file..." -ForegroundColor Cyan
    
    try {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $originalContent = $content
        
        # 1. Modifier les imports - Retirer KeyboardAvoidingView, Platform, ScrollView
        $content = $content -replace '(?m)^import\s*\{[^}]*\b(KeyboardAvoidingView|Platform|ScrollView)\b[^}]*\}.*$', ''
        $content = $content -replace '(?m)^\s*KeyboardAvoidingView,\s*$', ''
        $content = $content -replace '(?m)^\s*Platform,\s*$', ''
        $content = $content -replace '(?m)^\s*ScrollView,\s*$', ''
        
        # 2. Ajouter l'import de KeyboardAwareScreen si pas déjà présent
        if ($content -notmatch 'KeyboardAwareScreen') {
            # Trouver le dernier import de react-native
            if ($content -match '(?m)^import\s+.*from\s+[''"]react-native[''"];?\s*$') {
                $lastReactNativeImport = $Matches[0]
                $content = $content -replace [regex]::Escape($lastReactNativeImport), "$lastReactNativeImport`nimport { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';"
            } else {
                # Ajouter après les imports React
                if ($content -match '(?m)^import\s+.*from\s+[''"]react[''"];?\s*$') {
                    $content = $content -replace '(?m)^(import\s+.*from\s+[''"]react[''"];?\s*)$', "`$1`nimport { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';"
                }
            }
        }
        
        # 3. Remplacer KeyboardAvoidingView + ScrollView par KeyboardAwareScreen
        # Pattern: <KeyboardAvoidingView ...><ScrollView ...>
        $content = $content -replace '(?s)<KeyboardAvoidingView\s+[^>]*>\s*<ScrollView\s+([^>]*)>', '<KeyboardAwareScreen $1>'
        $content = $content -replace '(?s)</ScrollView>\s*</KeyboardAvoidingView>', '</KeyboardAwareScreen>'
        
        # 4. Remplacer seulement ScrollView si pas de KeyboardAvoidingView
        if ($content -match '<ScrollView' -and $content -notmatch '<KeyboardAvoidingView') {
            $content = $content -replace '<ScrollView\s+([^>]*)>', '<KeyboardAwareScreen $1>'
            $content = $content -replace '</ScrollView>', '</KeyboardAwareScreen>'
        }
        
        # 5. Nettoyer les lignes vides multiples
        $content = $content -replace '(?m)^\s*$\n\s*$', "`n"
        
        if ($content -ne $originalContent) {
            Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
            Write-Host "  ✅ Modifié avec succès" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  ℹ️  Aucune modification nécessaire" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Cyan
Write-Host "  ✅ Succès: $successCount" -ForegroundColor Green
Write-Host "  ❌ Erreurs: $errorCount" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  IMPORTANT: Vérifiez manuellement les fichiers modifiés avant de commiter!" -ForegroundColor Yellow

