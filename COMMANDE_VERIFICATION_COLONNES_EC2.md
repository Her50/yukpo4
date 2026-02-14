# ✅ Vérification des Colonnes - EC2

## Commande de Vérification

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT
    'global_promo_entries.event_id' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'event_id') as existe
UNION ALL
SELECT 'global_promo_entries.submitted_by_user_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id')
UNION ALL
SELECT 'live_flash_sales.stock_target', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target')
UNION ALL
SELECT 'live_flash_sales.metadata', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'metadata')
UNION ALL
SELECT 'social_publication_jobs.payload', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'payload')
UNION ALL
SELECT 'social_publication_jobs.status', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'status')
UNION ALL
SELECT 'social_publication_jobs.media_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform')
ORDER BY colonne;
"
```
