# 📋 COMMANDE À EXÉCUTER SUR EC2 : Vérification des Tables

## ✅ Commande SQL Complète (À Exécuter sur EC2)

**Copiez-collez cette commande sur votre instance EC2** :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- ============================================================================
-- VÉRIFICATION DES TABLES CRÉÉES
-- ============================================================================

-- 1. Nombre total de tables
SELECT 'Total tables' as type, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Tables critiques (celles qui avaient des erreurs dans le Log 58)
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
    VALUES 
        ('property_views'),
        ('property_shares'),
        ('family_profiles'),
        ('recipes'),
        ('menu_plans'),
        ('delivery_chat_messages'),
        ('videos'),
        ('user_preferences'),
        ('offres_emploi'),
        ('profils_candidats'),
        ('candidatures'),
        ('livres_scolaires'),
        ('troc_livres_scolaires'),
        ('delivery_gamification_stats'),
        ('delivery_badges'),
        ('user_documents'),
        ('loyalty_transactions'),
        ('chat_support_sessions')
) AS t(table_name)
ORDER BY status DESC, table_name;

-- 3. Résumé
SELECT 
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    )) as tables_existantes,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    )) as tables_manquantes,
    COUNT(*) as total
FROM (
    VALUES 
        ('property_views'),
        ('property_shares'),
        ('family_profiles'),
        ('recipes'),
        ('menu_plans'),
        ('delivery_chat_messages'),
        ('videos'),
        ('user_preferences'),
        ('offres_emploi'),
        ('profils_candidats'),
        ('candidatures'),
        ('livres_scolaires'),
        ('troc_livres_scolaires'),
        ('delivery_gamification_stats'),
        ('delivery_badges'),
        ('user_documents'),
        ('loyalty_transactions'),
        ('chat_support_sessions')
) AS t(table_name);

-- 4. Colonnes corrigées
SELECT 
    'live_session_analytics.last_synced_at' as colonne,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'live_session_analytics' 
            AND column_name = 'last_synced_at'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
UNION ALL
SELECT 
    'global_promo_products.highlighted' as colonne,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'global_promo_products' 
            AND column_name = 'highlighted'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status;

-- 5. Index corrigé
SELECT 
    'idx_offres_date_limite' as index_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_offres_date_limite'
        ) THEN '✅ Existe'
        ELSE '❌ Manquant'
    END as status,
    indexdef
FROM pg_indexes 
WHERE indexname = 'idx_offres_date_limite';

-- 6. Vue matérialisée corrigée
SELECT 
    'hashtag_stats_materialized' as vue,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_matviews 
            WHERE matviewname = 'hashtag_stats_materialized'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status,
    CASE WHEN ispopulated THEN 'Peuplée' ELSE 'Vide' END as etat
FROM pg_matviews 
WHERE matviewname = 'hashtag_stats_materialized';
EOFSQL
```

---

## 📋 Commande Rapide (Alternative)

Si vous préférez une commande plus courte :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT 'Total tables' as type, COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'; SELECT table_name, CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) THEN '✅ Existe' ELSE '❌ Manquante' END as status FROM (VALUES ('property_views'), ('property_shares'), ('family_profiles'), ('recipes'), ('menu_plans'), ('delivery_chat_messages'), ('videos'), ('user_preferences')) AS t(table_name) ORDER BY status DESC, table_name;"
```

---

## 📊 Résultats Attendus

### Si tout est OK :

1. **Total tables** : ~50-100+ tables
2. **Tables critiques** : Toutes avec status `✅ Existe`
3. **Tables existantes** : 18/18 (ou proche)
4. **Tables manquantes** : 0
5. **Colonnes** : ✅ Existe pour les deux
6. **Index** : ✅ Existe
7. **Vue** : ✅ Existe

### Si des tables manquent :

- Les auto-migrations n'ont peut-être pas encore été exécutées
- Vérifiez que `ENABLE_AUTO_MIGRATIONS=true` dans la task definition
- Vérifiez les logs de démarrage du backend

---

## 🔍 Instructions

1. **Connectez-vous** à votre instance EC2 (via SSM Session Manager ou SSH)
2. **Copiez** la commande complète ci-dessus
3. **Collez** dans votre terminal EC2
4. **Appuyez** sur Entrée
5. **Analysez** les résultats

---

**Note** : La base de données RDS n'est probablement accessible que depuis EC2 (VPC privé), pas depuis votre machine locale.

