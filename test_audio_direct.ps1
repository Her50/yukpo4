# Test direct de transcription audio avec le microservice
Write-Host "Test direct de transcription audio avec microservice" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Verifier que le microservice fonctionne
Write-Host "`nVerification du microservice..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
    Write-Host "Microservice accessible" -ForegroundColor Green
} catch {
    Write-Host "Microservice non accessible" -ForegroundColor Red
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

# Encoder en base64
$base64Audio = [System.Convert]::ToBase64String($wavBytes)
Write-Host "Audio encode en base64: ${base64Audio.Length} caracteres" -ForegroundColor Green

# Test direct avec le microservice
Write-Host "`nTest direct avec le microservice..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "Test de transcription audio"
    type_donnee = "text"
} | ConvertTo-Json -Depth 10

Write-Host "Envoi de la requete au microservice..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "Reponse du microservice recue" -ForegroundColor Green
    Write-Host "Contenu: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan
} catch {
    Write-Host "Erreur lors de l'appel au microservice: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 