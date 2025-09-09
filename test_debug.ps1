# Test de debug pour la recherche
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxOTkxMiwiaWF0IjoxNzU2MzcxNDQ2LCJleHAiOjE3NTY0NTc4NDZ9.wr9OeNDKq4pQ45Ttzj6cUQF2AMF5ZDEezawiBZD_a0I"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test avec un message qui contient explicitement "recherche"
$body = @{
    "message" = "recherche salon de coiffure"
} | ConvertTo-Json

Write-Host "Test de debug avec message contenant 'recherche'..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $body
    Write-Host "Reponse: $($response | ConvertTo-Json -Depth 3)"
    
    if ($response.intention -eq "recherche_besoin") {
        Write-Host "✅ SUCCES: Intention détectée comme 'recherche_besoin'"
    } else {
        Write-Host "❌ ECHEC: Intention détectée comme '$($response.intention)' au lieu de 'recherche_besoin'"
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)"
} 