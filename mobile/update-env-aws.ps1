# Script pour mettre à jour .env avec l'URL AWS
$envPath = ".env"

if (Test-Path $envPath) {
    Write-Host "Mise à jour du fichier .env..." -ForegroundColor Cyan
    
    # Lire le contenu actuel
    $content = Get-Content $envPath -Raw
    
    # Remplacer ou ajouter EXPO_PUBLIC_API_URL
    if ($content -match 'EXPO_PUBLIC_API_URL=') {
        $content = $content -replace 'EXPO_PUBLIC_API_URL=[^\r\n]*', 'EXPO_PUBLIC_API_URL=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com'
        Write-Host "  ✓ EXPO_PUBLIC_API_URL mis à jour" -ForegroundColor Green
    } else {
        $content = "EXPO_PUBLIC_API_URL=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`n" + $content
        Write-Host "  ✓ EXPO_PUBLIC_API_URL ajouté" -ForegroundColor Green
    }
    
    # Remplacer ou ajouter EXPO_PUBLIC_WS_URL
    if ($content -match 'EXPO_PUBLIC_WS_URL=') {
        $content = $content -replace 'EXPO_PUBLIC_WS_URL=[^\r\n]*', 'EXPO_PUBLIC_WS_URL=wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com'
        Write-Host "  ✓ EXPO_PUBLIC_WS_URL mis à jour" -ForegroundColor Green
    } else {
        $content = "EXPO_PUBLIC_WS_URL=wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`n" + $content
        Write-Host "  ✓ EXPO_PUBLIC_WS_URL ajouté" -ForegroundColor Green
    }
    
    # Supprimer l'ancienne variable EXPO_PUBLIC_API_BASE_URL si elle pointe vers Render
    if ($content -match 'EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com') {
        $content = $content -replace 'EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com[^\r\n]*\r?\n?', ''
        Write-Host "  ✓ EXPO_PUBLIC_API_BASE_URL (Render) supprimé" -ForegroundColor Yellow
    }
    
    # Sauvegarder
    $content | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
    Write-Host "`nFichier .env mis a jour avec succes!" -ForegroundColor Green
    
    Write-Host "`nVariables AWS configurées:" -ForegroundColor Cyan
    Get-Content $envPath | Select-String -Pattern "EXPO_PUBLIC_API_URL|EXPO_PUBLIC_WS_URL" | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
} else {
    Write-Host "Création du fichier .env..." -ForegroundColor Cyan
    @"
# Configuration backend AWS
EXPO_PUBLIC_API_URL=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_ENVIRONMENT=production
"@ | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "Fichier .env cree avec succes!" -ForegroundColor Green
}

