# Test PowerShell pour l'intention "assistance_generale" (contrôleur assistance)
# Vérifie que la réponse IA brute est relayée sans validation métier

# Vérifie si le token existe, sinon effectue un login
if (!(Test-Path "token_test.txt") -or [string]::IsNullOrWhiteSpace((Get-Content "token_test.txt"))) {
    $loginBody = @{ email = "test@yukpo.com"; password = "motdepasse" } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "http://127.0.0.1:3001/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $jwt = $loginResp.token
    Set-Content -Path "token_test.txt" -Value $jwt
} else {
    $jwt = Get-Content -Path "token_test.txt" | Select-Object -First 1
}
$headers = @{ Authorization = "Bearer $jwt" }

$api = "http://127.0.0.1:3001/api/ia/auto"

Write-Host "Test 1: Assistance générale - question simple"
$body = @{
    texte = "Comment fonctionne Yukpo ?"
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json' -Headers $headers
$response | ConvertTo-Json -Depth 5

Write-Host "Test 2: Assistance générale - question avec contexte"
$body = @{}
$body.texte = "Quels sont les modes d'échange disponibles ?"
$body.contexte = @{}
$body.contexte.utilisateur = "test"
$body = $body | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json' -Headers $headers
$response | ConvertTo-Json -Depth 5

Write-Host "Test 3: Assistance générale - payload complexe"
$body = @{}
$body.texte = "Explique le matching automatique."
$body.extra = @{ foo = "bar" }
$body = $body | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json' -Headers $headers
$response | ConvertTo-Json -Depth 5
