# 🔧 Correction Erreurs Log 55 - EC2

## ❌ Erreurs Identifiées

1. **`column e.status does not exist`** dans `global_promo_service`
2. **`column "last_error" does not exist`** dans `social_publication_jobs`

## 🔍 Analyse

### Problème 1 : `e.status` pour `global_promo_events`

L'erreur indique qu'une requête utilise `e.status` où `e` est probablement un alias pour `global_promo_events`. Mais dans le code Rust, on utilise `ev` pour `global_promo_events` et `e` pour `global_promo_entries`.

**Hypothèse** : Il y a peut-être une fonction SQL ou une vue qui utilise `e` comme alias pour `global_promo_events`.

### Problème 2 : `last_error` manquant

La colonne `last_error` existe dans la migration SQL mais n'est pas ajoutée automatiquement par `auto_migrate.rs`.

## ✅ Commande SQL de Correction

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Ajouter last_error à social_publication_jobs
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'last_error') THEN ALTER TABLE social_publication_jobs ADD COLUMN last_error TEXT; RAISE NOTICE 'last_error ajoute'; END IF; END $$;

-- 2. Rafraîchir la vue matérialisée global_promo_catalog_cache (au cas où elle utilise ev.status)
REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS global_promo_catalog_cache;

-- 3. Vérification
SELECT 'social_publication_jobs' as table_name, column_name FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'last_error';
EOFSQL
```

## ⚠️ Note sur `e.status`

Si l'erreur persiste après cette correction, il faudra chercher dans les fonctions SQL ou les vues qui utilisent `e` comme alias pour `global_promo_events`.

