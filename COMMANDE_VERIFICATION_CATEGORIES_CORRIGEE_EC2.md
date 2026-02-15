# 🔍 Commande Corrigée - Vérification par Catégories - EC2

## ✅ **Commande Corrigée (Sans Erreur)**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Résumé par catégorie (CORRIGÉ)
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

## 📊 **Version Simplifiée (Sans JOIN)**

Si vous préférez une version plus simple sans JOIN :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Version simplifiée (sans filtre table_type)
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
        table_name,
        COUNT(*) as nb_colonnes
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
) t
GROUP BY categorie
ORDER BY categorie;
EOFSQL
```

---

## 🎯 **Explication de l'Erreur**

L'erreur `column "table_type" does not exist` se produit car :
- `information_schema.columns` ne contient pas la colonne `table_type`
- `table_type` existe dans `information_schema.tables`
- Il faut faire un JOIN entre les deux tables pour filtrer les tables de type 'BASE TABLE'

---

## ✅ **Solution**

Utiliser un JOIN entre `information_schema.columns` et `information_schema.tables` pour accéder à `table_type`, ou utiliser la version simplifiée sans filtre `table_type` (qui fonctionne aussi car `information_schema.columns` ne contient généralement que les colonnes des tables de base).


