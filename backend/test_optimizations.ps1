# Test des optimisations de performance
Write-Host "🚀 Test des optimisations de performance" -ForegroundColor Green

# Test 1: Cache sémantique optimisé
Write-Host "`n📊 Test 1: Cache sémantique optimisé" -ForegroundColor Yellow
$start = Get-Date
curl -X POST "http://localhost:3001/api/ia/auto" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTYzNDYxNiwiaWF0IjoxNzUyMzM0MDE0LCJleHAiOjE3NTI0MjA0MTR9.vYs9v0OTScJHMZnnM_OavKCBtxoMTUmRGfB0qkjF_6A" `
  -d '{"texte":"j''ai un magasin de vente des jouets pour enfants","base64_image":[],"doc_base64":[],"excel_base64":[]}' `
  -w "`nTemps total: %{time_total}s`n"
$end = Get-Date
$duration = ($end - $start).TotalSeconds
Write-Host "⏱️ Temps d'exécution: $duration secondes" -ForegroundColor Cyan

# Test 2: Cache sémantique avec requête similaire (devrait être plus rapide)
Write-Host "`n📊 Test 2: Cache sémantique - requête similaire" -ForegroundColor Yellow
$start = Get-Date
curl -X POST "http://localhost:3001/api/ia/auto" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTYzNDYxNiwiaWF0IjoxNzUyMzM0MDE0LCJleHAiOjE3NTI0MjA0MTR9.vYs9v0OTScJHMZnnM_OavKCBtxoMTUmRGfB0qkjF_6A" `
  -d '{"texte":"je vends des jouets pour enfants dans mon magasin","base64_image":[],"doc_base64":[],"excel_base64":[]}' `
  -w "`nTemps total: %{time_total}s`n"
$end = Get-Date
$duration = ($end - $start).TotalSeconds
Write-Host "⏱️ Temps d'exécution: $duration secondes" -ForegroundColor Cyan

# Test 3: IA externe optimisée
Write-Host "`n📊 Test 3: IA externe optimisée" -ForegroundColor Yellow
$start = Get-Date
curl -X POST "http://localhost:3001/api/ia/auto" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTYzNDYxNiwiaWF0IjoxNzUyMzM0MDE0LCJleHAiOjE3NTI0MjA0MTR9.vYs9v0OTScJHMZnnM_OavKCBtxoMTUmRGfB0qkjF_6A" `
  -d '{"texte":"service de réparation d''ordinateurs portables","base64_image":[],"doc_base64":[],"excel_base64":[]}' `
  -w "`nTemps total: %{time_total}s`n"
$end = Get-Date
$duration = ($end - $start).TotalSeconds
Write-Host "⏱️ Temps d'exécution: $duration secondes" -ForegroundColor Cyan

Write-Host "`n✅ Tests terminés" -ForegroundColor Green
Write-Host "📈 Les optimisations devraient réduire les temps d'exécution de 30-50%" -ForegroundColor Magenta 