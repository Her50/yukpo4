# 🔄 Redémarrer ECS et Vérifier les Erreurs

## ✅ **1. Redémarrer ECS**

```powershell
# Forcer un nouveau redéploiement
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment

Write-Host "✅ Service ECS redémarré" -ForegroundColor Green
Write-Host "⏱️  Attendez 2-3 minutes pour que le service redémarre complètement" -ForegroundColor Yellow
```

---

## ✅ **2. Vérifier le Statut du Service**

```powershell
# Attendre que le service soit stable
Start-Sleep -Seconds 180  # Attendre 3 minutes

# Vérifier le statut
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].[status,runningCount,desiredCount]' --output table
```

---

## ✅ **3. Vérifier les Logs (Option 1 : Compter les Erreurs)**

```powershell
# Compter les erreurs dans les 5 dernières minutes
$startTime = [int64]((Get-Date).AddMinutes(-5).ToUniversalTime() - (Get-Date "1970-01-01").ToUniversalTime()).TotalSeconds * 1000

$errorCount = aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $startTime `
  --filter-pattern "ERROR" `
  --query 'events | length(@)' `
  --output text

Write-Host "Nombre d'erreurs dans les 5 dernières minutes: $errorCount" -ForegroundColor $(if ($errorCount -eq "0") { "Green" } else { "Yellow" })
```

---

## ✅ **4. Vérifier les Logs (Option 2 : Erreurs Spécifiques)**

```powershell
# Filtrer les erreurs spécifiques
$startTime = [int64]((Get-Date).AddMinutes(-5).ToUniversalTime() - (Get-Date "1970-01-01").ToUniversalTime()).TotalSeconds * 1000

# Erreurs de colonnes manquantes
$columnErrors = aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $startTime `
  --filter-pattern "does not exist" `
  --query 'events | length(@)' `
  --output text

# Erreurs Redis
$redisErrors = aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $startTime `
  --filter-pattern "Redis" `
  --query 'events | length(@)' `
  --output text

Write-Host "Erreurs de colonnes: $columnErrors" -ForegroundColor $(if ($columnErrors -eq "0") { "Green" } else { "Red" })
Write-Host "Erreurs Redis: $redisErrors" -ForegroundColor $(if ($redisErrors -eq "0") { "Green" } else { "Yellow" })
```

---

## ✅ **5. Commande Complète (Tout en Un)**

```powershell
# Redémarrer ECS
Write-Host "Redémarrage du service ECS..." -ForegroundColor Yellow
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment | Out-Null
Write-Host "✅ Service redémarré" -ForegroundColor Green

# Attendre 3 minutes
Write-Host "`n⏱️  Attente de 3 minutes pour que le service redémarre..." -ForegroundColor Cyan
Start-Sleep -Seconds 180

# Vérifier le statut
Write-Host "`nVérification du statut..." -ForegroundColor Yellow
$status = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].[status,runningCount,desiredCount]' --output table
Write-Host $status

# Compter les erreurs
Write-Host "`nAnalyse des erreurs (5 dernières minutes)..." -ForegroundColor Yellow
$startTime = [int64]((Get-Date).AddMinutes(-5).ToUniversalTime() - (Get-Date "1970-01-01").ToUniversalTime()).TotalSeconds * 1000

$totalErrors = aws logs filter-log-events --log-group-name /ecs/yukpo-backend --region eu-west-1 --start-time $startTime --filter-pattern "ERROR" --query 'events | length(@)' --output text
$columnErrors = aws logs filter-log-events --log-group-name /ecs/yukpo-backend --region eu-west-1 --start-time $startTime --filter-pattern "does not exist" --query 'events | length(@)' --output text
$redisErrors = aws logs filter-log-events --log-group-name /ecs/yukpo-backend --region eu-west-1 --start-time $startTime --filter-pattern "Redis" --query 'events | length(@)' --output text

Write-Host "`n📊 Résumé des erreurs:" -ForegroundColor Cyan
Write-Host "  Total d'erreurs: $totalErrors" -ForegroundColor $(if ($totalErrors -eq "0") { "Green" } else { "Yellow" })
Write-Host "  Erreurs de colonnes: $columnErrors" -ForegroundColor $(if ($columnErrors -eq "0") { "Green" } else { "Red" })
Write-Host "  Erreurs Redis: $redisErrors" -ForegroundColor $(if ($redisErrors -eq "0") { "Green" } else { "Yellow" })

if ($totalErrors -eq "0") {
    Write-Host "`n✅ Aucune erreur détectée!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Des erreurs persistent. Vérifiez les logs dans CloudWatch." -ForegroundColor Yellow
    Write-Host "  https://console.aws.amazon.com/cloudwatch/" -ForegroundColor Cyan
}
```



