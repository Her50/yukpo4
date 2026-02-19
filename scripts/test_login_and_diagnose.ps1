# Script pour tester la connexion et diagnostiquer le probleme
# Usage: .\scripts\test_login_and_diagnose.ps1

param(
    [string]$Email = "lelehernandez2007@gmail.com",
    [string]$Password = "",
    [string]$ApiUrl = "https://yukpo-backend-376093909298.europe-west1.run.app"
)

Write-Host "Test de connexion et diagnostic..." -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host "Entrez le mot de passe pour $Email:" -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "1. Test de connexion API..." -ForegroundColor Yellow
Write-Host "   URL: $ApiUrl/auth/login" -ForegroundColor Gray
Write-Host "   Email: $Email" -ForegroundColor Gray
Write-Host ""

$loginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    Write-Host "✅ Connexion reussie!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Reponse:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 3 | Write-Host
    
    if ($response.token) {
        Write-Host ""
        Write-Host "✅ Token JWT recu" -ForegroundColor Green
        Write-Host "   Longueur: $($response.token.Length) caracteres" -ForegroundColor Gray
        
        # Decoder le token JWT (base64)
        $tokenParts = $response.token -split '\.'
        if ($tokenParts.Length -eq 3) {
            $payload = $tokenParts[1]
            # Ajouter padding si necessaire
            while ($payload.Length % 4) {
                $payload += "="
            }
            try {
                $decodedBytes = [System.Convert]::FromBase64String($payload)
                $decodedJson = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
                $decoded = $decodedJson | ConvertFrom-Json
                
                Write-Host ""
                Write-Host "Token decode:" -ForegroundColor Cyan
                Write-Host "   User ID: $($decoded.sub)" -ForegroundColor Gray
                Write-Host "   Email: $($decoded.email)" -ForegroundColor Gray
                Write-Host "   Role: $($decoded.role)" -ForegroundColor Gray
                Write-Host "   Nom: $($decoded.name)" -ForegroundColor Gray
                Write-Host "   Expiration: $(Get-Date -Date ([DateTimeOffset]::FromUnixTimeSeconds($decoded.exp)).DateTime)" -ForegroundColor Gray
            } catch {
                Write-Host "⚠️ Impossible de decoder le token: $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host ""
        Write-Host "2. Points a verifier pour le probleme de navigation:" -ForegroundColor Yellow
        Write-Host "   - Le token est-il sauvegarde dans localStorage?" -ForegroundColor White
        Write-Host "   - La fonction login() du contexte est-elle appelee?" -ForegroundColor White
        Write-Host "   - La navigation vers ROUTES.HOME fonctionne-t-elle?" -ForegroundColor White
        Write-Host "   - window.location.reload() cause-t-il un probleme?" -ForegroundColor White
        Write-Host "   - Y a-t-il des erreurs dans la console du navigateur?" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Pour tester dans le navigateur:" -ForegroundColor Yellow
        Write-Host "   - Ouvrez la console (F12)" -ForegroundColor White
        Write-Host "   - Verifiez localStorage.getItem('auth_token')" -ForegroundColor White
        Write-Host "   - Verifiez les erreurs dans la console" -ForegroundColor White
        Write-Host "   - Verifiez le reseau (Network tab) pour voir les requetes" -ForegroundColor White
    } else {
        Write-Host "❌ Pas de token dans la reponse" -ForegroundColor Red
    }
    
    if ($response.tokens_balance -ne $null) {
        Write-Host ""
        Write-Host "Tokens balance: $($response.tokens_balance)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur lors de la connexion:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Code HTTP: $statusCode" -ForegroundColor Red
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Message: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "   Impossible de lire le message d'erreur" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "4. Verification dans la base de donnees:" -ForegroundColor Yellow
$tempPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
gcloud sql users set-password yukpo_user --instance=yukpo-postgres --password=$tempPassword --project=yukpo-project 2>&1 | Out-Null
Start-Sleep -Seconds 2
$env:PGPASSWORD = $tempPassword

$userQuery = "SELECT id, email, role, nom_complet, tokens_balance FROM users WHERE email = '$Email';"
$user = & psql -h 34.79.199.41 -U yukpo_user -d yukpo_db -p 5432 -c $userQuery 2>&1
$user | ForEach-Object { Write-Host $_ }

$env:PGPASSWORD = $null


