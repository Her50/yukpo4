# Script pour telecharger une sonnerie d'appel
Write-Host "Telechargement de la sonnerie..." -ForegroundColor Cyan

$outputFile = "call_ringtone.mp3"

# Source alternative : Freesound (API publique)
$urls = @(
    "https://freesound.org/data/previews/320/320655_5260872-hq.mp3",
    "https://www.soundjay.com/phone/sounds/cell-phone-1.mp3",
    "https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-one/phone_cell_phone_rings_001.mp3"
)

$success = $false
foreach ($url in $urls) {
    try {
        Write-Host "Essai: $url" -ForegroundColor Yellow
        Invoke-WebRequest -Uri $url -OutFile $outputFile -UseBasicParsing -UserAgent "Mozilla/5.0"
        
        if (Test-Path $outputFile) {
            $fileSize = (Get-Item $outputFile).Length / 1KB
            Write-Host "SUCCES! Fichier telecharge: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Green
            $success = $true
            break
        }
    } catch {
        Write-Host "Echec pour cette source" -ForegroundColor Red
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "Telechargement automatique impossible." -ForegroundColor Yellow
    Write-Host "Telechargez manuellement depuis:" -ForegroundColor Cyan
    Write-Host "1. https://freesound.org/search/?q=phone+ring&f=&s=score+desc&advanced=0&g=1" -ForegroundColor White
    Write-Host "2. https://www.soundjay.com/phone-sound-effect.html" -ForegroundColor White
    Write-Host ""
    Write-Host "Puis renommez en 'call_ringtone.mp3'" -ForegroundColor Yellow
}
