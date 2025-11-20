# Script PowerShell pour creer une video exemple simple avec FFmpeg
# Usage: .\create_simple_example_video.ps1

$ErrorActionPreference = "Stop"

$UPLOAD_DIR = if ($env:UPLOAD_STORAGE_PATH) { $env:UPLOAD_STORAGE_PATH } else { "./uploads" }
$EXAMPLES_DIR = Join-Path $UPLOAD_DIR "examples"
$VIDEO_PATH = Join-Path $EXAMPLES_DIR "video-creation-demo.mp4"

Write-Host "[VIDEO] Creation de la video exemple..." -ForegroundColor Cyan

# Creer le dossier si necessaire
if (-not (Test-Path $EXAMPLES_DIR)) {
    New-Item -ItemType Directory -Path $EXAMPLES_DIR -Force | Out-Null
    Write-Host "[OK] Dossier cree: $EXAMPLES_DIR" -ForegroundColor Green
}

# Verifier si FFmpeg est installe
$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegPath) {
    Write-Host "[ERREUR] FFmpeg n'est pas installe." -ForegroundColor Red
    Write-Host "   Installez FFmpeg: https://ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host "   Ou utilisez: winget install ffmpeg" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] FFmpeg trouve: $($ffmpegPath.Source)" -ForegroundColor Green

# Verifier si la video existe deja
if (Test-Path $VIDEO_PATH) {
    Write-Host "[ATTENTION] La video existe deja: $VIDEO_PATH" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous la remplacer? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Annule." -ForegroundColor Yellow
        exit 0
    }
    Remove-Item $VIDEO_PATH -Force
}

Write-Host "[VIDEO] Generation de la video (60 secondes)..." -ForegroundColor Cyan

# Creer une video simple avec FFmpeg
# Note: Sur Windows, utiliser la police par defaut
$ffmpegArgs = @(
    "-f", "lavfi",
    "-i", "color=c=0xEC4899:s=1920x1080:d=60",
    "-vf", "drawtext=text='Yukpo Video Creation Demo':fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2-100:fontcolor=white,drawtext=text='Create professional promotional videos':fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2+50:fontcolor=white",
    "-t", "60",
    "-y",
    $VIDEO_PATH
)

try {
    & ffmpeg $ffmpegArgs
    
    if ($LASTEXITCODE -eq 0) {
        $fileInfo = Get-Item $VIDEO_PATH
        $fileSize = [math]::Round($fileInfo.Length / 1MB, 2)
        Write-Host "[SUCCES] Video creee avec succes!" -ForegroundColor Green
        Write-Host "   Chemin: $VIDEO_PATH" -ForegroundColor Green
        Write-Host "   Taille: $fileSize MB" -ForegroundColor Green
        Write-Host ""
        Write-Host "La video est maintenant disponible a:" -ForegroundColor Cyan
        Write-Host "  http://localhost:3001/api/media/examples/video-creation-demo.mp4" -ForegroundColor Cyan
    }
    else {
        Write-Host "[ERREUR] Erreur lors de la creation de la video (code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] Exception: $_" -ForegroundColor Red
    exit 1
}
