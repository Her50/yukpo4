# Script de build EAS pour résoudre le crash de l'application Yukpo
Write-Host "🚀 Script de build EAS pour résoudre le crash Yukpo" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Fonction pour sauvegarder et restaurer App.tsx
function Backup-App {
    param($backupName)
    if (Test-Path "App.tsx") {
        Copy-Item "App.tsx" "App.$backupName.tsx" -Force
        Write-Host "✅ App.tsx sauvegardé comme App.$backupName.tsx" -ForegroundColor Green
    }
}

function Restore-App {
    param($backupName)
    if (Test-Path "App.$backupName.tsx") {
        Copy-Item "App.$backupName.tsx" "App.tsx" -Force
        Write-Host "✅ App.tsx restauré depuis App.$backupName.tsx" -ForegroundColor Green
    }
}

# Fonction pour construire avec EAS
function Build-EAS {
    param($profile, $description)
    Write-Host "`n🔨 Construction avec le profil: $profile" -ForegroundColor Yellow
    Write-Host "Description: $description" -ForegroundColor White
    
    try {
        $result = npx eas build --platform android --profile $profile --non-interactive
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Build réussi avec le profil $profile" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "❌ Build échoué avec le profil $profile" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Erreur lors du build avec le profil $profile" -ForegroundColor Red
        Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Étape 1: Sauvegarder l'App.tsx original
Write-Host "`n📁 Sauvegarde de l'App.tsx original..." -ForegroundColor Yellow
Backup-App "original"

# Étape 2: Test avec la version simple
Write-Host "`n🧪 Test 1: Version simple (sans contextes complexes)" -ForegroundColor Yellow
if (Test-Path "App.simple.tsx") {
    Copy-Item "App.simple.tsx" "App.tsx" -Force
    Write-Host "✅ App.simple.tsx activé" -ForegroundColor Green
    
    $success = Build-EAS "simple" "Version simple sans contextes complexes"
    if ($success) {
        Write-Host "🎉 SUCCÈS! La version simple fonctionne" -ForegroundColor Green
        Write-Host "Le problème vient des contextes complexes (AuthContext, Navigation)" -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ Même la version simple échoue" -ForegroundColor Red
        Write-Host "Le problème est plus profond (dépendances, configuration)" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ App.simple.tsx non trouvé" -ForegroundColor Red
}

# Étape 3: Test avec la version robuste
Write-Host "`n🛡️ Test 2: Version robuste (avec gestion d'erreur)" -ForegroundColor Yellow
if (Test-Path "App.robust.tsx") {
    Copy-Item "App.robust.tsx" "App.tsx" -Force
    Write-Host "✅ App.robust.tsx activé" -ForegroundColor Green
    
    $success = Build-EAS "debug" "Version robuste avec gestion d'erreur"
    if ($success) {
        Write-Host "🎉 SUCCÈS! La version robuste fonctionne" -ForegroundColor Green
        Write-Host "Le problème vient de la gestion d'erreur insuffisante" -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ La version robuste échoue aussi" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ App.robust.tsx non trouvé" -ForegroundColor Red
}

# Étape 4: Test avec la version originale corrigée
Write-Host "`n🔧 Test 3: Version originale corrigée" -ForegroundColor Yellow
Restore-App "original"
Write-Host "✅ Version originale restaurée" -ForegroundColor Green

$success = Build-EAS "preview" "Version originale avec corrections (AuthProvider ajouté)"
if ($success) {
    Write-Host "🎉 SUCCÈS! La version originale corrigée fonctionne" -ForegroundColor Green
    Write-Host "Le problème était l'AuthProvider manquant" -ForegroundColor Green
}
else {
    Write-Host "❌ La version originale corrigée échoue encore" -ForegroundColor Red
    Write-Host "Des corrections supplémentaires sont nécessaires" -ForegroundColor Red
}

# Résumé des résultats
Write-Host "`n📋 Résumé des tests:" -ForegroundColor Cyan
Write-Host "1. Version simple: Teste sans contextes complexes" -ForegroundColor White
Write-Host "2. Version robuste: Teste avec gestion d'erreur améliorée" -ForegroundColor White
Write-Host "3. Version corrigée: Teste avec AuthProvider ajouté" -ForegroundColor White

Write-Host "`n🎯 Recommandations:" -ForegroundColor Green
Write-Host "• Si la version simple fonctionne: Problème dans les contextes" -ForegroundColor White
Write-Host "• Si la version robuste fonctionne: Problème de gestion d'erreur" -ForegroundColor White
Write-Host "• Si la version corrigée fonctionne: Problème résolu!" -ForegroundColor White
Write-Host "• Si tout échoue: Vérifier les dépendances et la configuration" -ForegroundColor White

Write-Host "`n📱 Commandes de test manuelles:" -ForegroundColor Yellow
Write-Host "npx eas build --platform android --profile simple --non-interactive" -ForegroundColor White
Write-Host "npx eas build --platform android --profile debug --non-interactive" -ForegroundColor White
Write-Host "npx eas build --platform android --profile preview --non-interactive" -ForegroundColor White

Write-Host "`n✨ Script terminé!" -ForegroundColor Cyan





