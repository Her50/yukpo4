# Script de test pour le système de notifications
$baseUrl = "https://yukpomnang.onrender.com"

Write-Host "🔔 TEST SYSTÈME DE NOTIFICATIONS" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Login pour obtenir un token
Write-Host "`n1. Connexion utilisateur..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@yukpo.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    $userId = $loginResponse.user.id
    Write-Host "✅ Connecté - User ID: $userId" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# 2. Récupérer les notifications
Write-Host "`n2. Récupération des notifications..." -ForegroundColor Yellow
try {
    $notifications = Invoke-RestMethod -Uri "$baseUrl/api/notifications/user/$userId" -Method GET -Headers $headers
    Write-Host "✅ Notifications récupérées: $($notifications.data.Count)" -ForegroundColor Green
    $notifications.data | ForEach-Object {
        Write-Host "  - $($_.title): $($_.message)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erreur récupération: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Compter les non lues
Write-Host "`n3. Comptage des notifications non lues..." -ForegroundColor Yellow
try {
    $unreadCount = Invoke-RestMethod -Uri "$baseUrl/api/notifications/user/$userId/unread-count" -Method GET -Headers $headers
    Write-Host "✅ Notifications non lues: $($unreadCount.count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur comptage: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Marquer tout comme lu
Write-Host "`n4. Marquage de toutes les notifications comme lues..." -ForegroundColor Yellow
try {
    $markAllRead = Invoke-RestMethod -Uri "$baseUrl/api/notifications/user/$userId/mark-all-read" -Method PATCH -Headers $headers
    Write-Host "✅ $($markAllRead.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur marquage: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ TESTS TERMINÉS" -ForegroundColor Cyan

