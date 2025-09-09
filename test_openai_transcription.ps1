# Test direct de l'API OpenAI Whisper avec votre cle
Write-Host "Test direct de l'API OpenAI Whisper" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green

# Charger la cle OpenAI depuis le fichier .env du backend
Write-Host "`nChargement de la cle OpenAI..." -ForegroundColor Cyan
$envContent = Get-Content "backend\.env" -Raw
$openaiKey = ($envContent -split "`n" | Where-Object { $_ -match "OPENAI_API_KEY=" } | ForEach-Object { ($_ -split "=")[1] }).Trim()

if (-not $openaiKey) {
    Write-Host "Cle OpenAI non trouvee dans backend\.env" -ForegroundColor Red
    exit 1
}

Write-Host "Cle OpenAI trouvee: $($openaiKey.Substring(0, 10))..." -ForegroundColor Green

# Creer un fichier audio de test
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

# Ecrire le fichier temporaire
$tempAudioPath = "temp_test_audio.wav"
[System.IO.File]::WriteAllBytes($tempAudioPath, $wavBytes)

Write-Host "Fichier audio cree: $tempAudioPath" -ForegroundColor Green

# Test direct avec l'API OpenAI Whisper
Write-Host "`nTest direct avec l'API OpenAI Whisper..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $openaiKey"
}

# Creer le multipart form data
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"model`"",
    "",
    "whisper-1",
    "--$boundary",
    "Content-Disposition: form-data; name=`"language`"",
    "",
    "fr",
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"test.wav`"",
    "Content-Type: audio/wav",
    "",
    ""
)

$body = $bodyLines -join $LF + $LF
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

# Ajouter les donnees audio
$bodyBytes += $wavBytes

# Ajouter la fin du multipart
$endBoundary = $LF + "--$boundary--" + $LF
$bodyBytes += [System.Text.Encoding]::UTF8.GetBytes($endBoundary)

$headers["Content-Type"] = "multipart/form-data; boundary=$boundary"

Write-Host "Envoi de la requete a OpenAI..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/audio/transcriptions" -Method POST -Headers $headers -Body $bodyBytes -TimeoutSec 30
    Write-Host "Reponse OpenAI recue" -ForegroundColor Green
    Write-Host "Transcription: $($response.text)" -ForegroundColor Cyan
} catch {
    Write-Host "Erreur lors de l'appel a OpenAI: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

# Nettoyage
if (Test-Path $tempAudioPath) {
    Remove-Item $tempAudioPath
    Write-Host "`nFichier temporaire supprime" -ForegroundColor Green
}

Write-Host "`nTest termine!" -ForegroundColor Green 