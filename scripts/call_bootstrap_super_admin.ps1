# Script pour appeler l'endpoint bootstrap-super-admin
# Usage: .\scripts\call_bootstrap_super_admin.ps1

param(
    [string]$ApiUrl = "",
    [string]$SecretToken = ""
)

Write-Host "[ADMIN] Creation du compte SUPER SUPER ADMIN via API" -ForegroundColor Green
Write-Host ""

# Recuperer l'URL de l'API depuis les variables d'environnement ou SSM
if ([string]::IsNullOrEmpty($ApiUrl)) {
    Write-Host "[INFO] Recuperation de l'URL de l'API..." -ForegroundColor Yellow
    
    # Essayer de recuperer depuis SSM
    try {
        $apiUrlFromSsm = aws ssm get-parameter --name /yukpomnang/production/API_URL --region us-east-1 --with-decryption --query Parameter.Value --output text 2>&1
        if ($LASTEXITCODE -eq 0 -and $apiUrlFromSsm -and $apiUrlFromSsm -notmatch "error") {
            $ApiUrl = $apiUrlFromSsm.Trim()
            Write-Host "[OK] URL API recuperee depuis SSM" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARNING] Impossible de recuperer depuis SSM" -ForegroundColor Yellow
    }
    
    # Si toujours vide, demander
    if ([string]::IsNullOrEmpty($ApiUrl)) {
        $ApiUrl = Read-Host "Entrez l'URL de l'API (ex: https://api.yukpo.dev)"
    }
}

# Recuperer le token secret
if ([string]::IsNullOrEmpty($SecretToken)) {
    Write-Host "[INFO] Recuperation du token secret..." -ForegroundColor Yellow
    
    # Essayer de recuperer depuis SSM
    try {
        $tokenFromSsm = aws ssm get-parameter --name /yukpomnang/production/BOOTSTRAP_SUPER_ADMIN_TOKEN --region us-east-1 --with-decryption --query Parameter.Value --output text 2>&1
        if ($LASTEXITCODE -eq 0 -and $tokenFromSsm -and $tokenFromSsm -notmatch "error") {
            $SecretToken = $tokenFromSsm.Trim()
            Write-Host "[OK] Token recupere depuis SSM" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARNING] Impossible de recuperer depuis SSM" -ForegroundColor Yellow
    }
    
    # Si toujours vide, demander
    if ([string]::IsNullOrEmpty($SecretToken)) {
        $SecretToken = Read-Host "Entrez le token secret (BOOTSTRAP_SUPER_ADMIN_TOKEN)"
    }
}

# Nettoyer l'URL (enlever le slash final si present)
$ApiUrl = $ApiUrl.TrimEnd('/')

# Construire l'URL complete
$endpoint = "$ApiUrl/api/auth/bootstrap-super-admin"

Write-Host ""
Write-Host "[RUN] Appel de l'endpoint..." -ForegroundColor Green
Write-Host "   URL: $endpoint" -ForegroundColor Cyan
Write-Host ""

# Creer le body JSON
$body = @{
    secret_token = $SecretToken
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "[OK] Super admin cree avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Informations ===" -ForegroundColor Cyan
    Write-Host "ID: $($response.user.id)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host "Role: $($response.user.role)" -ForegroundColor White
    Write-Host "Nom: $($response.user.nom_complet)" -ForegroundColor White
    Write-Host "Tokens: $($response.user.tokens_balance)" -ForegroundColor White
    Write-Host ""
    Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
    Write-Host "Email: $($response.credentials.email)" -ForegroundColor White
    Write-Host "Mot de passe: $($response.credentials.password)" -ForegroundColor White
    Write-Host "Role: $($response.credentials.role)" -ForegroundColor White
    
} catch {
    Write-Host "[ERROR] Erreur lors de l'appel de l'API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
    if ($_.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    
    exit 1
}

Write-Host ""
Write-Host "[OK] Operation terminee!" -ForegroundColor Green

