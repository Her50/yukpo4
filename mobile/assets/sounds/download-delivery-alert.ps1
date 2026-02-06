# Script pour télécharger un son d'alerte de livraison
Write-Host "🚚 Téléchargement du son d'alerte de livraison..." -ForegroundColor Cyan

$outputFile = "delivery_alert.mp3"

# Sources de sons d'alerte libres de droits
# Note: Ces URLs peuvent changer, mais ce sont des exemples de sources valides
$urls = @(
    # Son d'alerte simple depuis une source publique
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
    "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
    "https://actions.google.com/sounds/v1/alarms/analog_watch_alarm.ogg"
)

$success = $false
foreach ($url in $urls) {
    try {
        Write-Host "Essai: $url" -ForegroundColor Yellow
        Invoke-WebRequest -Uri $url -OutFile $outputFile -UseBasicParsing -UserAgent "Mozilla/5.0"
        
        if (Test-Path $outputFile) {
            $fileSize = (Get-Item $outputFile).Length / 1KB
            Write-Host "✅ SUCCÈS! Fichier téléchargé: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Green
            
            # Si c'est un fichier OGG, on peut le garder ou le convertir
            if ($outputFile -like "*.ogg") {
                Write-Host "⚠️  Fichier OGG détecté. Pour MP3, utilisez un convertisseur en ligne." -ForegroundColor Yellow
                Write-Host "   Ou renommez en delivery_alert.ogg (moins compatible)" -ForegroundColor Yellow
            }
            
            $success = $true
            break
        }
    } catch {
        Write-Host "❌ Échec pour cette source: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "⚠️  Téléchargement automatique impossible." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📥 Téléchargez manuellement depuis:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Pixabay (recommandé):" -ForegroundColor White
    Write-Host "   https://pixabay.com/sound-effects/search/notification/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Freesound:" -ForegroundColor White
    Write-Host "   https://freesound.org/search/?q=notification+alert" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Zapsplat:" -ForegroundColor White
    Write-Host "   https://www.zapsplat.com/sound-effect-category/notification-sounds/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. YouTube Audio Library:" -ForegroundColor White
    Write-Host "   https://www.youtube.com/audiolibrary" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📝 Instructions:" -ForegroundColor Cyan
    Write-Host "   1. Téléchargez un son d'alerte/notification (MP3)" -ForegroundColor White
    Write-Host "   2. Renommez en 'delivery_alert.mp3'" -ForegroundColor White
    Write-Host "   3. Placez dans ce dossier" -ForegroundColor White
    Write-Host ""
}






