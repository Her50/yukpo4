# Test avec curl
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxOTkxMiwiaWF0IjoxNzU2MzcxNDQ2LCJleHAiOjE3NTY0NTc4NDZ9.wr9OeNDKq4pQ45Ttzj6cUQF2AMF5ZDEezawiBZD_a0I"

$body = '{"message": "Je cherche un salon de coiffure"}'

Write-Host "Test avec curl..."

try {
    $response = curl -X POST "http://localhost:3001/api/yukpo" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $body
    Write-Host "Reponse: $response"
} catch {
    Write-Host "Erreur: $($_.Exception.Message)"
} 