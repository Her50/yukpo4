# Script pour générer un son d'alerte simple (si ffmpeg est disponible)
# Alternative: Télécharge depuis une source en ligne

Write-Host "🔊 Génération d'un son d'alerte simple..." -ForegroundColor Cyan

$outputFile = "delivery_alert.mp3"

# Vérifier si ffmpeg est disponible
$ffmpegAvailable = $false
try {
    $ffmpegVersion = ffmpeg -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ffmpegAvailable = $true
        Write-Host "✅ ffmpeg détecté" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  ffmpeg non disponible" -ForegroundColor Yellow
}

if ($ffmpegAvailable) {
    Write-Host "🎵 Génération d'un bip d'alerte avec ffmpeg..." -ForegroundColor Cyan
    
    # Générer un bip simple (440 Hz, 0.5 secondes)
    $tempWav = "temp_alert.wav"
    
    try {
        # Générer un son de bip (440 Hz = note La)
        ffmpeg -f lavfi -i "sine=frequency=800:duration=0.3" -f lavfi -i "sine=frequency=1000:duration=0.3" -filter_complex "[0][1]amix=inputs=2:duration=first:dropout_transition=0" -ar 44100 -ac 2 $tempWav
        
        if (Test-Path $tempWav) {
            # Convertir en MP3
            ffmpeg -i $tempWav -codec:a libmp3lame -b:a 128k $outputFile -y
            
            # Nettoyer
            Remove-Item $tempWav -ErrorAction SilentlyContinue
            
            if (Test-Path $outputFile) {
                $fileSize = (Get-Item $outputFile).Length / 1KB
                Write-Host "✅ Son généré avec succès: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Green
                Write-Host "📁 Fichier: $outputFile" -ForegroundColor Cyan
                exit 0
            }
        }
    } catch {
        Write-Host "❌ Erreur lors de la génération: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Si ffmpeg n'est pas disponible, proposer le téléchargement
Write-Host ""
Write-Host "⚠️  Génération locale impossible (ffmpeg requis)" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Solutions alternatives:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Installer ffmpeg" -ForegroundColor White
Write-Host "   winget install ffmpeg" -ForegroundColor Gray
Write-Host "   ou: choco install ffmpeg" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Télécharger depuis une source en ligne" -ForegroundColor White
Write-Host "   Exécutez: .\download-delivery-alert.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Télécharger manuellement" -ForegroundColor White
Write-Host "   1. Visitez: https://pixabay.com/sound-effects/search/notification/" -ForegroundColor Gray
Write-Host "   2. Téléchargez un son d'alerte (MP3)" -ForegroundColor Gray
Write-Host "   3. Renommez en 'delivery_alert.mp3'" -ForegroundColor Gray
Write-Host "   4. Placez dans ce dossier" -ForegroundColor Gray
Write-Host ""

