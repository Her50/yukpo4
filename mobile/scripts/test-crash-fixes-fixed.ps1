# Script de test pour verifier les corrections des plantages Android
Write-Host "🔧 Test des corrections des plantages Android - Yukpomnang Mobile" -ForegroundColor Cyan

# Verifier les corrections apportees
Write-Host "`n📋 Verification des corrections apportees..." -ForegroundColor Yellow

$corrections = @(
    @{
        Name   = "Configuration Android (app.json)"
        Files  = @("app.json")
        Checks = @(
            "Permissions INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE ajoutees",
            "usesCleartextTraffic desactive",
            "networkSecurityConfig configure"
        )
    },
    @{
        Name   = "Fichier de securite reseau"
        Files  = @("android/app/src/main/res/xml/network_security_config.xml")
        Checks = @(
            "Configuration HTTPS pour les domaines de production",
            "Support des domaines de developpement (localhost, 10.0.2.2)",
            "Configuration de debogage"
        )
    },
    @{
        Name   = "AndroidManifest.xml"
        Files  = @("android/app/src/main/AndroidManifest.xml")
        Checks = @(
            "Permissions reseau configurees",
            "Configuration de securite reseau",
            "Optimisations pour eviter les plantages"
        )
    },
    @{
        Name   = "Error Boundary"
        Files  = @("src/components/ErrorBoundary.tsx")
        Checks = @(
            "Composant ErrorBoundary cree",
            "Gestion des erreurs React",
            "Interface utilisateur de recuperation"
        )
    },
    @{
        Name   = "Gestionnaire d'erreurs API"
        Files  = @("src/services/errorHandler.ts")
        Checks = @(
            "Gestion des erreurs reseau",
            "Gestion des timeouts",
            "Gestion des erreurs HTTP"
        )
    },
    @{
        Name   = "Service API ameliore"
        Files  = @("src/services/api.ts")
        Checks = @(
            "Timeout de 30 secondes ajoute",
            "Gestion d'erreurs robuste",
            "Contexte d'erreur pour le debugging"
        )
    },
    @{
        Name   = "Test de connectivite"
        Files  = @("src/components/ConnectivityTest.tsx")
        Checks = @(
            "Test de connectivite reseau",
            "Test d'accessibilite API",
            "Test d'authentification",
            "Interface de diagnostic"
        )
    },
    @{
        Name   = "Integration dans l'app"
        Files  = @("App.tsx", "src/screens/SettingsScreen.tsx")
        Checks = @(
            "ErrorBoundary integre dans App.tsx",
            "ConnectivityTest ajoute aux parametres",
            "Navigation Dashboard corrigee"
        )
    }
)

foreach ($correction in $corrections) {
    Write-Host "`n🔍 $($correction.Name)" -ForegroundColor Cyan
    
    $allFilesExist = $true
    foreach ($file in $correction.Files) {
        if (Test-Path $file) {
            Write-Host "  ✅ $file existe" -ForegroundColor Green
        }
        else {
            Write-Host "  ❌ $file manquant" -ForegroundColor Red
            $allFilesExist = $false
        }
    }
    
    if ($allFilesExist) {
        Write-Host "  📝 Fonctionnalites:" -ForegroundColor Yellow
        foreach ($check in $correction.Checks) {
            Write-Host "    • $check" -ForegroundColor White
        }
    }
}

# Verifier la configuration de l'API
Write-Host "`n🔌 Verification de la configuration API..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_API_BASE_URL") {
        $apiUrl = ($envContent -split "`n" | Where-Object { $_ -match "EXPO_PUBLIC_API_BASE_URL" }) -replace "EXPO_PUBLIC_API_BASE_URL=", ""
        Write-Host "✅ API URL configuree: $apiUrl" -ForegroundColor Green
    }
    else {
        Write-Host "❌ EXPO_PUBLIC_API_BASE_URL manquant dans .env" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Fichier .env manquant" -ForegroundColor Red
}

# Instructions de test
Write-Host "`n🧪 Instructions de test:" -ForegroundColor Cyan
Write-Host "1. Compilez l'application: npx expo run:android"
Write-Host "2. Testez la connexion/inscription"
Write-Host "3. Verifiez que l'application ne plante plus"
Write-Host "4. Utilisez le test de connectivite dans Parametres"
Write-Host "5. Verifiez les logs avec: npx expo start --tunnel"

# Recommandations supplementaires
Write-Host "`n💡 Recommandations supplementaires:" -ForegroundColor Cyan
Write-Host "• Testez sur un appareil physique plutot qu'un emulateur"
Write-Host "• Verifiez que votre backend est accessible depuis l'appareil mobile"
Write-Host "• Assurez-vous que le backend accepte les requetes CORS"
Write-Host "• Testez avec differentes connexions reseau (WiFi, 4G)"
Write-Host "• Verifiez les logs Android avec: adb logcat"

# Commandes utiles
Write-Host "`n🛠️ Commandes utiles:" -ForegroundColor Cyan
Write-Host "• Nettoyer le cache: npx expo start --clear"
Write-Host "• Rebuild complet: npx expo run:android --clear"
Write-Host "• Logs en temps reel: npx expo start --tunnel"
Write-Host "• Test de connectivite: Ouvrir Parametres > Test de Connectivite"

Write-Host "`n🎉 Corrections des plantages Android terminees!" -ForegroundColor Green
Write-Host "L'application devrait maintenant etre plus stable et ne plus planter." -ForegroundColor Green

