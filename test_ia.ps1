# Test de l'endpoint IA
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxOTkxMiwiaWF0IjoxNzU2MzcxNDQ2LCJleHAiOjE3NTY0NTc4NDZ9.wr9OeNDKq4pQ45Ttzj6cUQF2AMF5ZDEezawiBZD_a0I"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    "message" = "je cherche un salon de coiffure"
} | ConvertTo-Json

Write-Host "Test de l'endpoint IA..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers $headers -Body $body
    Write-Host "Reponse: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Erreur: $($_.Exception.Message)"
} 