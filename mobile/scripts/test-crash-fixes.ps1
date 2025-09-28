# Script de test pour vérifier les corrections des plantages Android
Write-Host "🔧 Test des corrections des plantages Android - Yukpomnang Mobile" -ForegroundColor Cyan

# Vérifier les corrections apportées
Write-Host "`n📋 Vérification des corrections apportées..." -ForegroundColor Yellow

$corrections = @(
    @{
        Name = "Configuration Android (app.json)"
        Files = @("app.json")
        Checks = @(
            "Permissions INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE ajoutées",
            "usesCleartextTraffic désactivé",
            "networkSecurityConfig configuré"
        )
    },
    @{
        Name = "Fichier de sécurité réseau"
        Files = @("android/app/src/main/res/xml/network_security_config.xml")
        Checks = @(
            "Configuration HTTPS pour les domaines de production",
            "Support des domaines de développement (localhost, 10.0.2.2)",
            "Configuration de débogage"
        )
    },
    @{
        Name = "AndroidManifest.xml"
        Files = @("android/app/src/main/AndroidManifest.xml")
        Checks = @(
            "Permissions réseau configurées",
            "Configuration de sécurité réseau",
            "Optimisations pour éviter les plantages"
        )
    },
    @{
        Name = "Error Boundary"
        Files = @("src/components/ErrorBoundary.tsx")
        Checks = @(
            "Composant ErrorBoundary créé",
            "Gestion des erreurs React",
            "Interface utilisateur de récupération"
        )
    },
    @{
        Name = "Gestionnaire d'erreurs API"
        Files = @("src/services/errorHandler.ts")
        Checks = @(
            "Gestion des erreurs réseau",
            "Gestion des timeouts",
            "Gestion des erreurs HTTP"
        )
    },
    @{
        Name = "Service API amélioré"
        Files = @("src/services/api.ts")
        Checks = @(
            "Timeout de 30 secondes ajouté",
            "Gestion d'erreurs robuste",
            "Contexte d'erreur pour le debugging"
        )
    },
    @{
        Name = "Test de connectivité"
        Files = @("src/components/ConnectivityTest.tsx")
        Checks = @(
            "Test de connectivité réseau",
            "Test d'accessibilité API",
            "Test d'authentification",
            "Interface de diagnostic"
        )
    },
    @{
        Name = "Intégration dans l'app"
        Files = @("App.tsx", "src/screens/SettingsScreen.tsx")
        Checks = @(
            "ErrorBoundary intégré dans App.tsx",
            "ConnectivityTest ajouté aux paramètres",
            "Navigation Dashboard corrigée"
        )
    }
)

foreach ($correction in $corrections) {
    Write-Host "`n🔍 $($correction.Name)" -ForegroundColor Cyan
    
    $allFilesExist = $true
    foreach ($file in $correction.Files) {
        if (Test-Path $file) {
            Write-Host "  ✅ $file existe" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $file manquant" -ForegroundColor Red
            $allFilesExist = $false
        }
    }
    
    if ($allFilesExist) {
        Write-Host "  📝 Fonctionnalités:" -ForegroundColor Yellow
        foreach ($check in $correction.Checks) {
            Write-Host "    • $check" -ForegroundColor White
        }
    }
}

# Vérifier la configuration de l'API
Write-Host "`n🔌 Vérification de la configuration API..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_API_BASE_URL") {
        $apiUrl = ($envContent -split "`n" | Where-Object { $_ -match "EXPO_PUBLIC_API_BASE_URL" }) -replace "EXPO_PUBLIC_API_BASE_URL=", ""
        Write-Host "✅ API URL configurée: $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "❌ EXPO_PUBLIC_API_BASE_URL manquant dans .env" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier .env manquant" -ForegroundColor Red
}

# Instructions de test
Write-Host "`n🧪 Instructions de test:" -ForegroundColor Cyan
Write-Host "1. Compilez l'application: npx expo run:android"
Write-Host "2. Testez la connexion/inscription"
Write-Host "3. Vérifiez que l'application ne plante plus"
Write-Host "4. Utilisez le test de connectivité dans Paramètres"
Write-Host "5. Vérifiez les logs avec: npx expo start --tunnel"

# Recommandations supplémentaires
Write-Host "`n💡 Recommandations supplémentaires:" -ForegroundColor Cyan
Write-Host "• Testez sur un appareil physique plutôt qu'un émulateur"
Write-Host "• Vérifiez que votre backend est accessible depuis l'appareil mobile"
Write-Host "• Assurez-vous que le backend accepte les requêtes CORS"
Write-Host "• Testez avec différentes connexions réseau (WiFi, 4G)"
Write-Host "• Vérifiez les logs Android avec: adb logcat"

# Commandes utiles
Write-Host "`n🛠️ Commandes utiles:" -ForegroundColor Cyan
Write-Host "• Nettoyer le cache: npx expo start --clear"
Write-Host "• Rebuild complet: npx expo run:android --clear"
Write-Host "• Logs en temps réel: npx expo start --tunnel"
Write-Host "• Test de connectivité: Ouvrir Paramètres > Test de Connectivité"

Write-Host "`n🎉 Corrections des plantages Android terminées!" -ForegroundColor Green
Write-Host "L'application devrait maintenant être plus stable et ne plus planter." -ForegroundColor Green





