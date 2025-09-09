# Test de la base de données - Vérification du service 280093
Write-Host "Test de la base de donnees" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

# Test direct de la base de données
Write-Host "`nVerification du service 280093 dans PostgreSQL..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"
}

# Test 1: Vérifier si le service 280093 existe
Write-Host "`nTest 1: Vérification du service 280093..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services/280093" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "Service 280093 trouvé!" -ForegroundColor Green
    Write-Host "Titre: $($response.titre)" -ForegroundColor Cyan
    Write-Host "Description: $($response.description)" -ForegroundColor Cyan
    Write-Host "Category: $($response.category)" -ForegroundColor Cyan
    Write-Host "Active: $($response.is_active)" -ForegroundColor Cyan
} catch {
    Write-Host "Service 280093 non trouvé ou erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Lister tous les services actifs
Write-Host "`nTest 2: Liste des services actifs..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services?is_active=true&limit=10" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "Nombre de services actifs: $($response.services.Count)" -ForegroundColor Green
    
    if ($response.services -and $response.services.Count -gt 0) {
        Write-Host "Premiers services:" -ForegroundColor Cyan
        $response.services | Select-Object -First 5 | ForEach-Object {
            Write-Host "- ID: $($_.id), Titre: $($_.titre), Category: $($_.category)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Erreur lors de la récupération des services: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Recherche de services avec "pressing" dans le titre
Write-Host "`nTest 3: Recherche de services avec 'pressing'..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services?search=pressing&limit=10" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "Nombre de services trouvés avec 'pressing': $($response.services.Count)" -ForegroundColor Green
    
    if ($response.services -and $response.services.Count -gt 0) {
        Write-Host "Services avec 'pressing':" -ForegroundColor Cyan
        $response.services | ForEach-Object {
            Write-Host "- ID: $($_.id), Titre: $($_.titre), Category: $($_.category)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest termine!" -ForegroundColor Green 