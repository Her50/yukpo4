# Script PowerShell pour configurer automatiquement OAuth Google Android
# Ce script guide l'utilisateur à travers la configuration OAuth

Write-Host "🔧 Configuration OAuth Google Android pour Yukpomnang" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Vérifier si le keystore de debug existe
$debugKeystore = "$env:USERPROFILE\.android\debug.keystore"
$hasDebugKeystore = Test-Path $debugKeystore

if ($hasDebugKeystore) {
    Write-Host "✅ Keystore de debug trouvé" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Obtention du SHA-1 fingerprint..." -ForegroundColor Yellow
    
    try {
        # Essayer d'obtenir le SHA-1
        $sha1Output = keytool -list -v -keystore $debugKeystore -alias androiddebugkey -storepass android -keypass android 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $sha1Line = $sha1Output | Select-String "SHA1:"
            if ($sha1Line) {
                $sha1 = ($sha1Line -split "SHA1:")[1].Trim()
                Write-Host "✅ SHA-1 Fingerprint (Debug):" -ForegroundColor Green
                Write-Host $sha1 -ForegroundColor White
                Write-Host ""
                Write-Host "📋 Copiez ce SHA-1 pour l'ajouter dans Google Cloud Console" -ForegroundColor Yellow
            } else {
                Write-Host "⚠️  Impossible d'extraire le SHA-1 automatiquement" -ForegroundColor Yellow
                Write-Host "   Utilisez: .\scripts\get-sha1-fingerprint.ps1 debug" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️  keytool non trouvé dans le PATH" -ForegroundColor Yellow
            Write-Host "   Assurez-vous que Java JDK est installé" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  Erreur lors de l'obtention du SHA-1: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Keystore de debug non trouvé" -ForegroundColor Yellow
    Write-Host "   Le keystore sera créé automatiquement lors du premier build Android" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Pour obtenir le SHA-1 après le premier build:" -ForegroundColor Cyan
    Write-Host "   .\scripts\get-sha1-fingerprint.ps1 debug" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Vérifier la configuration actuelle
Write-Host "📋 Vérification de la configuration actuelle..." -ForegroundColor Yellow
Write-Host ""

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    $hasAndroidClientId = $envContent -match "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\s*=\s*[^\s]"
    
    if ($hasAndroidClientId) {
        $androidClientId = ($envContent | Select-String "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() })
        if ($androidClientId -and $androidClientId -ne "") {
            Write-Host "✅ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID est configuré: $androidClientId" -ForegroundColor Green
        } else {
            Write-Host "⚠️  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID est vide dans .env" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID non trouvé dans .env" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Fichier .env non trouvé" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Instructions pour Google Cloud Console
Write-Host "📚 Étapes suivantes dans Google Cloud Console:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Allez sur: https://console.cloud.google.com/apis/credentials" -ForegroundColor White
Write-Host ""
Write-Host "2. Créez ou modifiez le client OAuth Android:" -ForegroundColor White
Write-Host "   - Type: Android" -ForegroundColor Gray
Write-Host "   - Package name: com.yukpomnang.mobile" -ForegroundColor Gray
Write-Host "   - SHA-1 fingerprint: [Utilisez le SHA-1 obtenu ci-dessus]" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Ajoutez les URI de redirection autorisés:" -ForegroundColor White
Write-Host "   - yukpomnang://" -ForegroundColor Gray
Write-Host "   - com.yukpomnang.mobile://" -ForegroundColor Gray
Write-Host "   - exp+yukpomnang-mobile://" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Copiez le Client ID Android et ajoutez-le dans:" -ForegroundColor White
Write-Host "   - mobile/.env (EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)" -ForegroundColor Gray
Write-Host "   - Ou utilisez EAS secrets pour les builds cloud" -ForegroundColor Gray
Write-Host ""

# Demander si l'utilisateur veut entrer le Client ID maintenant
$response = Read-Host "Voulez-vous entrer le Client ID Android maintenant? (o/n)"
if ($response -eq "o" -or $response -eq "O" -or $response -eq "oui") {
    $clientId = Read-Host "Entrez le Client ID Android (format: XXXX-XXXX.apps.googleusercontent.com)"
    
    if ($clientId -and $clientId -match ".+\.apps\.googleusercontent\.com") {
        # Mettre à jour le fichier .env
        if (Test-Path $envFile) {
            $envContent = Get-Content $envFile -Raw
            if ($envContent -match "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\s*=") {
                $envContent = $envContent -replace "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\s*=.*", "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$clientId"
            } else {
                $envContent += "`nEXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$clientId"
            }
            Set-Content -Path $envFile -Value $envContent -NoNewline
            Write-Host ""
            Write-Host "✅ Client ID Android ajouté dans .env" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Fichier .env non trouvé. Créez-le manuellement avec:" -ForegroundColor Yellow
            Write-Host "   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$clientId" -ForegroundColor White
        }
    } else {
        Write-Host ""
        Write-Host "❌ Format de Client ID invalide" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation complète:" -ForegroundColor Cyan
Write-Host "   mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md" -ForegroundColor White
Write-Host ""
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host "   N'oubliez pas de rebuild l'application après avoir configuré Google Cloud Console" -ForegroundColor Yellow



