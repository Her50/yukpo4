# Test simple de la cle OpenAI
Write-Host "Test simple de la cle OpenAI" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

# Charger la cle OpenAI depuis le fichier .env du backend
Write-Host "`nChargement de la cle OpenAI..." -ForegroundColor Cyan
$envContent = Get-Content "backend\.env" -Raw
$openaiKey = ($envContent -split "`n" | Where-Object { $_ -match "OPENAI_API_KEY=" } | ForEach-Object { ($_ -split "=")[1] }).Trim()

if (-not $openaiKey) {
    Write-Host "Cle OpenAI non trouvee dans backend\.env" -ForegroundColor Red
    exit 1
}

Write-Host "Cle OpenAI trouvee: $($openaiKey.Substring(0, 10))..." -ForegroundColor Green

# Test simple avec l'API OpenAI (pas de transcription, juste verification de la cle)
Write-Host "`nTest de la cle OpenAI avec une requete simple..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $openaiKey"
    "Content-Type" = "application/json"
}

$payload = @{
    model = "gpt-3.5-turbo"
    messages = @(
        @{
            role = "user"
            content = "Dis-moi juste 'OK' si tu peux me repondre"
        }
    )
    max_tokens = 10
} | ConvertTo-Json -Depth 10

Write-Host "Envoi de la requete de test a OpenAI..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "Reponse OpenAI recue" -ForegroundColor Green
    Write-Host "Contenu: $($response.choices[0].message.content)" -ForegroundColor Cyan
    Write-Host "Cle OpenAI fonctionnelle!" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de l'appel a OpenAI: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 