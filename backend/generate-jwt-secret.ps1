# Script PowerShell pour générer un JWT_SECRET sécurisé
# Usage: .\generate-jwt-secret.ps1

Write-Host "🔑 Génération d'un JWT_SECRET sécurisé..." -ForegroundColor Green
Write-Host ""

# Générer 32 bytes aléatoires et les convertir en hexadécimal
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$hexString = -join ($bytes | ForEach-Object { $_.ToString("x2") })

Write-Host "✅ Clé générée avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "JWT_SECRET=$hexString" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Copiez la ligne ci-dessus dans votre fichier .env" -ForegroundColor Cyan
Write-Host ""

# Copier dans le presse-papiers si possible
try {
    $hexString | Set-Clipboard
    Write-Host "✅ Clé copiée dans le presse-papiers!" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Impossible de copier dans le presse-papiers automatiquement" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "⚠️ IMPORTANT: Ne partagez JAMAIS cette clé!" -ForegroundColor Red

