# Script pour configurer Google Maps API
Write-Host "Configuration Google Maps API..." -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Cyan

# Verifier si le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "`nInstructions pour obtenir une clé Google Maps API:" -ForegroundColor Yellow
Write-Host "1. Allez sur https://console.cloud.google.com/" -ForegroundColor White
Write-Host "2. Créez un nouveau projet ou sélectionnez un projet existant" -ForegroundColor White
Write-Host "3. Activez l'API Maps JavaScript" -ForegroundColor White
Write-Host "4. Créez des identifiants (clé API)" -ForegroundColor White
Write-Host "5. Copiez la clé API" -ForegroundColor White

Write-Host "`nConfiguration actuelle:" -ForegroundColor Cyan
$currentKey = Get-Content .env | Select-String "VITE_APP_GOOGLE_MAPS_API_KEY" | ForEach-Object { $_.ToString().Split('=')[1] }
if ($currentKey -and $currentKey -ne "your_google_maps_api_key_here") {
    Write-Host "Clé API actuelle: $currentKey" -ForegroundColor Green
} else {
    Write-Host "Aucune clé API configurée" -ForegroundColor Red
}

Write-Host "`nVoulez-vous configurer une nouvelle clé API? (o/n)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "o" -or $response -eq "O") {
    Write-Host "Entrez votre clé Google Maps API:" -ForegroundColor Yellow
    $apiKey = Read-Host
    
    if ($apiKey) {
        # Mettre à jour le fichier .env
        $envContent = Get-Content .env
        $updatedContent = $envContent | ForEach-Object {
            if ($_ -match "VITE_APP_GOOGLE_MAPS_API_KEY") {
                "VITE_APP_GOOGLE_MAPS_API_KEY=$apiKey"
            } else {
                $_
            }
        }
        $updatedContent | Out-File .env -Encoding UTF8
        
        Write-Host "Clé API Google Maps configuree avec succes!" -ForegroundColor Green
        Write-Host "Redemarrez le frontend pour appliquer les changements." -ForegroundColor Yellow
    } else {
        Write-Host "Aucune clé fournie. Configuration annulee." -ForegroundColor Yellow
    }
} else {
    Write-Host "Configuration annulee." -ForegroundColor Yellow
}

Write-Host "`nPour redemarrer le frontend: .\restart-yukpo.ps1" -ForegroundColor Cyan 