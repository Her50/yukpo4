# Test PowerShell pour la création d'un échange (mode "echange" et "don")
# Vérifie la validation stricte, l'injection du mode, et la logique métier

$api = "http://127.0.0.1:3001/echanges"

Write-Host "Test 1: Création échange valide (mode echange)"
$body = @{
    user_id = 123
    offre = @{ listeproduit = @("stylo") }
    besoin = @{ listeproduit = @("cahier") }
    mode = "echange"
    mode_troc = "direct"
    gps = @{ lat = 1.23; lon = 4.56 }
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 5

Write-Host "Test 2: Création don valide (offre seule)"
$body = @{
    user_id = 124
    offre = @{ listeproduit = @("livre") }
    besoin = @{}
    mode = "don"
    mode_troc = "direct"
    gps = @{ lat = 2.34; lon = 5.67 }
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 5

Write-Host "Test 3: Création don invalide (offre et besoin présents)"
$body = @{
    user_id = 125
    offre = @{ listeproduit = @("livre") }
    besoin = @{ listeproduit = @("stylo") }
    mode = "don"
    mode_troc = "direct"
    gps = @{ lat = 2.34; lon = 5.67 }
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 5

Write-Host "Test 4: Création échange invalide (besoin vide)"
$body = @{
    user_id = 126
    offre = @{ listeproduit = @("stylo") }
    besoin = @{}
    mode = "echange"
    mode_troc = "direct"
    gps = @{ lat = 2.34; lon = 5.67 }
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 5

Write-Host "Test 5: Création échange invalide (mode non autorisé)"
$body = @{
    user_id = 127
    offre = @{ listeproduit = @("stylo") }
    besoin = @{ listeproduit = @("cahier") }
    mode = "troc"
    mode_troc = "direct"
    gps = @{ lat = 2.34; lon = 5.67 }
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri $api -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 5
