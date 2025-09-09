# Test des endpoints disponibles
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxOTkxMiwiaWF0IjoxNzU2MzcxNDQ2LCJleHAiOjE3NTY0NTc4NDZ9.wr9OeNDKq4pQ45Ttzj6cUQF2AMF5ZDEezawiBZD_a0I"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Test des endpoints..."

# Test 1: Endpoint racine
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/" -Method GET
    Write-Host "GET /: OK"
} catch {
    Write-Host "GET /: Erreur $($_.Exception.Response.StatusCode)"
}

# Test 2: Endpoint health
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
    Write-Host "GET /health: OK"
} catch {
    Write-Host "GET /health: Erreur $($_.Exception.Response.StatusCode)"
}

# Test 3: Endpoint yukpo
try {
    $body = @{"message" = "test"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $body
    Write-Host "POST /api/yukpo: OK"
} catch {
    Write-Host "POST /api/yukpo: Erreur $($_.Exception.Response.StatusCode)"
}

# Test 4: Endpoint ia
try {
    $body = @{"message" = "test"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/analyze" -Method POST -Headers $headers -Body $body
    Write-Host "POST /api/ia/analyze: OK"
} catch {
    Write-Host "POST /api/ia/analyze: Erreur $($_.Exception.Response.StatusCode)"
} 