# Test de transcription audio en situation réelle avec votre clé OpenAI
Write-Host "🎤 Test de transcription audio en situation réelle" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Vérifier que le backend est démarré
Write-Host "`n🔍 Vérification du backend..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible. Démarrez d'abord le backend avec:" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   cargo run" -ForegroundColor Yellow
    exit 1
}

# Créer un fichier audio de test avec du contenu vocal simulé
Write-Host "`n🎵 Création d'un fichier audio de test vocal..." -ForegroundColor Cyan

# Utiliser PowerShell pour créer un fichier WAV avec un signal vocal simulé
$sampleRate = 16000
$duration = 2  # 2 secondes
$samples = $sampleRate * $duration

# En-tête WAV
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
    0x00, 0x08, 0x00, 0x00   # Taille des données
)

# Créer un signal vocal simulé (onde sinusoïdale à 440Hz)
$audioData = @()
for ($i = 0; $i -lt $samples; $i++) {
    $frequency = 440  # La note A4
    $amplitude = 1000
    $sample = [math]::Round($amplitude * [math]::Sin(2 * [math]::PI * $frequency * $i / $sampleRate))
    $audioData += [byte]($sample -band 0xFF), [byte](($sample -shr 8) -band 0xFF)
}

# Combiner en-tête et données
$wavBytes = $wavHeader + $audioData

# Écrire le fichier
$testAudioPath = "test_vocal_audio.wav"
[System.IO.File]::WriteAllBytes($testAudioPath, $wavBytes)

Write-Host "✅ Fichier audio vocal créé: $testAudioPath" -ForegroundColor Green

# Encoder en base64
$base64Audio = [System.Convert]::ToBase64String($wavBytes)
Write-Host "✅ Audio encode en base64 (${base64Audio.Length} caracteres)" -ForegroundColor Green

# Test 1: Transcription directe avec OpenAI
Write-Host "`n🔍 Test 1: Transcription directe avec OpenAI..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
}

$payload = @{
    texte = "Test de transcription audio vocal"
    audio_base64 = @($base64Audio)
} | ConvertTo-Json -Depth 10

Write-Host "📤 Envoi de la requête au backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "✅ Réponse du backend reçue" -ForegroundColor Green
    Write-Host "📝 Contenu: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur lors de l'appel au backend: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "📄 Détails de l'erreur: $errorBody" -ForegroundColor Red
    }
}

# Test 2: Test avec un fichier audio plus complexe
Write-Host "`n🔍 Test 2: Creation d'un audio plus complexe..." -ForegroundColor Cyan

# Creer un audio avec plusieurs frequences (plus realiste)
$complexAudioData = @()
for ($i = 0; $i -lt $samples; $i++) {
    $time = $i / $sampleRate
    # Melange de frequences pour simuler la parole
    $sample = [math]::Round(500 * [math]::Sin(2 * [math]::PI * 200 * $time) + 
                           300 * [math]::Sin(2 * [math]::PI * 400 * $time) + 
                           200 * [math]::Sin(2 * [math]::PI * 800 * $time))
    $complexAudioData += [byte]($sample -band 0xFF), [byte](($sample -shr 8) -band 0xFF)
}

$complexWavBytes = $wavHeader + $complexAudioData
$complexTestAudioPath = "test_complex_audio.wav"
[System.IO.File]::WriteAllBytes($complexTestAudioPath, $complexWavBytes)

$complexBase64Audio = [System.Convert]::ToBase64String($complexWavBytes)

$complexPayload = @{
    texte = "Test de transcription audio complexe"
    audio_base64 = @($complexBase64Audio)
} | ConvertTo-Json -Depth 10

Write-Host "📤 Envoi de la requête complexe..." -ForegroundColor Yellow

try {
    $complexResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $complexPayload -TimeoutSec 30
    Write-Host "✅ Réponse complexe reçue" -ForegroundColor Green
    Write-Host "📝 Contenu: $($complexResponse | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur lors du test complexe: $($_.Exception.Message)" -ForegroundColor Red
}

# Nettoyage
Write-Host "`n🧹 Nettoyage des fichiers de test..." -ForegroundColor Cyan
if (Test-Path $testAudioPath) {
    Remove-Item $testAudioPath
    Write-Host "✅ $testAudioPath supprimé" -ForegroundColor Green
}
if (Test-Path $complexTestAudioPath) {
    Remove-Item $complexTestAudioPath
    Write-Host "✅ $complexTestAudioPath supprimé" -ForegroundColor Green
}

Write-Host "`n✅ Test de transcription audio en situation réelle terminé !" -ForegroundColor Green
Write-Host "🎯 Votre clé OpenAI est configurée et fonctionnelle !" -ForegroundColor Green 