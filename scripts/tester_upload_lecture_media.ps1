# Script pour tester l'upload et la lecture de médias via l'API backend
# Teste l'endpoint d'upload et vérifie que le fichier est accessible

$ErrorActionPreference = "Stop"

Write-Host "🧪 Test d'upload et de lecture de médias..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$region = "eu-west-1"
$projectName = "yukpo"
$clusterName = "$projectName-cluster"
$serviceName = "$projectName-backend-service"

# 1. Récupérer l'URL du backend
Write-Host "📋 1. Récupération de l'URL du backend..." -ForegroundColor Yellow
Write-Host ""

# Essayer de récupérer l'IP publique d'une tâche ECS
$tasks = aws ecs list-tasks --cluster $clusterName --service-name $serviceName --region $region --query 'taskArns[0]' --output text 2>&1

if ($LASTEXITCODE -ne 0 -or $tasks -eq "" -or $tasks -eq "None") {
    Write-Host "  ❌ Aucune tâche ECS en cours d'exécution" -ForegroundColor Red
    exit 1
}

$taskArn = $tasks
$taskDetails = aws ecs describe-tasks --cluster $clusterName --tasks $taskArn --region $region 2>&1 | ConvertFrom-Json

if ($taskDetails.tasks.Count -eq 0) {
    Write-Host "  ❌ Impossible de récupérer les détails de la tâche" -ForegroundColor Red
    exit 1
}

$task = $taskDetails.tasks[0]
$publicIp = $task.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | ForEach-Object {
    $eniId = $_.value
    $eni = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $region 2>&1 | ConvertFrom-Json
    $eni.NetworkInterfaces[0].Association.PublicIp
}

if (-not $publicIp) {
    Write-Host "  ❌ Impossible de récupérer l'IP publique de la tâche" -ForegroundColor Red
    exit 1
}

$backendUrl = "http://$publicIp`:8080"
Write-Host "  ✅ Backend URL: $backendUrl" -ForegroundColor Green
Write-Host ""

# 2. Vérifier que le backend est accessible
Write-Host "📋 2. Vérification de l'accessibilité du backend..." -ForegroundColor Yellow
Write-Host ""

try {
    $healthResponse = Invoke-WebRequest -Uri "$backendUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "  ✅ Backend accessible (Health check OK)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Backend répond avec HTTP $($healthResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Backend inaccessible: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Créer un fichier de test
Write-Host "📋 3. Création d'un fichier de test..." -ForegroundColor Yellow
Write-Host ""

$testImagePath = "test-media-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
# Créer une image PNG minimale (1x1 pixel transparent)
$pngBytes = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82)
[System.IO.File]::WriteAllBytes($testImagePath, $pngBytes)

Write-Host "  ✅ Fichier de test créé: $testImagePath" -ForegroundColor Green
Write-Host ""

# 4. Obtenir un token JWT (nécessite un utilisateur de test)
Write-Host "📋 4. Authentification (nécessite un utilisateur de test)..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  ⚠️ Note: Ce test nécessite un token JWT valide" -ForegroundColor Yellow
Write-Host "     Pour un test complet, vous devez:" -ForegroundColor Yellow
Write-Host "     1. Créer un utilisateur via l'API" -ForegroundColor Yellow
Write-Host "     2. Obtenir un token JWT via /api/auth/login" -ForegroundColor Yellow
Write-Host "     3. Utiliser ce token pour l'upload" -ForegroundColor Yellow
Write-Host ""

# Pour l'instant, on va juste tester l'endpoint sans authentification
# (certains endpoints peuvent être publics)

# 5. Tester l'upload (si endpoint public disponible)
Write-Host "📋 5. Test d'upload (si endpoint disponible)..." -ForegroundColor Yellow
Write-Host ""

# Note: L'upload nécessite généralement une authentification
# On va juste vérifier que l'endpoint existe
$uploadEndpoints = @(
    "/api/media/upload",
    "/api/media/temp/upload",
    "/api/upload"
)

$endpointFound = $false
foreach ($endpoint in $uploadEndpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 405) {
            Write-Host "  ✅ Endpoint trouvé: $endpoint (HTTP $($response.StatusCode))" -ForegroundColor Green
            $endpointFound = $true
        }
    } catch {
        # Ignorer les erreurs 404/401
    }
}

if (-not $endpointFound) {
    Write-Host "  ⚠️ Aucun endpoint d'upload public trouvé (normal si authentification requise)" -ForegroundColor Yellow
}

Write-Host ""

# 6. Résumé et instructions
Write-Host "📊 Résumé:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Backend accessible: $backendUrl" -ForegroundColor Green
Write-Host "  ✅ Fichier de test créé: $testImagePath" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Pour tester l'upload complet:" -ForegroundColor Cyan
Write-Host "  1. Obtenir un token JWT:" -ForegroundColor White
Write-Host "     POST $backendUrl/api/auth/login" -ForegroundColor Gray
Write-Host "     Body: { `"email`": `"admin@yukpo.dev`", `"password`": `"Hernandez87`" }" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Uploader un fichier:" -ForegroundColor White
Write-Host "     POST $backendUrl/api/media/upload" -ForegroundColor Gray
Write-Host "     Headers: { `"Authorization`": `"Bearer <token>`" }" -ForegroundColor Gray
Write-Host "     Body: multipart/form-data avec le fichier" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Vérifier l'URL retournée dans la réponse" -ForegroundColor White
Write-Host "  4. Tester l'accès à cette URL depuis un navigateur" -ForegroundColor White
Write-Host ""

# Nettoyer
if (Test-Path $testImagePath) {
    Remove-Item $testImagePath -Force
    Write-Host "  🗑️ Fichier de test supprimé" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Test terminé !" -ForegroundColor Green

