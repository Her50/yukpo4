# Script de génération du keystore Android pour signer l'application
# Ce fichier est nécessaire pour créer des APK/AAB signés

Write-Host "`n🔐 Génération du keystore Android pour Yukpomnang`n" -ForegroundColor Cyan

# Aller dans le dossier mobile
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $projectRoot "mobile"
$androidDir = Join-Path $mobileDir "android\app"

if (-Not (Test-Path $mobileDir)) {
    Write-Host "❌ Dossier mobile non trouvé: $mobileDir" -ForegroundColor Red
    exit 1
}

# Créer le dossier android/app s'il n'existe pas
if (-Not (Test-Path $androidDir)) {
    New-Item -ItemType Directory -Path $androidDir -Force | Out-Null
}

# Chemin du keystore
$keystorePath = Join-Path $androidDir "yukpomnang-release.keystore"

# Vérifier si le keystore existe déjà
if (Test-Path $keystorePath) {
    Write-Host "⚠️  Un keystore existe déjà à: $keystorePath" -ForegroundColor Yellow
    $overwrite = Read-Host "Voulez-vous le remplacer? (o/N)"
    if ($overwrite -ne "o" -and $overwrite -ne "O") {
        Write-Host "Opération annulée." -ForegroundColor Yellow
        exit 0
    }
    Remove-Item $keystorePath -Force
}

# Informations par défaut
Write-Host "📝 Informations pour le keystore:" -ForegroundColor Cyan
Write-Host "   Vous pouvez appuyer sur Entrée pour utiliser les valeurs par défaut`n" -ForegroundColor Gray

$keyAlias = Read-Host "Alias de la clé [yukpomnang-key]"
if ([string]::IsNullOrWhiteSpace($keyAlias)) { $keyAlias = "yukpomnang-key" }

$keyPassword = Read-Host "Mot de passe de la clé [yukpomnang2024]" -AsSecureString
if ($keyPassword.Length -eq 0) {
    $keyPassword = ConvertTo-SecureString "yukpomnang2024" -AsPlainText -Force
}
$keyPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassword)
)

$keystorePassword = Read-Host "Mot de passe du keystore [yukpomnang2024]" -AsSecureString
if ($keystorePassword.Length -eq 0) {
    $keystorePassword = ConvertTo-SecureString "yukpomnang2024" -AsPlainText -Force
}
$keystorePasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keystorePassword)
)

$validity = Read-Host "Validité en jours [10000]"
if ([string]::IsNullOrWhiteSpace($validity)) { $validity = "10000" }

Write-Host "`n📋 Informations du certificat:" -ForegroundColor Cyan
$orgName = Read-Host "Nom de l'organisation [Yukpomnang]"
if ([string]::IsNullOrWhiteSpace($orgName)) { $orgName = "Yukpomnang" }

$orgUnit = Read-Host "Unité organisationnelle [Mobile Dev]"
if ([string]::IsNullOrWhiteSpace($orgUnit)) { $orgUnit = "Mobile Dev" }

$city = Read-Host "Ville [Yaoundé]"
if ([string]::IsNullOrWhiteSpace($city)) { $city = "Yaoundé" }

$state = Read-Host "État/Province [Centre]"
if ([string]::IsNullOrWhiteSpace($state)) { $state = "Centre" }

$country = Read-Host "Code pays (2 lettres) [CM]"
if ([string]::IsNullOrWhiteSpace($country)) { $country = "CM" }

# Générer le DN (Distinguished Name)
$dname = "CN=$orgName, OU=$orgUnit, L=$city, ST=$state, C=$country"

Write-Host "`n🔨 Génération du keystore..." -ForegroundColor Cyan
Write-Host "   Chemin: $keystorePath" -ForegroundColor Gray

# Créer le keystore avec keytool
$keytoolCmd = "keytool"
try {
    $args = @(
        "-genkeypair",
        "-v",
        "-keystore", "`"$keystorePath`"",
        "-alias", $keyAlias,
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", $validity,
        "-storepass", $keystorePasswordPlain,
        "-keypass", $keyPasswordPlain,
        "-dname", "`"$dname`""
    )
    
    $process = Start-Process -FilePath $keytoolCmd -ArgumentList $args -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "`n✅ Keystore généré avec succès!`n" -ForegroundColor Green
        
        # Créer le fichier de configuration
        $configContent = @"
# Configuration du keystore Android - NE PAS COMMITER CE FICHIER!
# Ce fichier contient des informations sensibles

KEYSTORE_FILE=yukpomnang-release.keystore
KEY_ALIAS=$keyAlias
STORE_PASSWORD=$keystorePasswordPlain
KEY_PASSWORD=$keyPasswordPlain
"@
        
        $configPath = Join-Path $androidDir "keystore.properties"
        Set-Content -Path $configPath -Value $configContent -Encoding UTF8
        
        Write-Host "📝 Fichier de configuration créé: keystore.properties" -ForegroundColor Green
        Write-Host "`n⚠️  IMPORTANT: Sauvegardez ces informations en lieu sûr!`n" -ForegroundColor Yellow
        Write-Host "   Keystore: $keystorePath" -ForegroundColor White
        Write-Host "   Alias: $keyAlias" -ForegroundColor White
        Write-Host "   Mot de passe keystore: $keystorePasswordPlain" -ForegroundColor White
        Write-Host "   Mot de passe clé: $keyPasswordPlain`n" -ForegroundColor White
        
        # Ajouter au .gitignore
        $gitignorePath = Join-Path $mobileDir ".gitignore"
        $gitignoreContent = Get-Content -Path $gitignorePath -Raw -ErrorAction SilentlyContinue
        if ($gitignoreContent -notlike "*keystore.properties*") {
            Add-Content -Path $gitignorePath -Value "`n# Android keystore`n*.keystore`nkeystore.properties" -Encoding UTF8
            Write-Host "✅ .gitignore mis à jour" -ForegroundColor Green
        }
        
        Write-Host "`n🎯 Prochaine étape:" -ForegroundColor Cyan
        Write-Host "   Configurez build.gradle pour utiliser ce keystore`n" -ForegroundColor White
        
    } else {
        Write-Host "`n❌ Erreur lors de la génération du keystore" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n❌ Erreur: $_" -ForegroundColor Red
    Write-Host "Assurez-vous que Java JDK est installé et keytool est dans le PATH" -ForegroundColor Yellow
    exit 1
}

