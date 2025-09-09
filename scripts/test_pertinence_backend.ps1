Write-Host "TEST DE PERTINENCE VIA BACKEND" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"

# Test 1: Restaurant
Write-Host "`n1. TEST RESTAURANT" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un restaurant"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Green
    if ($response.filtering_stats) {
        Write-Host "Statistiques filtrage:" -ForegroundColor White
        Write-Host "  Total: $($response.filtering_stats.total_results)" -ForegroundColor White
        Write-Host "  Filtres: $($response.filtering_stats.filtered_count)" -ForegroundColor White
        Write-Host "  Gardes: $($response.filtering_stats.kept_count)" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Plombier
Write-Host "`n2. TEST PLOMBIER" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un plombier"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Green
    if ($response.filtering_stats) {
        Write-Host "Statistiques filtrage:" -ForegroundColor White
        Write-Host "  Total: $($response.filtering_stats.total_results)" -ForegroundColor White
        Write-Host "  Filtres: $($response.filtering_stats.filtered_count)" -ForegroundColor White
        Write-Host "  Gardes: $($response.filtering_stats.kept_count)" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Electricien
Write-Host "`n3. TEST ELECTRICIEN" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un electricien"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Green
    if ($response.filtering_stats) {
        Write-Host "Statistiques filtrage:" -ForegroundColor White
        Write-Host "  Total: $($response.filtering_stats.total_results)" -ForegroundColor White
        Write-Host "  Filtres: $($response.filtering_stats.filtered_count)" -ForegroundColor White
        Write-Host "  Gardes: $($response.filtering_stats.kept_count)" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTEST TERMINE" -ForegroundColor Cyan 