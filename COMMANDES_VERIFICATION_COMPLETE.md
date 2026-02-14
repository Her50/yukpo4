# ✅ Commandes de Vérification Complète

## 📋 VÉRIFICATION 1 : ENABLE_AUTO_MIGRATIONS

### Option A : Via AWS Console (Recommandé)

**Instructions** :
1. AWS Console → ECS → Définitions de tâches → yukpo-backend
2. Cliquez sur la dernière révision
3. Container Definitions → Cliquez sur le conteneur
4. Variables d'environnement → Cherchez `ENABLE_AUTO_MIGRATIONS`
5. Vérifiez : Type = `Valeur`, Valeur = `true`

### Option B : Via AWS CLI (Si Permissions)

```bash
aws ecs describe-task-definition \
  --task-definition yukpo-backend \
  --region eu-west-1 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`ENABLE_AUTO_MIGRATIONS`]' \
  --output json
```

---

## 📋 VÉRIFICATION 2 : Tables Créées

### Commande SQL Complète

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
  -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -p 5432 \
  -U yukpo_admin \
  -d yukpo \
  -f VERIFIER_TABLES_CREEES.sql
```

### OU Commande SQL Directe (Copier-Coller)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Compter le nombre total de tables
SELECT 'Total tables' as type, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Vérifier les tables critiques
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t.table_name
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
FROM (
    VALUES ('property_views'), ('property_shares'), ('family_profiles'), 
           ('recipes'), ('menu_plans'), ('delivery_chat_messages'), 
           ('videos'), ('user_preferences')
) AS t(table_name);

-- 3. Résumé
SELECT 
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    )) as tables_existantes,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    )) as tables_manquantes
FROM (
    VALUES ('property_views'), ('property_shares'), ('family_profiles'), 
           ('recipes'), ('menu_plans'), ('delivery_chat_messages'), 
           ('videos'), ('user_preferences')
) AS t(table_name);
EOFSQL
```

---

## 📋 VÉRIFICATION 3 : Colonnes Corrigées

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT 'live_session_analytics.last_synced_at' as colonne, CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_session_analytics' AND column_name = 'last_synced_at') THEN '✅ Existe' ELSE '❌ Manquante' END as status UNION ALL SELECT 'global_promo_products.highlighted' as colonne, CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_products' AND column_name = 'highlighted') THEN '✅ Existe' ELSE '❌ Manquante' END as status;"
```

---

## 📋 VÉRIFICATION 4 : Index et Vue Corrigés

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_offres_date_limite' UNION ALL SELECT matviewname, CASE WHEN ispopulated THEN 'Peuplée' ELSE 'Vide' END FROM pg_matviews WHERE matviewname = 'hashtag_stats_materialized';"
```
