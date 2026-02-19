# 🧪 Test d'Upload et Lecture de Médias via API

## 📋 Objectif

Tester l'upload et la lecture de médias via l'API backend pour vérifier que le système S3/CDN fonctionne correctement.

---

## 🔧 Prérequis

1. Backend ECS accessible
2. Utilisateur de test (ou super admin créé)
3. Token JWT valide

---

## 📝 Étapes de Test

### 1. Obtenir l'IP Publique du Backend

```powershell
# Récupérer l'IP publique d'une tâche ECS
$clusterName = "yukpo-cluster"
$serviceName = "yukpo-backend-service"
$region = "eu-west-1"

$taskArn = aws ecs list-tasks --cluster $clusterName --service-name $serviceName --region $region --query 'taskArns[0]' --output text
$taskDetails = aws ecs describe-tasks --cluster $clusterName --tasks $taskArn --region $region | ConvertFrom-Json
$eniId = ($taskDetails.tasks[0].attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" }).value
$eni = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $region | ConvertFrom-Json
$publicIp = $eni.NetworkInterfaces[0].Association.PublicIp

Write-Host "Backend URL: http://$publicIp`:8080"
```

### 2. Obtenir un Token JWT

```powershell
$backendUrl = "http://$publicIp`:8080"

# Login avec super admin
$loginBody = @{
    email = "admin@yukpo.dev"
    password = "Hernandez87"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

Write-Host "Token obtenu: $($token.Substring(0, 20))..."
```

### 3. Tester l'Upload d'un Média

```powershell
# Créer un fichier de test (image PNG 1x1)
$testImagePath = "test-media-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
$pngBytes = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82)
[System.IO.File]::WriteAllBytes($testImagePath, $pngBytes)

# Upload via API
$headers = @{
    "Authorization" = "Bearer $token"
}

$formData = @{
    file = Get-Item $testImagePath
} | ConvertTo-Json

# Note: Pour un vrai upload multipart/form-data, utilisez Invoke-WebRequest avec -Form
$uploadResponse = Invoke-RestMethod -Uri "$backendUrl/api/media/upload" -Method POST -Headers $headers -Body $formData -ContentType "multipart/form-data"

Write-Host "Upload réussi!"
Write-Host "URL retournée: $($uploadResponse.url)"
```

### 4. Tester l'Accès au Média

```powershell
# Tester l'accès à l'URL retournée
$mediaUrl = $uploadResponse.url

try {
    $response = Invoke-WebRequest -Uri $mediaUrl -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Accès au média réussi (HTTP 200)"
        Write-Host "   Taille: $($response.Content.Length) bytes"
    } else {
        Write-Host "⚠️ Accès retourne HTTP $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Erreur d'accès: $_"
}
```

---

## 🔍 Endpoints API Disponibles

### Upload Média

- `POST /api/media/upload` - Upload d'un média
- `POST /api/media/temp/upload` - Upload temporaire
- `POST /api/upload` - Upload générique

### Lecture Média

- `GET /api/media/{id}` - Récupérer un média par ID
- `GET /api/media/temp/{path}` - Récupérer un média temporaire

---

## ✅ Résultat Attendu

1. ✅ Upload réussi avec retour d'une URL S3/CDN
2. ✅ URL accessible publiquement (HTTP 200)
3. ✅ Fichier téléchargeable et lisible

---

## 🚨 Résolution de Problèmes

### Upload échoue avec 401

- Vérifier que le token JWT est valide
- Vérifier que l'utilisateur a les permissions nécessaires

### Upload échoue avec 500

- Vérifier les logs CloudWatch du backend
- Vérifier que les variables S3 sont correctement configurées
- Vérifier les permissions IAM du rôle ECS Task

### URL retournée non accessible

- Vérifier que le bucket S3 a les permissions publiques
- Vérifier que la politique du bucket autorise l'accès public
- Si CloudFront est utilisé, vérifier la distribution

---

## 📚 Références

- [Backend Media Storage Service](../backend/src/services/media_storage_service.rs)
- [Backend Media Controller](../backend/src/controllers/media_controller.rs)
- [Configuration S3](../backend/src/config/storage.rs)



