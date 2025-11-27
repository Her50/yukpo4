# Script Automatique de Configuration Firebase pour Yukpomnang
# Ce script guide l'utilisateur et automatise le processus de configuration Firebase

Write-Host "Configuration Automatique Firebase pour Yukpomnang" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

# Variables
$downloadPath = "$env:USERPROFILE\Downloads"
$targetPath = "$PSScriptRoot\google-services.json"
$firebaseConsoleUrl = "https://console.firebase.google.com/"

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Host "INSTRUCTIONS :" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Firebase Console va s'ouvrir dans votre navigateur" -ForegroundColor White
    Write-Host "2. Connectez-vous avec votre compte Google" -ForegroundColor White
    Write-Host "3. Creez un nouveau projet ou selectionnez un projet existant" -ForegroundColor White
    Write-Host "4. Cliquez sur l'icone Android" -ForegroundColor White
    Write-Host "5. Entrez le package name : com.yukpomnang.mobile" -ForegroundColor White
    Write-Host "6. Telechargez google-services.json" -ForegroundColor White
    Write-Host "7. Le script detectera automatiquement le fichier telecharge" -ForegroundColor White
    Write-Host ""
    Write-Host "IMPORTANT : Le package name doit etre EXACTEMENT : com.yukpomnang.mobile" -ForegroundColor Red
    Write-Host ""
}

# Fonction pour verifier si le fichier existe dans les telechargements
function Find-GoogleServicesFile {
    $files = Get-ChildItem -Path $downloadPath -Filter "google-services.json" -ErrorAction SilentlyContinue
    if ($files) {
        $latestFile = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        return $latestFile
    }
    return $null
}

# Fonction pour copier le fichier
function Copy-GoogleServicesFile {
    param($sourceFile)
    
    try {
        Copy-Item -Path $sourceFile.FullName -Destination $targetPath -Force
        Write-Host "Fichier copie avec succes vers : $targetPath" -ForegroundColor Green
        
        $content = Get-Content $targetPath -Raw | ConvertFrom-Json
        $packageName = $content.client[0].client_info.android_client_info.package_name
        
        if ($packageName -eq "com.yukpomnang.mobile") {
            Write-Host "Package name verifie : $packageName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Package name incorrect : $packageName (attendu: com.yukpomnang.mobile)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "Erreur lors de la copie : $_" -ForegroundColor Red
        return $false
    }
}

# Afficher les instructions
Show-Instructions

# Demander confirmation
$confirm = Read-Host "Voulez-vous ouvrir Firebase Console maintenant ? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o") {
    Write-Host "Operation annulee" -ForegroundColor Red
    exit
}

# Ouvrir Firebase Console
Write-Host ""
Write-Host "Ouverture de Firebase Console..." -ForegroundColor Cyan
Start-Process $firebaseConsoleUrl

Write-Host ""
Write-Host "En attente du telechargement de google-services.json..." -ForegroundColor Yellow
Write-Host "   (Le script verifie toutes les 3 secondes)" -ForegroundColor Gray
Write-Host ""

# Attendre que l'utilisateur telecharge le fichier
$maxAttempts = 60
$attempt = 0
$fileFound = $false

while ($attempt -lt $maxAttempts -and -not $fileFound) {
    Start-Sleep -Seconds 3
    $attempt++
    
    $downloadedFile = Find-GoogleServicesFile
    
    if ($downloadedFile) {
        Write-Host ""
        Write-Host "Fichier google-services.json detecte !" -ForegroundColor Green
        Write-Host "   Fichier trouve : $($downloadedFile.FullName)" -ForegroundColor Gray
        Write-Host "   Taille : $([math]::Round($downloadedFile.Length / 1KB, 2)) KB" -ForegroundColor Gray
        Write-Host ""
        
        Write-Host "Copie du fichier vers le projet..." -ForegroundColor Cyan
        $success = Copy-GoogleServicesFile -sourceFile $downloadedFile
        
        if ($success) {
            Write-Host ""
            Write-Host "Configuration Firebase terminee avec succes !" -ForegroundColor Green
            Write-Host ""
            Write-Host "Prochaines etapes :" -ForegroundColor Yellow
            Write-Host "   1. Verifiez que le fichier est correct : mobile/google-services.json" -ForegroundColor White
            Write-Host "   2. Relancez le build : npx eas build --platform android --profile preview" -ForegroundColor White
            Write-Host ""
            $fileFound = $true
        } else {
            Write-Host ""
            Write-Host "Le fichier a ete copie mais le package name ne correspond pas." -ForegroundColor Yellow
            Write-Host "   Verifiez que vous avez utilise : com.yukpomnang.mobile" -ForegroundColor Yellow
            Write-Host ""
            $retry = Read-Host "Voulez-vous reessayer ? (O/N)"
            if ($retry -ne "O" -and $retry -ne "o") {
                break
            }
            Remove-Item $downloadedFile.FullName -Force -ErrorAction SilentlyContinue
            Write-Host "En attente d'un nouveau telechargement..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

if (-not $fileFound) {
    Write-Host ""
    Write-Host ""
    Write-Host "Temps d'attente ecoule." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Instructions manuelles :" -ForegroundColor Cyan
    Write-Host "   1. Telechargez google-services.json depuis Firebase Console" -ForegroundColor White
    Write-Host "   2. Copiez-le manuellement vers : $targetPath" -ForegroundColor White
    Write-Host "   3. Verifiez que le package name est : com.yukpomnang.mobile" -ForegroundColor White
    Write-Host ""
}

# Verification finale
if (Test-Path $targetPath) {
    Write-Host "Fichier final trouve : $targetPath" -ForegroundColor Green
    
    try {
        $content = Get-Content $targetPath -Raw | ConvertFrom-Json
        Write-Host ""
        Write-Host "Informations du fichier :" -ForegroundColor Cyan
        Write-Host "   Project ID : $($content.project_info.project_id)" -ForegroundColor White
        Write-Host "   Project Number : $($content.project_info.project_number)" -ForegroundColor White
        Write-Host "   Package Name : $($content.client[0].client_info.android_client_info.package_name)" -ForegroundColor White
        
        if ($content.project_info.project_id -eq "yukpomnang-mobile-temp") {
            Write-Host ""
            Write-Host "ATTENTION : Le fichier temporaire est toujours present !" -ForegroundColor Red
            Write-Host "   Vous devez telecharger le VRAI fichier depuis Firebase Console." -ForegroundColor Red
        }
    } catch {
        Write-Host "Impossible de lire le fichier JSON" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "Script termine." -ForegroundColor Cyan

