# 🚀 Commande Simple - Copier-Coller Direct

## ✅ **Version PowerShell (Recommandée)**

Copiez-collez cette commande complète dans PowerShell :

```powershell
# Correction complète en une commande
$env:PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"; @"
DO `$$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'start_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE '✅ start_date renommé en starts_at';
    END IF;
END `$$;
DO `$$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'end_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE '✅ end_date renommé en ends_at';
    END IF;
END `$$;
DO `$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at') THEN
        ALTER TABLE live_flash_sales ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ ending_notification_sent_at ajouté';
    END IF;
END `$$;
DO `$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform') THEN
        ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ platform ajouté';
    END IF;
END `$$;
SELECT 'global_promo_events.starts_at' as colonne, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
"@ | psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo; $redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text 2>$null; if ($redisEndpoint) { $secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json; $secret.REDIS_URL = "redis://$redisEndpoint:6379/0"; $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret.json" -Encoding UTF8; aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret.json" -Raw); aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment; Write-Host "✅ Redis configuré" -ForegroundColor Green } else { Write-Host "⚠️ Redis n'existe pas - créez-le via Terraform" -ForegroundColor Yellow }
```

---

## ✅ **OU Utilisez le Script Complet**

Exécutez le script PowerShell complet :

```powershell
.\SCRIPT_CORRECTION_TOTALE.ps1
```

---

## ✅ **Si ElastiCache n'existe pas**

Créez-le via Terraform (recommandé) :

```powershell
cd infra/aws
terraform plan
terraform apply
```

Puis réexécutez le script de correction.

---

## 📝 **Résumé**

Le script fait automatiquement :
1. ✅ Corrige les colonnes PostgreSQL (start_date → starts_at, etc.)
2. ✅ Vérifie si ElastiCache existe
3. ✅ Configure les Security Groups si nécessaire
4. ✅ Met à jour REDIS_URL dans Secrets Manager
5. ✅ Redémarre le service ECS

**Temps d'exécution** : ~30 secondes + 2-3 minutes pour le redémarrage ECS

