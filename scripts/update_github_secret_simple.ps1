# Script simplifie pour mettre a jour le secret GitHub GCP_DATABASE_URL
# Usage: .\scripts\update_github_secret_simple.ps1 -GitHubToken "VOTRE_TOKEN"

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    
    [string]$Repository = "Her50/yukpo4",
    [string]$SecretName = "GCP_DATABASE_URL",
    [string]$DatabaseUrl = "postgresql://yukpo_user:MTeInD(Vw)b`$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
)

Write-Host "Mise a jour du secret GitHub $SecretName" -ForegroundColor Yellow
Write-Host "Repository: $Repository" -ForegroundColor Cyan
Write-Host ""

# Methode 1: Utiliser GitHub CLI (gh) si disponible
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "Utilisation de GitHub CLI (gh)..." -ForegroundColor Cyan
    
    # Se connecter avec le token
    $env:GH_TOKEN = $GitHubToken
    
    # Mettre a jour le secret
    $result = gh secret set $SecretName --repo $Repository --body $DatabaseUrl 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "OK Secret mis a jour avec succes via GitHub CLI!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "ERREUR avec GitHub CLI: $result" -ForegroundColor Red
        Write-Host "Tentative avec l'API GitHub..." -ForegroundColor Yellow
    }
}

# Methode 2: Utiliser l'API GitHub directement
Write-Host "Utilisation de l'API GitHub..." -ForegroundColor Cyan

$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $GitHubToken"
}

# Etape 1: Obtenir la clé publique
Write-Host "Recuperation de la clé publique..." -ForegroundColor Gray
try {
    $publicKeyResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/actions/secrets/public-key" -Headers $headers -Method Get
    $publicKey = $publicKeyResponse.key
    $keyId = $publicKeyResponse.key_id
    Write-Host "OK Clé publique recuperee (Key ID: $keyId)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Impossible de recuperer la clé publique" -ForegroundColor Red
    Write-Host "Message: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verifiez que:" -ForegroundColor Yellow
    Write-Host "  1. Le token a la permission 'repo'" -ForegroundColor White
    Write-Host "  2. Le repository existe: $Repository" -ForegroundColor White
    Write-Host "  3. Vous avez acces au repository" -ForegroundColor White
    exit 1
}

# Etape 2: Chiffrer le secret
Write-Host "Chiffrement du secret..." -ForegroundColor Gray

# Utiliser Python pour chiffrer (si disponible)
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "Utilisation de Python pour chiffrer..." -ForegroundColor Gray
    
    $pythonScript = @"
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
import sys

public_key_pem = """-----BEGIN PUBLIC KEY-----
$publicKey
-----END PUBLIC KEY-----"""

public_key = load_pem_public_key(public_key_pem.encode())
encrypted = public_key.encrypt(
    sys.argv[1].encode('utf-8'),
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA1()),
        algorithm=hashes.SHA1(),
        label=None
    )
)
print(base64.b64encode(encrypted).decode('utf-8'))
"@
    
    $tempPythonFile = [System.IO.Path]::GetTempFileName()
    $tempPythonFile = $tempPythonFile -replace '\.tmp$', '.py'
    
    # Convertir la clé base64 en format PEM
    $pemKey = "-----BEGIN PUBLIC KEY-----`n"
    for ($i = 0; $i -lt $publicKey.Length; $i += 64) {
        $pemKey += $publicKey.Substring($i, [Math]::Min(64, $publicKey.Length - $i)) + "`n"
    }
    $pemKey += "-----END PUBLIC KEY-----"
    
    $pythonScript = $pythonScript -replace '\$publicKey', $pemKey
    $pythonScript | Out-File -FilePath $tempPythonFile -Encoding UTF8
    
    try {
        $encryptedSecret = python $tempPythonFile $DatabaseUrl 2>&1
        if ($LASTEXITCODE -eq 0) {
            $encryptedSecret = $encryptedSecret.Trim()
            Write-Host "OK Secret chiffre avec Python" -ForegroundColor Green
            Remove-Item $tempPythonFile -ErrorAction SilentlyContinue
        } else {
            throw "Erreur Python"
        }
    } catch {
        Write-Host "ERREUR avec Python: $_" -ForegroundColor Red
        Remove-Item $tempPythonFile -ErrorAction SilentlyContinue
        Write-Host "Utilisation de la methode manuelle..." -ForegroundColor Yellow
        $encryptedSecret = $null
    }
} else {
    Write-Host "Python non disponible, utilisation de la methode manuelle..." -ForegroundColor Yellow
    $encryptedSecret = $null
}

# Si le chiffrement automatique a echoue, donner les instructions manuelles
if (-not $encryptedSecret) {
    Write-Host ""
    Write-Host "CHIFFREMENT AUTOMATIQUE IMPOSSIBLE" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SOLUTION MANUELLE (RECOMMANDEE):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Allez sur: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Cliquez sur '$SecretName' (si existe) ou 'New repository secret'" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Nom du secret: $SecretName" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Valeur du secret (copiez-collez):" -ForegroundColor White
    Write-Host "   $DatabaseUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. Cliquez sur 'Update secret' ou 'Add secret'" -ForegroundColor White
    Write-Host ""
    exit 0
}

# Etape 3: Mettre a jour le secret
Write-Host "Mise a jour du secret sur GitHub..." -ForegroundColor Gray

$body = @{
    encrypted_value = $encryptedSecret
    key_id = $keyId
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/actions/secrets/$SecretName" -Headers $headers -Method Put -Body $body -ContentType "application/json"
    
    Write-Host ""
    Write-Host "OK Secret mis a jour avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le secret $SecretName a ete mis a jour dans $Repository" -ForegroundColor Cyan
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
    Write-Host "2. Mettez a jour le secret $SecretName avec:" -ForegroundColor White
    Write-Host "   $DatabaseUrl" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "OK Mise a jour terminee!" -ForegroundColor Green


