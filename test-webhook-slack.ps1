# Script de test du webhook Slack

param(
    [Parameter(Mandatory = $true)]
    [string]$WebhookUrl,
    
    [Parameter(Mandatory = $false)]
    [string]$Message = "Test alerte pipeline Yukpo - Webhook fonctionnel !"
)

Write-Host "Test du webhook Slack..." -ForegroundColor Cyan
Write-Host "URL: $WebhookUrl" -ForegroundColor Gray
Write-Host ""

try {
    $body = @{
        text       = $Message
        username   = "Yukpo Pipeline Monitor"
        icon_emoji = ":warning:"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "OK Message envoye avec succes!" -ForegroundColor Green
    Write-Host "Verifiez votre canal Slack pour voir le message." -ForegroundColor Yellow
    
}
catch {
    Write-Host "ERREUR lors de l'envoi du message" -ForegroundColor Red
    Write-Host "Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez que:" -ForegroundColor Yellow
    Write-Host "  - L'URL du webhook est correcte" -ForegroundColor Gray
    Write-Host "  - Le webhook est actif dans Slack" -ForegroundColor Gray
    Write-Host "  - Vous avez acces au canal" -ForegroundColor Gray
    exit 1
}

