# 🔍 Commande de Vérification de Toutes les Tables - EC2

## 📊 **1. Résumé Rapide (Nombre de Colonnes par Table)**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    c.table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY c.table_name
ORDER BY c.table_name;
"
```

---

## 📋 **2. Liste Complète avec Détails (Table + Colonnes)**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Liste toutes les tables avec leurs colonnes
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;
EOFSQL
```

---

## 📊 **3. Résumé par Catégorie de Tables**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Résumé par catégorie
SELECT 
    CASE 
        WHEN table_name LIKE '%delivery%' THEN 'Livraisons'
        WHEN table_name LIKE '%courier%' THEN 'Coursiers'
        WHEN table_name LIKE '%media%' THEN 'Médias'
        WHEN table_name LIKE '%payment%' OR table_name LIKE '%transaction%' THEN 'Paiements'
        WHEN table_name LIKE '%user%' OR table_name LIKE '%auth%' THEN 'Utilisateurs'
        WHEN table_name LIKE '%service%' OR table_name LIKE '%product%' THEN 'Services/Produits'
        WHEN table_name LIKE '%review%' OR table_name LIKE '%rating%' THEN 'Avis'
        WHEN table_name LIKE '%publicite%' OR table_name LIKE '%ad%' THEN 'Publicité'
        WHEN table_name LIKE '%video%' OR table_name LIKE '%audio%' THEN 'Vidéo/Audio'
        WHEN table_name LIKE '%studio%' OR table_name LIKE '%template%' THEN 'Studio'
        WHEN table_name LIKE '%chat%' OR table_name LIKE '%message%' THEN 'Communication'
        WHEN table_name LIKE '%flash%' OR table_name LIKE '%promo%' THEN 'Promotions'
        WHEN table_name LIKE '%bus%' OR table_name LIKE '%transport%' THEN 'Transport'
        WHEN table_name LIKE '%pharmacy%' OR table_name LIKE '%hospital%' OR table_name LIKE '%lab%' THEN 'Santé'
        WHEN table_name LIKE '%immobilier%' THEN 'Immobilier'
        WHEN table_name LIKE '%emploi%' OR table_name LIKE '%job%' THEN 'Emploi'
        WHEN table_name LIKE '%signalement%' OR table_name LIKE '%sanction%' THEN 'Modération'
        WHEN table_name LIKE '%autocomplete%' OR table_name LIKE '%search%' THEN 'Recherche'
        ELSE 'Autres'
    END as categorie,
    COUNT(DISTINCT table_name) as nb_tables,
    SUM(nb_colonnes) as total_colonnes
FROM (
    SELECT 
        c.table_name,
        COUNT(*) as nb_colonnes
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t 
        ON c.table_schema = t.table_schema 
        AND c.table_name = t.table_name
    WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
    GROUP BY c.table_name
) t
GROUP BY categorie
ORDER BY categorie;
EOFSQL
```

---

## 🔍 **4. Vérification Complète avec Statistiques**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Statistiques complètes
SELECT 
    'Total Tables' as metrique,
    COUNT(DISTINCT t.table_name)::text as valeur
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Total Colonnes' as metrique,
    COUNT(*)::text as valeur
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Tables avec JSONB' as metrique,
    COUNT(DISTINCT c.table_name)::text as valeur
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.data_type = 'jsonb'
UNION ALL
SELECT 
    'Tables avec Géolocalisation' as metrique,
    COUNT(DISTINCT c.table_name)::text as valeur
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND (c.data_type LIKE '%geometry%' OR c.column_name LIKE '%gps%' OR c.column_name LIKE '%latitude%' OR c.column_name LIKE '%longitude%')
UNION ALL
SELECT 
    'Tables avec IA' as metrique,
    COUNT(DISTINCT c.table_name)::text as valeur
FROM information_schema.columns c
INNER JOIN information_schema.tables t 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND (c.column_name LIKE '%ai%' OR c.column_name LIKE '%normalized%');
EOFSQL
```

---

## 📋 **5. Export Complet vers Fichier (Optionnel)**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL' > verification_toutes_tables.txt
-- Export complet
\echo '=== RÉSUMÉ PAR TABLE ==='
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
GROUP BY table_name
ORDER BY table_name;

\echo ''
\echo '=== DÉTAILS PAR TABLE ==='
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name, ordinal_position;
EOFSQL
```

---

## 🎯 **6. Vérification Tables Critiques**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Tables critiques à vérifier
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = t.table_name 
            AND table_schema = 'public'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as statut,
    COUNT(*) as nb_colonnes
FROM information_schema.columns t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'users', 'services', 'products', 'media',
        'deliveries', 'delivery_parcels', 'delivery_media',
        'couriers', 'courier_applications', 'courier_assets',
        'product_delivery_config', 'delivery_proximity_suggestions',
        'payments', 'transactions', 'orders',
        'reviews', 'ratings',
        'publicites', 'flash_sales', 'global_promo_events',
        'studio_sessions', 'video_templates',
        'chat_messages', 'notifications',
        'signalements', 'sanctions_historique',
        'autocomplete_characteristics'
    )
GROUP BY table_name
ORDER BY table_name;
EOFSQL
```

---

## 📊 **7. Commandes Rapides par Catégorie**

### **Tables de Livraison**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name, COUNT(*) as nb_colonnes FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE '%delivery%' GROUP BY table_name ORDER BY table_name;"
```

### **Tables de Coursiers**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name, COUNT(*) as nb_colonnes FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE '%courier%' GROUP BY table_name ORDER BY table_name;"
```

### **Tables Media**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name, COUNT(*) as nb_colonnes FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE '%media%' GROUP BY table_name ORDER BY table_name;"
```

### **Tables de Paiement**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name, COUNT(*) as nb_colonnes FROM information_schema.columns WHERE table_schema = 'public' AND (table_name LIKE '%payment%' OR table_name LIKE '%transaction%') GROUP BY table_name ORDER BY table_name;"
```

---

## 🎯 **Recommandation**

**Pour un audit rapide** : Utilisez la commande **#1** (Résumé Rapide)  
**Pour un audit complet** : Utilisez la commande **#2** (Liste Complète)  
**Pour des statistiques** : Utilisez la commande **#4** (Vérification Complète)

