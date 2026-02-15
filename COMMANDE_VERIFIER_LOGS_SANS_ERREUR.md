# 🔍 Vérifier les Logs sans Erreur d'Encodage

## ✅ **Option 1 : Via AWS Console (Recommandé)**

1. Allez sur : https://console.aws.amazon.com/cloudwatch/
2. Logs → Log groups → `/ecs/yukpo-backend`
3. Cliquez sur le dernier log stream
4. Cherchez les erreurs récentes

---

## ✅ **Option 2 : Commande PowerShell avec Encodage UTF-8**

```powershell
# Sauvegarder dans un fichier avec UTF-8
aws logs tail /ecs/yukpo-backend --region eu-west-1 --since 10m --format short | Out-File -FilePath "$env:TEMP\logs.txt" -Encoding UTF8

# Lire le fichier
Get-Content "$env:TEMP\logs.txt" | Select-String -Pattern "ERROR|starts_at|ending_notification_sent_at|platform|Redis" | Select-Object -Last 20
```

---

## ✅ **Option 3 : Filtrer directement avec AWS CLI**

```powershell
# Filtrer les erreurs uniquement
aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $((Get-Date).AddMinutes(-10).ToUniversalTime() | Get-Date -UFormat %s)000 `
  --filter-pattern "ERROR" `
  --max-items 20 `
  --query 'events[*].message' `
  --output text
```

---

## ✅ **Option 4 : Vérifier les Erreurs Spécifiques**

```powershell
# Vérifier les erreurs de colonnes manquantes
aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $((Get-Date).AddMinutes(-10).ToUniversalTime() | Get-Date -UFormat %s)000 `
  --filter-pattern "does not exist" `
  --max-items 10 `
  --query 'events[*].message' `
  --output text | Out-File -FilePath "$env:TEMP\errors.txt" -Encoding UTF8

Get-Content "$env:TEMP\errors.txt"
```

---

## ✅ **Option 5 : Vérifier Redis**

```powershell
# Vérifier les erreurs Redis
aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $((Get-Date).AddMinutes(-10).ToUniversalTime() | Get-Date -UFormat %s)000 `
  --filter-pattern "Redis" `
  --max-items 10 `
  --query 'events[*].message' `
  --output text | Out-File -FilePath "$env:TEMP\redis.txt" -Encoding UTF8

Get-Content "$env:TEMP\redis.txt"
```

---

## ✅ **Option 6 : Vérification Simple (Pas d'Erreurs = Bon Signe)**

```powershell
# Compter les erreurs dans les 10 dernières minutes
$errorCount = aws logs filter-log-events `
  --log-group-name /ecs/yukpo-backend `
  --region eu-west-1 `
  --start-time $((Get-Date).AddMinutes(-10).ToUniversalTime() | Get-Date -UFormat %s)000 `
  --filter-pattern "ERROR" `
  --query 'events | length(@)' `
  --output text

if ($errorCount -eq "0") {
    Write-Host "✅ Aucune erreur dans les 10 dernières minutes!" -ForegroundColor Green
} else {
    Write-Host "⚠️  $errorCount erreur(s) trouvée(s)" -ForegroundColor Yellow
}
```


