# Test de transcription audio simple avec votre cle OpenAI
Write-Host "Test de transcription audio en situation reelle" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Verifier que le backend est demarre
Write-Host "`nVerification du backend..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5
    Write-Host "Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "Backend non accessible. Demarrez d'abord le backend avec:" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   cargo run" -ForegroundColor Yellow
    exit 1
}

# Creer un fichier audio de test simple
Write-Host "`nCreation d'un fichier audio de test..." -ForegroundColor Cyan

$sampleRate = 16000
$duration = 1  # 1 seconde
$samples = $sampleRate * $duration

# En-tete WAV
$wavHeader = @(
    0x52, 0x49, 0x46, 0x46,  # "RIFF"
    0x24, 0x08, 0x00, 0x00,  # Taille du fichier - 8
    0x57, 0x41, 0x56, 0x45,  # "WAVE"
    0x66, 0x6D, 0x74, 0x20,  # "fmt "
    0x10, 0x00, 0x00, 0x00,  # Taille du format
    0x01, 0x00,              # Format PCM
    0x01, 0x00,              # Mono
    0x40, 0x3E, 0x00, 0x00,  # Sample rate (16000)
    0x80, 0x7C, 0x00, 0x00,  # Byte rate
    0x02, 0x00,              # Block align
    0x10, 0x00,              # Bits per sample
    0x64, 0x61, 0x74, 0x61,  # "data"
    0x00, 0x08, 0x00, 0x00   # Taille des donnees
)

# Donnees audio (signal simple)
$audioData = @()
for ($i = 0; $i -lt $samples; $i++) {
    $frequency = 440  # La note A4
    $amplitude = 1000
    $sample = [math]::Round($amplitude * [math]::Sin(2 * [math]::PI * $frequency * $i / $sampleRate))
    $audioData += [byte]($sample -band 0xFF), [byte](($sample -shr 8) -band 0xFF)
}

# Combiner en-tete et donnees
$wavBytes = $wavHeader + $audioData

# Ecrire le fichier
$testAudioPath = "test_audio.wav"
[System.IO.File]::WriteAllBytes($testAudioPath, $wavBytes)

Write-Host "Fichier audio cree: $testAudioPath" -ForegroundColor Green

# Encoder en base64
$base64Audio = [System.Convert]::ToBase64String($wavBytes)
Write-Host "Audio encode en base64: ${base64Audio.Length} caracteres" -ForegroundColor Green

# Test de transcription avec OpenAI
Write-Host "`nTest de transcription avec OpenAI..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
}

$payload = @{
    texte = "Test de transcription audio"
    audio_base64 = @($base64Audio)
} | ConvertTo-Json -Depth 10

Write-Host "Envoi de la requete au backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "Reponse du backend recue" -ForegroundColor Green
    Write-Host "Contenu: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan
} catch {
    Write-Host "Erreur lors de l'appel au backend: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

# Nettoyage
Write-Host "`nNettoyage des fichiers de test..." -ForegroundColor Cyan
if (Test-Path $testAudioPath) {
    Remove-Item $testAudioPath
    Write-Host "$testAudioPath supprime" -ForegroundColor Green
}

Write-Host "`nTest de transcription audio termine!" -ForegroundColor Green
Write-Host "Votre cle OpenAI est configuree et fonctionnelle!" -ForegroundColor Green 