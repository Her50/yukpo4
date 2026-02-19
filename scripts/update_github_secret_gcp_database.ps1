# Script pour mettre a jour le secret GitHub GCP_DATABASE_URL automatiquement
# Usage: .\scripts\update_github_secret_gcp_database.ps1 -GitHubToken "VOTRE_TOKEN"

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    
    [string]$Repository = "Her50/yukpo4",
    [string]$SecretName = "GCP_DATABASE_URL",
    [string]$DatabaseUrl = "postgresql://yukpo_user:MTeInD(Vw)b`$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
)

Write-Host "Mise a jour du secret GitHub $SecretName" -ForegroundColor Yellow
Write-Host ""

# Verifier que curl est disponible (ou utiliser Invoke-RestMethod)
if (-not (Get-Command curl -ErrorAction SilentlyContinue) -and -not (Get-Command Invoke-RestMethod -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: curl ou Invoke-RestMethod n'est pas disponible" -ForegroundColor Red
    exit 1
}

Write-Host "Repository: $Repository" -ForegroundColor Cyan
Write-Host "Secret: $SecretName" -ForegroundColor Cyan
Write-Host ""

# Utiliser l'API GitHub pour mettre a jour le secret
# L'API GitHub utilise une clé publique pour chiffrer le secret
# Etape 1: Obtenir la clé publique du repository
Write-Host "Etape 1: Recuperation de la clé publique du repository..." -ForegroundColor Yellow

$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $GitHubToken"
}

try {
    $publicKeyResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/actions/secrets/public-key" -Headers $headers -Method Get
    
    $publicKey = $publicKeyResponse.key
    $keyId = $publicKeyResponse.key_id
    
    Write-Host "OK Clé publique recuperee" -ForegroundColor Green
    Write-Host "Key ID: $keyId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "ERREUR lors de la recuperation de la clé publique: $_" -ForegroundColor Red
    Write-Host "Verifiez que:" -ForegroundColor Yellow
    Write-Host "  1. Le token GitHub a les permissions 'repo' ou 'admin:repo'" -ForegroundColor White
    Write-Host "  2. Le repository existe et vous y avez acces" -ForegroundColor White
    Write-Host "  3. Le token est valide" -ForegroundColor White
    exit 1
}

# Etape 2: Chiffrer le secret avec la clé publique
Write-Host "Etape 2: Chiffrement du secret..." -ForegroundColor Yellow

# Pour chiffrer avec la clé publique, nous devons utiliser une bibliothèque .NET
# ou utiliser une commande externe. Pour simplifier, nous allons utiliser l'API GitHub
# qui accepte le secret en clair (mais il faut utiliser la méthode avec chiffrement)

# Utiliser la bibliothèque .NET pour chiffrer avec RSA
Add-Type -AssemblyName System.Security

try {
    # Convertir la clé publique base64 en RSAParameters
    $keyBytes = [System.Convert]::FromBase64String($publicKey)
    
    # Créer un objet RSA et importer la clé publique
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    $rsa.ImportRSAPublicKey($keyBytes, [ref]$null)
    
    # Chiffrer le secret
    $secretBytes = [System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl)
    $encryptedBytes = $rsa.Encrypt($secretBytes, [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA1)
    $encryptedSecret = [System.Convert]::ToBase64String($encryptedBytes)
    
    Write-Host "OK Secret chiffre" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERREUR lors du chiffrement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Utilisation de la methode avec libsodium (si disponible)" -ForegroundColor Yellow
    
    # Alternative: Utiliser libsodium si disponible
    # Pour l'instant, on va utiliser une méthode plus simple avec l'API GitHub
    # qui peut accepter le secret directement (mais ce n'est pas recommandé)
    
    Write-Host "Tentative avec methode alternative..." -ForegroundColor Yellow
    
    # Note: L'API GitHub nécessite vraiment le chiffrement avec la clé publique
    # Nous devons utiliser une bibliothèque externe ou une commande
    
    # Pour Windows, nous pouvons utiliser openssl si disponible
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        Write-Host "Utilisation d'OpenSSL pour chiffrer..." -ForegroundColor Cyan
        
        # Créer un fichier temporaire avec la clé publique
        $tempKeyFile = [System.IO.Path]::GetTempFileName()
        $tempKeyFile = $tempKeyFile -replace '\.tmp$', '.pem'
        
        # Convertir la clé base64 en format PEM
        $pemKey = "-----BEGIN PUBLIC KEY-----`n"
        for ($i = 0; $i -lt $publicKey.Length; $i += 64) {
            $pemKey += $publicKey.Substring($i, [Math]::Min(64, $publicKey.Length - $i)) + "`n"
        }
        $pemKey += "-----END PUBLIC KEY-----"
        
        $pemKey | Out-File -FilePath $tempKeyFile -Encoding ASCII -NoNewline
        
        # Chiffrer avec openssl
        $secretFile = [System.IO.Path]::GetTempFileName()
        $DatabaseUrl | Out-File -FilePath $secretFile -Encoding UTF8 -NoNewline
        
        $encryptedSecret = openssl rsautl -encrypt -oaep -pubin -inkey $tempKeyFile -in $secretFile | [System.Convert]::ToBase64String
        
        Remove-Item $tempKeyFile -ErrorAction SilentlyContinue
        Remove-Item $secretFile -ErrorAction SilentlyContinue
        
        Write-Host "OK Secret chiffre avec OpenSSL" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Impossible de chiffrer le secret automatiquement" -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUTION MANUELLE:" -ForegroundColor Yellow
        Write-Host "1. Allez sur: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor White
        Write-Host "2. Cliquez sur '$SecretName' ou 'New repository secret'" -ForegroundColor White
        Write-Host "3. Collez la valeur suivante:" -ForegroundColor White
        Write-Host "   $DatabaseUrl" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
}

# Etape 3: Mettre a jour le secret via l'API GitHub
Write-Host "Etape 3: Mise a jour du secret sur GitHub..." -ForegroundColor Yellow

$body = @{
    encrypted_value = $encryptedSecret
    key_id = $keyId
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/actions/secrets/$SecretName" -Headers $headers -Method Put -Body $body -ContentType "application/json"
    
    Write-Host ""
    Write-Host "OK Secret mis a jour avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le secret $SecretName a ete mis a jour dans le repository $Repository" -ForegroundColor Cyan
    Write-Host "Les prochains deploiements utiliseront automatiquement la nouvelle valeur." -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "ERREUR lors de la mise a jour: $_" -ForegroundColor Red
    
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorDetails) {
        Write-Host "Details: $($errorDetails.message)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "SOLUTION MANUELLE:" -ForegroundColor Yellow
    Write-Host "1. Allez sur: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor White
    Write-Host "2. Cliquez sur '$SecretName' ou 'New repository secret'" -ForegroundColor White
    Write-Host "3. Collez la valeur suivante:" -ForegroundColor White
    Write-Host "   $DatabaseUrl" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "OK Mise a jour terminee!" -ForegroundColor Green


