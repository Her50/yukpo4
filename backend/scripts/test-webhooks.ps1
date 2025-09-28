# Script de test pour les webhooks de paiement
# Usage: .\test-webhooks.ps1 [base_url]

param(
    [string]$BaseUrl = "http://localhost:8080"
)

$ApiBaseUrl = "$BaseUrl/api"

Write-Host "🧪 Test des Webhooks de Paiement" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Cyan

# Fonction pour tester un endpoint
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [string]$Description
    )
    
    Write-Host "`nTesting: $Description" -ForegroundColor Yellow
    Write-Host "Endpoint: $Method $Endpoint" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Data) {
            $response = Invoke-RestMethod -Uri "$ApiBaseUrl$Endpoint" -Method $Method -Headers $headers -Body $Data -ErrorAction Stop
        }
        else {
            $response = Invoke-RestMethod -Uri "$ApiBaseUrl$Endpoint" -Method $Method -Headers $headers -ErrorAction Stop
        }
        
        Write-Host "✅ Success" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    }
    catch {
        Write-Host "❌ Failed" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

# Test 1: Santé des webhooks
Test-Endpoint -Method "GET" -Endpoint "/webhooks/health" -Description "Santé des webhooks"

# Test 2: Webhook de test Orange Money
$orangeMoneyData = @{
    transaction_id = "test_orange_123"
    status         = "SUCCESS"
    amount         = 1000
    currency       = "XAF"
    phone_number   = "675123456"
    payment_method = "orange_money"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/webhooks/test" -Data $orangeMoneyData -Description "Webhook de test Orange Money"

# Test 3: Webhook de test MTN Money
$mtnMoneyData = @{
    transaction_id = "test_mtn_456"
    status         = "SUCCESS"
    amount         = 2500
    currency       = "XAF"
    phone_number   = "675987654"
    payment_method = "mtn_money"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/webhooks/test" -Data $mtnMoneyData -Description "Webhook de test MTN Money"

# Test 4: Webhook de test avec échec
$failedData = @{
    transaction_id = "test_failed_789"
    status         = "FAILED"
    amount         = 500
    currency       = "XAF"
    phone_number   = "675111222"
    payment_method = "orange_money"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/webhooks/test" -Data $failedData -Description "Webhook de test avec échec"

# Test 5: Validation de numéro de téléphone (Cameroun)
$phoneValidationCM = @{
    phone_number = "675123456"
    country      = "CM"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/payments/validate-phone" -Data $phoneValidationCM -Description "Validation numéro Cameroun"

# Test 6: Validation de numéro de téléphone (Côte d'Ivoire)
$phoneValidationCI = @{
    phone_number = "0712345678"
    country      = "CI"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/payments/validate-phone" -Data $phoneValidationCI -Description "Validation numéro Côte d'Ivoire"

# Test 7: Validation de numéro invalide
$invalidPhone = @{
    phone_number = "123"
    country      = "CM"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/payments/validate-phone" -Data $invalidPhone -Description "Validation numéro invalide"

# Test 8: Validation sans pays (détection automatique)
$autoDetection = @{
    phone_number = "+237675123456"
} | ConvertTo-Json

Test-Endpoint -Method "POST" -Endpoint "/payments/validate-phone" -Data $autoDetection -Description "Validation avec détection automatique"

# Test des méthodes de paiement disponibles
Test-Endpoint -Method "GET" -Endpoint "/payments/methods" -Description "Méthodes de paiement"

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Tests terminés" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Cyan

Write-Host "`n🎉 Tous les tests sont terminés !" -ForegroundColor Green
Write-Host "`nNote: Pour tester les webhooks avec authentification JWT, vous devez d'abord vous connecter et obtenir un token." -ForegroundColor Yellow
Write-Host "Utilisez: " -NoNewline -ForegroundColor Yellow
Write-Host "Invoke-RestMethod -Uri '$ApiBaseUrl/auth/login' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{\"email\":\"your_email\",\"password\":\"your_password\"}'" -ForegroundColor Cyan


