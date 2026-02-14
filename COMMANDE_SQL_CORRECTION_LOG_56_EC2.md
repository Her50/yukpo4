# 🔧 Commande SQL de Correction - Log 56

## 📊 Analyse des Erreurs PostgreSQL

### Erreur 1 : `column e.status does not exist`
**Requête problématique** :
```sql
SELECT
    e.id AS entry_id,
    e.service_id,
    e.submitted_by_user_id,
    ev.display_name AS event_display_name
FROM global_promo_entries e
JOIN global_promo_events ev ON ev.id = e.event_id
WHERE ev.status = 'live'
  AND e.status = 'approved'  -- ❌ ERREUR : e.status n'existe pas
```

**Problème** : La table `global_promo_entries` n'a pas de colonne `status` dans la base de données, alors que le code Rust l'attend.

### Erreur 2 : `column "last_error" does not exist`
**Requête problématique** :
```sql
SELECT id, media_id, platform, payload, status, attempt, last_error, ...
FROM social_publication_jobs
WHERE status = 'queued' AND scheduled_for <= NOW()
```

**Problème** : La colonne `last_error` n'existe pas dans `social_publication_jobs`.

## ✅ Commande SQL de Correction (Copier-Coller Direct)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- ============================================================================
-- CORRECTION 1 : Ajouter status à global_promo_entries
-- ============================================================================
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'status') THEN ALTER TABLE global_promo_entries ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')); RAISE NOTICE 'status ajoute a global_promo_entries'; END IF; END $$;

-- ============================================================================
-- CORRECTION 2 : Ajouter last_error à social_publication_jobs
-- ============================================================================
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'last_error') THEN ALTER TABLE social_publication_jobs ADD COLUMN last_error TEXT; RAISE NOTICE 'last_error ajoute a social_publication_jobs'; END IF; END $$;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
SELECT 'global_promo_entries' as table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'status';
SELECT 'social_publication_jobs' as table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'last_error';
EOFSQL
```

## 📝 Explication

1. **`global_promo_entries.status`** : Colonne manquante qui est utilisée dans `publish_entries_for_live_events()` pour filtrer les entrées avec `e.status = 'approved'`. Cette colonne existe dans la migration SQL `00000016_create_promotion_tables.sql` mais n'a pas été ajoutée automatiquement par `auto_migrate.rs` car la table existait déjà.

2. **`social_publication_jobs.last_error`** : Colonne manquante utilisée dans `social_distribution_service.rs` pour stocker les erreurs de publication. Cette colonne existe dans la migration SQL `00000017_create_social_media_tables.sql` mais n'a pas été ajoutée automatiquement.

## ✅ Correction Code Rust

La fonction `ensure_global_promo_entries_columns()` a été mise à jour pour ajouter automatiquement `status` et `metadata` lors des prochains builds.
