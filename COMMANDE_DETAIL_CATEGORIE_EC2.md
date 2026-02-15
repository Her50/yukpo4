# 🔍 Commandes de Détail par Catégorie - EC2

## 📋 **1. Voir Toutes les Tables d'une Catégorie**

### **Livraisons**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%delivery%'
GROUP BY table_name
ORDER BY table_name;
"
```

### **Coursiers**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%courier%'
GROUP BY table_name
ORDER BY table_name;
"
```

### **Médias**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%media%'
GROUP BY table_name
ORDER BY table_name;
"
```

### **Services/Produits**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (table_name LIKE '%service%' OR table_name LIKE '%product%')
GROUP BY table_name
ORDER BY table_name;
"
```

### **Santé**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (table_name LIKE '%pharmacy%' OR table_name LIKE '%hospital%' OR table_name LIKE '%lab%')
GROUP BY table_name
ORDER BY table_name;
"
```

### **Paiements**
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (table_name LIKE '%payment%' OR table_name LIKE '%transaction%')
GROUP BY table_name
ORDER BY table_name;
"
```

---

## 📊 **2. Voir les Colonnes d'une Table Spécifique**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'NOM_DE_LA_TABLE'
ORDER BY ordinal_position;
"
```

**Exemple** : Voir les colonnes de `product_delivery_config`
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'product_delivery_config'
ORDER BY ordinal_position;
"
```

---

## 📋 **3. Liste Complète de Toutes les Tables**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
"
```

---

## 🎯 **4. Recherche de Tables par Mot-Clé**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%MOT_CLE%'
GROUP BY table_name
ORDER BY table_name;
"
```

**Exemples** :
- Rechercher toutes les tables contenant "flash" : `table_name LIKE '%flash%'`
- Rechercher toutes les tables contenant "bus" : `table_name LIKE '%bus%'`
- Rechercher toutes les tables contenant "video" : `table_name LIKE '%video%'`

---

## 📊 **5. Statistiques Détaillées par Catégorie**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Statistiques détaillées avec liste des tables
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
    table_name,
    COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY categorie, table_name
ORDER BY categorie, table_name;
EOFSQL
```

---

## ✅ **Résumé des Résultats**

D'après votre exécution :
- ✅ **280 tables** au total
- ✅ **3,651 colonnes** au total
- ✅ Base de données complète et fonctionnelle

Les catégories les plus importantes :
1. **Autres** : 134 tables (1,715 colonnes)
2. **Services/Produits** : 28 tables (313 colonnes)
3. **Livraisons** : 25 tables (282 colonnes)
4. **Santé** : 13 tables (193 colonnes)
5. **Vidéo/Audio** : 12 tables (120 colonnes)


