# Script pour ajouter MONGODB_URL dans AWS Secrets Manager

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$secretId = "yukpo/backend/secrets"
$mongoUrl = "mongodb+srv://yukpomnang:DENQG9aru56Ixaqi@cluster1.arqkgsd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1"

Write-Host "Recuperation du secret actuel..." -ForegroundColor Cyan

$secretJson = aws secretsmanager get-secret-value `
    --secret-id $secretId `
    --region $region `
    --query 'SecretString' `
    --output text

$secret = $secretJson | ConvertFrom-Json

Write-Host "Secret actuel recupere" -ForegroundColor Green
Write-Host "Variables actuelles:" -ForegroundColor Yellow
$secret.PSObject.Properties.Name | ForEach-Object {
    Write-Host "  - $_" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Ajout de MONGODB_URL..." -ForegroundColor Cyan

# Créer un nouveau hashtable avec toutes les propriétés
$newSecret = @{}
foreach ($prop in $secret.PSObject.Properties) {
    $newSecret[$prop.Name] = $prop.Value
}

# Ajouter MONGODB_URL
$newSecret["MONGODB_URL"] = $mongoUrl

Write-Host "  MONGODB_URL = mongodb+srv://yukpomnang:***@cluster1.arqkgsd.mongodb.net/..." -ForegroundColor White

# Convertir en JSON
$updatedSecretJson = $newSecret | ConvertTo-Json -Depth 10 -Compress

# Sauvegarder dans un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$updatedSecretJson | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "Mise a jour du secret dans AWS..." -ForegroundColor Cyan

$result = aws secretsmanager put-secret-value `
    --secret-id $secretId `
    --secret-string "file://$tempFile" `
    --region $region `
    --output json 2>&1

Remove-Item $tempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MONGODB_URL ajoutee avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verification..." -ForegroundColor Cyan
    $verifySecret = aws secretsmanager get-secret-value `
        --secret-id $secretId `
        --region $region `
        --query 'SecretString' `
        --output text | ConvertFrom-Json
    
    if ($verifySecret.MONGODB_URL) {
        Write-Host "✅ MONGODB_URL verifiee dans Secrets Manager" -ForegroundColor Green
        Write-Host "  Valeur: mongodb+srv://yukpomnang:***@cluster1.arqkgsd.mongodb.net/..." -ForegroundColor Gray
    } else {
        Write-Host "❌ MONGODB_URL non trouvee apres verification" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Erreur lors de la mise a jour:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Yellow
}

