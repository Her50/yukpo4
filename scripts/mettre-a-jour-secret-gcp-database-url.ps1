# Script pour mettre à jour le secret GitHub GCP_DATABASE_URL
# Date: 2026-02-15
# Objectif: Mettre à jour le secret GitHub avec le format Cloud SQL Unix socket

param(
    [string]$GitHubToken = "",
    [string]$Repository = "Her50/yukpo4",
    [string]$SecretName = "GCP_DATABASE_URL",
    [string]$Password = "TempPassword123!",
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$UserName = "yukpo_user"
)

Write-Host "Mise a jour Secret GitHub GCP_DATABASE_URL" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Récupérer le connection name
Write-Host "[ETAPE 1/3] Recuperation connection name Cloud SQL..." -ForegroundColor Yellow
$connectionName = gcloud sql instances describe $InstanceName --format="value(connectionName)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $connectionName) {
    Write-Host "   [OK] Connection Name: $connectionName" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible de recuperer le connection name" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Construire la DATABASE_URL
Write-Host "[ETAPE 2/3] Construction DATABASE_URL Cloud SQL..." -ForegroundColor Yellow
$databaseUrl = "postgresql://${UserName}:${Password}@/${DatabaseName}?host=/cloudsql/${connectionName}"
Write-Host "   [OK] DATABASE_URL construite" -ForegroundColor Green
Write-Host "   Format: postgresql://${UserName}:***@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor Gray
Write-Host ""

# Mettre à jour le secret GitHub
Write-Host "[ETAPE 3/3] Mise a jour secret GitHub..." -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($GitHubToken)) {
    Write-Host "   [INFO] Token GitHub non fourni" -ForegroundColor Yellow
    Write-Host "   [INFO] Vous devez mettre a jour le secret manuellement:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   1. Aller sur: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor White
    Write-Host "   2. Trouver le secret: $SecretName" -ForegroundColor White
    Write-Host "   3. Cliquer sur 'Update'" -ForegroundColor White
    Write-Host "   4. Coller cette valeur:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $databaseUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   [INFO] OU utiliser GitHub CLI:" -ForegroundColor Yellow
    Write-Host "   echo '$databaseUrl' | gh secret set $SecretName --repo $Repository" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "   [INFO] Utilisation de l'API GitHub pour mettre a jour le secret..." -ForegroundColor Yellow
    
    # Encoder la valeur en base64
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($databaseUrl)
    $base64Value = [Convert]::ToBase64String($bytes)
    
    # Récupérer la clé publique du repository
    $publicKeyUrl = "https://api.github.com/repos/$Repository/actions/secrets/public-key"
    $headers = @{
        "Authorization" = "Bearer $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    try {
        $publicKeyResponse = Invoke-RestMethod -Uri $publicKeyUrl -Method Get -Headers $headers
        $publicKey = $publicKeyResponse.key
        $keyId = $publicKeyResponse.key_id
        
        Write-Host "   [OK] Cle publique recuperee" -ForegroundColor Green
        
        # Chiffrer la valeur avec la clé publique (nécessite libsodium)
        Write-Host "   [INFO] Chiffrement de la valeur..." -ForegroundColor Yellow
        Write-Host "   [ATTENTION] Le chiffrement avec libsodium n'est pas implemente dans ce script" -ForegroundColor Yellow
        Write-Host "   [INFO] Utilisez GitHub CLI ou mettez a jour manuellement" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Valeur a mettre a jour:" -ForegroundColor Cyan
        Write-Host "   $databaseUrl" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "   [ERREUR] Impossible de recuperer la cle publique: $_" -ForegroundColor Red
        Write-Host "   [INFO] Mettez a jour le secret manuellement" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Valeur a mettre a jour:" -ForegroundColor Cyan
        Write-Host "   $databaseUrl" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host "[OK] Instructions terminees!" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Repository: $Repository" -ForegroundColor White
Write-Host "   Secret: $SecretName" -ForegroundColor White
Write-Host "   Connection Name: $connectionName" -ForegroundColor White
Write-Host "   DATABASE_URL: postgresql://${UserName}:***@/${DatabaseName}?host=/cloudsql/${connectionName}" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Mettre a jour le secret GitHub $SecretName" -ForegroundColor White
Write-Host "   2. Declencher le workflow GitHub Actions (push ou manual)" -ForegroundColor White
Write-Host "   3. Verifier les logs Cloud Run apres deploiement" -ForegroundColor White
Write-Host ""

