# Script pour mettre à jour le secret GitHub via API
# Date: 2026-02-15

param(
    [string]$GitHubToken = "",
    [string]$Repository = "Her50/yukpo4",
    [string]$SecretName = "GCP_DATABASE_URL",
    [string]$SecretValue = ""
)

if ([string]::IsNullOrEmpty($GitHubToken)) {
    Write-Host "[ERREUR] Token GitHub requis" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($SecretValue)) {
    Write-Host "[ERREUR] Valeur du secret requise" -ForegroundColor Red
    exit 1
}

Write-Host "Mise a jour secret GitHub via API" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer la clé publique du repository
$publicKeyUrl = "https://api.github.com/repos/$Repository/actions/secrets/public-key"
$headers = @{
    "Authorization" = "Bearer $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

Write-Host "[ETAPE 1/3] Recuperation cle publique..." -ForegroundColor Yellow
try {
    $publicKeyResponse = Invoke-RestMethod -Uri $publicKeyUrl -Method Get -Headers $headers
    $publicKey = $publicKeyResponse.key
    $keyId = $publicKeyResponse.key_id
    
    Write-Host "   [OK] Cle publique recuperee (Key ID: $keyId)" -ForegroundColor Green
} catch {
    Write-Host "   [ERREUR] Impossible de recuperer la cle publique: $_" -ForegroundColor Red
    Write-Host "   [INFO] Verifiez que le token a les permissions 'repo' ou 'secrets:write'" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Chiffrer la valeur avec la clé publique (nécessite libsodium)
Write-Host "[ETAPE 2/3] Chiffrement de la valeur..." -ForegroundColor Yellow
Write-Host "   [INFO] Le chiffrement avec libsodium n'est pas implemente dans PowerShell" -ForegroundColor Yellow
Write-Host "   [INFO] Utilisation de GitHub CLI si disponible..." -ForegroundColor Cyan
Write-Host ""

# Essayer avec GitHub CLI
$ghPath = Get-Command gh -ErrorAction SilentlyContinue
if ($ghPath) {
    Write-Host "   [OK] GitHub CLI trouve, utilisation de gh secret set..." -ForegroundColor Green
    
    # Configurer le token
    $env:GITHUB_TOKEN = $GitHubToken
    
    # Mettre à jour le secret
    $secretValue | gh secret set $SecretName --repo $Repository 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Secret mis a jour avec succes!" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Echec de la mise a jour via GitHub CLI" -ForegroundColor Red
        Write-Host "   [INFO] Mettez a jour manuellement via l'interface GitHub" -ForegroundColor Yellow
        Write-Host "   URL: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor Cyan
        Write-Host "   Valeur: $SecretValue" -ForegroundColor White
    }
} else {
    Write-Host "   [WARNING] GitHub CLI non trouve" -ForegroundColor Yellow
    Write-Host "   [INFO] Installation de GitHub CLI recommandee:" -ForegroundColor Cyan
    Write-Host "   winget install GitHub.cli" -ForegroundColor White
    Write-Host ""
    Write-Host "   [INFO] OU mettez a jour manuellement:" -ForegroundColor Yellow
    Write-Host "   URL: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor Cyan
    Write-Host "   Secret: $SecretName" -ForegroundColor White
    Write-Host "   Valeur: $SecretValue" -ForegroundColor White
}

Write-Host ""
Write-Host "[OK] Instructions terminees!" -ForegroundColor Green


