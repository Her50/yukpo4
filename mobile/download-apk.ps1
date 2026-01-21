# Script pour télécharger l'APK directement depuis EAS Build
# Usage: .\download-apk.ps1 [build-id]
# Exemple: .\download-apk.ps1 6fe1c9c4-8280-454f-8d53-f6019b3b7a5b

param(
    [string]$BuildId = "6fe1c9c4-8280-454f-8d53-f6019b3b7a5b"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TELECHARGEMENT APK EAS BUILD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$buildUrl = "https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/$BuildId"

Write-Host "[INFO] Récupération des informations du build..." -ForegroundColor Yellow
Write-Host "[INFO] URL: $buildUrl" -ForegroundColor Cyan
Write-Host ""

try {
    # Tenter de récupérer l'URL de téléchargement direct
    $response = Invoke-WebRequest -Uri "$buildUrl.json" -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($response.StatusCode -eq 200) {
        $buildData = $response.Content | ConvertFrom-Json
        $downloadUrl = $buildData.artifacts.downloadUrl
        
        if ($downloadUrl) {
            Write-Host "[OK] URL de téléchargement trouvée!" -ForegroundColor Green
            Write-Host "[INFO] Téléchargement en cours..." -ForegroundColor Yellow
            
            $outputPath = "yukpomnang-preview-$BuildId.apk"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath -UseBasicParsing
            
            $fileInfo = Get-Item $outputPath
            $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
            
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "   TELECHARGEMENT REUSSI!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Fichier: $outputPath" -ForegroundColor Cyan
            Write-Host "Taille: $sizeMB MB" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Maintenant, transférez ce fichier sur votre téléphone:" -ForegroundColor Yellow
            Write-Host "1. Par USB (copier dans le dossier Downloads)" -ForegroundColor White
            Write-Host "2. Par email (pièce jointe)" -ForegroundColor White
            Write-Host "3. Par cloud (Google Drive, Dropbox, etc.)" -ForegroundColor White
            Write-Host "4. Par messagerie (WhatsApp, Telegram)" -ForegroundColor White
            Write-Host ""
            Write-Host "Sur le téléphone, ouvrez le gestionnaire de fichiers" -ForegroundColor Yellow
            Write-Host "et installez l'APK directement (pas via le navigateur)." -ForegroundColor Yellow
            Write-Host ""
            
            # Ouvrir l'explorateur Windows dans le dossier courant
            explorer .
        } else {
            Write-Host "[ERREUR] URL de téléchargement non trouvée dans les données" -ForegroundColor Red
            Write-Host ""
            Write-Host "Solution alternative:" -ForegroundColor Yellow
            Write-Host "1. Ouvrez votre navigateur sur PC" -ForegroundColor White
            Write-Host "2. Allez sur: $buildUrl" -ForegroundColor Cyan
            Write-Host "3. Cliquez sur 'Download' pour télécharger l'APK" -ForegroundColor White
            Write-Host "4. Transférez l'APK sur votre téléphone" -ForegroundColor White
        }
    }
} catch {
    Write-Host "[ERREUR] Impossible de récupérer les informations du build" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solution alternative:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez votre navigateur sur PC" -ForegroundColor White
    Write-Host "2. Allez sur: $buildUrl" -ForegroundColor Cyan
    Write-Host "3. Cliquez sur 'Download' pour télécharger l'APK" -ForegroundColor White
    Write-Host "4. Transférez l'APK sur votre téléphone via USB, email, ou cloud" -ForegroundColor White
    Write-Host ""
    Write-Host "Important: Installez l'APK depuis le gestionnaire de fichiers Android," -ForegroundColor Yellow
    Write-Host "pas via le navigateur du téléphone!" -ForegroundColor Yellow
}

