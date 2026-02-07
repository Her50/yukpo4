# Script PowerShell pour obtenir le SHA-1 fingerprint Android
# Usage: .\scripts\get-sha1-fingerprint.ps1 [debug|release] [keystore-path] [alias] [password]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "debug",
    
    [Parameter(Mandatory=$false)]
    [string]$KeystorePath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Alias = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = ""
)

Write-Host "🔍 Obtention du SHA-1 fingerprint pour Android..." -ForegroundColor Cyan
Write-Host ""

if ($BuildType -eq "debug") {
    # Keystore de debug par défaut
    $DebugKeystore = "$env:USERPROFILE\.android\debug.keystore"
    
    if (Test-Path $DebugKeystore) {
        Write-Host "✅ Keystore de debug trouvé: $DebugKeystore" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 SHA-1 Fingerprint (Debug):" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        
        try {
            $result = keytool -list -v -keystore $DebugKeystore -alias androiddebugkey -storepass android -keypass android 2>&1
            $sha1Line = $result | Select-String "SHA1:"
            if ($sha1Line) {
                $sha1 = ($sha1Line -split "SHA1:")[1].Trim()
                Write-Host $sha1 -ForegroundColor White
                Write-Host ""
                Write-Host "✅ Copiez ce SHA-1 dans Google Cloud Console > OAuth 2.0 Client IDs > Android Client" -ForegroundColor Green
            } else {
                Write-Host "❌ Impossible de trouver le SHA-1 dans la sortie" -ForegroundColor Red
                Write-Host $result
            }
        } catch {
            Write-Host "❌ Erreur lors de l'exécution de keytool: $_" -ForegroundColor Red
            Write-Host ""
            Write-Host "💡 Assurez-vous que Java JDK est installé et que keytool est dans votre PATH" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Keystore de debug introuvable: $DebugKeystore" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Le keystore de debug sera créé automatiquement lors du premier build Android" -ForegroundColor Yellow
    }
} else {
    # Keystore de release
    if ([string]::IsNullOrEmpty($KeystorePath)) {
        Write-Host "❌ Pour le build release, vous devez spécifier le chemin du keystore" -ForegroundColor Red
        Write-Host ""
        Write-Host "Usage: .\scripts\get-sha1-fingerprint.ps1 release -KeystorePath 'chemin/vers/keystore.jks' -Alias 'votre-alias' -Password 'votre-password'" -ForegroundColor Yellow
        exit 1
    }
    
    if (-not (Test-Path $KeystorePath)) {
        Write-Host "❌ Keystore introuvable: $KeystorePath" -ForegroundColor Red
        exit 1
    }
    
    if ([string]::IsNullOrEmpty($Alias) -or [string]::IsNullOrEmpty($Password)) {
        Write-Host "❌ Pour le build release, vous devez spécifier l'alias et le mot de passe" -ForegroundColor Red
        Write-Host ""
        Write-Host "Usage: .\scripts\get-sha1-fingerprint.ps1 release -KeystorePath 'chemin/vers/keystore.jks' -Alias 'votre-alias' -Password 'votre-password'" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ Keystore de release trouvé: $KeystorePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 SHA-1 Fingerprint (Release):" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    try {
        $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
        $result = keytool -list -v -keystore $KeystorePath -alias $Alias -storepass $Password -keypass $Password 2>&1
        $sha1Line = $result | Select-String "SHA1:"
        if ($sha1Line) {
            $sha1 = ($sha1Line -split "SHA1:")[1].Trim()
            Write-Host $sha1 -ForegroundColor White
            Write-Host ""
            Write-Host "✅ Copiez ce SHA-1 dans Google Cloud Console > OAuth 2.0 Client IDs > Android Client" -ForegroundColor Green
        } else {
            Write-Host "❌ Impossible de trouver le SHA-1 dans la sortie" -ForegroundColor Red
            Write-Host $result
        }
    } catch {
        Write-Host "❌ Erreur lors de l'exécution de keytool: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   Guide complet: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md" -ForegroundColor White
Write-Host "   Google Cloud Console: https://console.cloud.google.com/apis/credentials" -ForegroundColor White

