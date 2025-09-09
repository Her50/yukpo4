# Test final de transcription audio avec backend fonctionnel
Write-Host "Test final de transcription audio avec backend" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Verifier que le backend fonctionne
Write-Host "`nVerification du backend..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5
    Write-Host "Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "Backend non accessible. Demarrez d'abord le backend." -ForegroundColor Red
    exit 1
}

# Creer un input audio simule (base64)
Write-Host "`nCreation d'un input audio simule..." -ForegroundColor Cyan

# Simuler un fichier audio base64 (juste pour le test)
$fakeAudioBase64 = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
Write-Host "Audio base64 simule cree: ${fakeAudioBase64.Length} caracteres" -ForegroundColor Green

# Test avec l'API du backend
Write-Host "`nTest avec l'API du backend..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"
}

$payload = @{
    input = @{
        type_donnee = "audio_base64"
        valeur = $fakeAudioBase64
        origine_champs = "test"
    }
    user_id = 1
    session_id = "test_session_audio_final"
} | ConvertTo-Json -Depth 10

Write-Host "Envoi de la requete au backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $payload -TimeoutSec 60
    Write-Host "Reponse du backend recue" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor Cyan
    Write-Host "Intention: $($response.intention)" -ForegroundColor Cyan
    Write-Host "Nombre de resultats: $($response.nombre_matchings)" -ForegroundColor Cyan
    
    if ($response.resultats -and $response.resultats.Count -gt 0) {
        Write-Host "Resultats trouves!" -ForegroundColor Green
        $response.resultats | ForEach-Object { Write-Host "- $($_.titre)" -ForegroundColor Yellow }
    } else {
        Write-Host "Aucun resultat trouve" -ForegroundColor Yellow
    }
    
    # Afficher les details de la transcription si disponible
    if ($response.donnees_validees -and $response.donnees_validees.description) {
        Write-Host "`nDescription (transcription): $($response.donnees_validees.description.valeur)" -ForegroundColor Magenta
    }
    
} catch {
    Write-Host "Erreur lors de l'appel au backend: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 