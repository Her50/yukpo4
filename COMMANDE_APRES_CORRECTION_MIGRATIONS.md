# 🚀 Commandes Après Correction des Migrations

## ✅ 1. Commit et Push les Corrections

```bash
git add backend/migrations/00000015_create_flash_sales_tables.sql
git add backend/migrations/00000016_create_promotion_tables.sql
git add backend/migrations/00000017_create_social_media_tables.sql
git commit -m "fix: Aligner migrations SQL avec auto_migrate.rs - corriger colonnes manquantes"
git push
```

## ✅ 2. Redémarrer ECS

```powershell
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
```

## ✅ 3. Attendre 2-3 Minutes

Le service ECS va :
1. Télécharger la nouvelle image Docker
2. Redémarrer le backend
3. Exécuter `auto_migrate.rs` avec les migrations corrigées

## ✅ 4. Vérifier les Logs

```powershell
# Attendre 3 minutes puis vérifier
Start-Sleep -Seconds 180

# Compter les erreurs
$startTime = [int64]((Get-Date).AddMinutes(-5).ToUniversalTime() - (Get-Date "1970-01-01").ToUniversalTime()).TotalSeconds * 1000

$columnErrors = aws logs filter-log-events --log-group-name /ecs/yukpo-backend --region eu-west-1 --start-time $startTime --filter-pattern "does not exist" --query 'events | length(@)' --output text
$redisErrors = aws logs filter-log-events --log-group-name /ecs/yukpo-backend --region eu-west-1 --start-time $startTime --filter-pattern "Redis" --query 'events | length(@)' --output text

Write-Host "Erreurs de colonnes: $columnErrors" -ForegroundColor $(if ($columnErrors -eq "0") { "Green" } else { "Red" })
Write-Host "Erreurs Redis: $redisErrors" -ForegroundColor $(if ($redisErrors -eq "0") { "Green" } else { "Yellow" })
```

## ✅ 5. Si Tout Est OK

Les erreurs de colonnes devraient **disparaître définitivement** car :
- Les migrations SQL sont maintenant cohérentes
- `auto_migrate.rs` créera les bonnes structures
- Plus de conflits entre les deux

---

## ⚠️ Note sur Redis

Les erreurs Redis persistent probablement à cause de :
1. Configuration réseau (Security Groups)
2. Endpoint incorrect
3. TLS non configuré correctement

À traiter séparément si les erreurs de colonnes sont résolues.


