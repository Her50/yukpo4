# Test de transcription audio en production
Write-Host "🎤 Test de transcription audio en production" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Vérifier les variables d'environnement
$openai_key = $env:OPENAI_API_KEY
$huggingface_key = $env:HUGGINGFACE_API_KEY

if (-not $openai_key) {
    Write-Host "⚠️  OPENAI_API_KEY non configurée" -ForegroundColor Yellow
} else {
    Write-Host "✅ OPENAI_API_KEY configurée" -ForegroundColor Green
}

if (-not $huggingface_key) {
    Write-Host "⚠️  HUGGINGFACE_API_KEY non configurée (utilisera la clé publique)" -ForegroundColor Yellow
} else {
    Write-Host "✅ HUGGINGFACE_API_KEY configurée" -ForegroundColor Green
}

# Créer un fichier audio de test simple (1 seconde de silence)
Write-Host "`n🎵 Création d'un fichier audio de test..." -ForegroundColor Cyan

# Utiliser PowerShell pour créer un fichier WAV simple
$sampleRate = 16000
$duration = 1  # 1 seconde
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

# Données audio (silence)
$audioData = @()
for ($i = 0; $i -lt $samples; $i++) {
    $audioData += 0x00, 0x00  # 16-bit silence
}

# Combiner en-tête et données
$wavBytes = $wavHeader + $audioData

# Écrire le fichier
$testAudioPath = "test_audio.wav"
[System.IO.File]::WriteAllBytes($testAudioPath, $wavBytes)

Write-Host "✅ Fichier audio de test créé: $testAudioPath" -ForegroundColor Green

# Encoder en base64
$base64Audio = [System.Convert]::ToBase64String($wavBytes)
Write-Host "✅ Audio encodé en base64 (${base64Audio.Length} caractères)" -ForegroundColor Green

# Tester la transcription avec le backend
Write-Host "`n🔍 Test de transcription avec le backend..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
}

$payload = @{
    texte = "Test de transcription audio"
    audio_base64 = @($base64Audio)
} | ConvertTo-Json -Depth 10

Write-Host "📤 Envoi de la requête au backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $payload
    Write-Host "✅ Réponse du backend reçue" -ForegroundColor Green
    Write-Host "📝 Contenu: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur lors de l'appel au backend: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Assurez-vous que le backend est démarré sur le port 3001" -ForegroundColor Yellow
}

# Nettoyage
if (Test-Path $testAudioPath) {
    Remove-Item $testAudioPath
    Write-Host "`n🧹 Fichier de test supprimé" -ForegroundColor Green
}

Write-Host "`n✅ Test terminé !" -ForegroundColor Green 