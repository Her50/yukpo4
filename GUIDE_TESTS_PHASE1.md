# 🧪 GUIDE TESTS PHASE 1 : Table Products

## 📋 TESTS SQL (PRIORITÉ HAUTE)

### Prérequis
- Accès à la base de données PostgreSQL
- Outil pour exécuter des requêtes SQL (psql, pgAdmin, DBeaver, etc.)

### Connexion à la base de données

**Via psql** :
```bash
psql -h <host> -U <user> -d yukpomnang
```

**Via Render.com** :
```bash
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
```

### Exécution des tests

**Option 1 : Exécuter le fichier complet** :
```sql
\i backend/tests/phase1_integrity_tests.sql
```

**Option 2 : Exécuter chaque test individuellement** (recommandé pour debug)

#### TEST 1 : Vérifier que tous les produits sont dans JSONB ET table products
```sql
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_titre,
    jsonb_array_length(s.data->'produits'->'valeur') as produits_jsonb,
    COUNT(p.id) as produits_table,
    CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') = COUNT(p.id) THEN '✅ OK'
        WHEN jsonb_array_length(s.data->'produits'->'valeur') > COUNT(p.id) THEN '❌ PRODUITS MANQUANTS dans table'
        ELSE '❌ TROP DE PRODUITS dans table'
    END as status,
    jsonb_array_length(s.data->'produits'->'valeur') - COUNT(p.id) as difference
FROM services s
LEFT JOIN products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id, s.data
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id)
ORDER BY s.id;
```

**Résultat attendu** : 0 lignes (tous les produits doivent être dans les deux endroits)

**Si des lignes sont retournées** :
- `produits_jsonb > produits_table` : Des produits dans JSONB ne sont pas dans la table → Exécuter Phase 2 (migration)
- `produits_jsonb < produits_table` : Des produits dans la table ne sont pas dans JSONB → Normal après suppression JSONB

#### TEST 2 : Vérifier que les product_index correspondent
```sql
SELECT 
    s.id as service_id,
    p.product_index,
    p.id as product_table_id,
    p.product_name,
    CASE 
        WHEN s.data->'produits'->'valeur'->p.product_index IS NOT NULL THEN '✅ OK'
        ELSE '❌ PRODUIT JSONB MANQUANT'
    END as status_jsonb,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ OK'
        ELSE '❌ PRODUIT TABLE MANQUANT'
    END as status_table
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(s.data->'produits'->'valeur') WITH ORDINALITY AS prod(value, index)
LEFT JOIN products p ON p.service_id = s.id AND p.product_index = (prod.index - 1)::INTEGER
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND (
    s.data->'produits'->'valeur'->p.product_index IS NULL
    OR p.id IS NULL
)
ORDER BY s.id, p.product_index;
```

**Résultat attendu** : 0 lignes (après suppression JSONB, ce test peut retourner des lignes - c'est normal)

#### TEST 3 : Vérifier que autocomplete_characteristics.product_id référence bien products.id
```sql
SELECT 
    ac.id as autocomplete_id,
    ac.service_id,
    ac.product_id,
    p.id as product_table_id,
    p.product_index,
    p.product_name,
    CASE 
        WHEN ac.product_id::INTEGER = p.id THEN '✅ OK'
        WHEN p.id IS NULL THEN '❌ PRODUCT_ID INVALIDE (produit n''existe pas)'
        ELSE '❌ PRODUCT_ID INCORRECT'
    END as status
FROM autocomplete_characteristics ac
LEFT JOIN products p ON p.id = ac.product_id::INTEGER
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL
AND (
    ac.product_id::INTEGER != p.id
    OR p.id IS NULL
)
ORDER BY ac.service_id, ac.id;
```

**Résultat attendu** : 0 lignes (tous les product_id doivent référencer des products.id valides)

#### TEST 4 : Vérifier que tous les produits ont un product_id dans autocomplete_characteristics
```sql
SELECT 
    p.id as product_id,
    p.service_id,
    p.product_index,
    p.product_name,
    COUNT(ac.id) as autocomplete_entries,
    CASE 
        WHEN COUNT(ac.id) > 0 THEN '✅ OK'
        ELSE '⚠️ PAS D''ENTRÉE autocomplete_characteristics'
    END as status
FROM products p
LEFT JOIN autocomplete_characteristics ac ON ac.product_id::INTEGER = p.id 
    AND ac.is_real_product = TRUE 
    AND ac.identifiant_base = 'produits'
WHERE p.is_active = true
GROUP BY p.id, p.service_id, p.product_index, p.product_name
HAVING COUNT(ac.id) = 0
ORDER BY p.service_id, p.product_index;
```

**Résultat attendu** : 0 lignes ou peu de lignes (les produits récemment créés peuvent ne pas avoir d'entrée autocomplete_characteristics si `save_autocomplete_combination` n'a pas encore été appelé)

#### TEST 5 : Statistiques globales
```sql
SELECT 
    'Services avec produits' as metric,
    COUNT(DISTINCT s.id) as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0

UNION ALL

SELECT 
    'Produits dans JSONB (total)' as metric,
    SUM(jsonb_array_length(s.data->'produits'->'valeur'))::BIGINT as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'

UNION ALL

SELECT 
    'Produits dans table products (total)' as metric,
    COUNT(*)::BIGINT as count
FROM products
WHERE is_active = true

UNION ALL

SELECT 
    'Produits avec autocomplete_characteristics' as metric,
    COUNT(DISTINCT ac.product_id)::BIGINT as count
FROM autocomplete_characteristics ac
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL

UNION ALL

SELECT 
    'Services avec produits non migrés' as metric,
    COUNT(DISTINCT s.id)::BIGINT as count
FROM services s
LEFT JOIN products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id);
```

**Résultat attendu** : Aperçu global de l'état de la migration

### Interprétation des résultats

#### TEST 1 retourne des lignes
- **Si `produits_jsonb > produits_table`** : Des produits dans JSONB ne sont pas dans la table → Exécuter Phase 2 (migration)
- **Si `produits_jsonb < produits_table`** : Normal après suppression JSONB (les nouveaux produits ne sont plus dans JSONB)

#### TEST 3 retourne des lignes
- Des `product_id` dans `autocomplete_characteristics` ne référencent pas des `products.id` valides
- **Action** : Vérifier que `save_autocomplete_combination` a été appelé après la création des produits

#### TEST 4 retourne des lignes
- Des produits n'ont pas d'entrée dans `autocomplete_characteristics`
- **Action** : Vérifier que `save_autocomplete_combination` a été appelé

---

## 🧪 TESTS MANUELS (PRIORITÉ MOYENNE)

### Prérequis
- Backend compilé et démarré
- Accès à l'API (frontend ou mobile)
- Compte utilisateur avec droits de création de service

### Test 1 : Créer un service avec plusieurs produits

**Étapes** :
1. Créer un service avec 3+ produits via l'API
2. Vérifier dans la base de données :
   ```sql
   -- Récupérer le service_id créé
   SELECT id, data->'titre_service'->>'valeur' as titre
   FROM services 
   WHERE user_id = <votre_user_id>
   ORDER BY created_at DESC 
   LIMIT 1;
   
   -- Vérifier les produits dans la table products
   SELECT id, product_index, product_name, is_active
   FROM products
   WHERE service_id = <service_id>
   ORDER BY product_index;
   
   -- Vérifier que services.data->'produits' est NULL ou vide
   SELECT 
       id,
       data->'produits' as produits_jsonb,
       CASE 
           WHEN data->'produits' IS NULL THEN '✅ NULL (correct)'
           WHEN data->'produits' = 'null'::jsonb THEN '✅ NULL (correct)'
           ELSE '⚠️ PRODUITS ENCORE DANS JSONB'
       END as status
   FROM services
   WHERE id = <service_id>;
   ```

**Résultats attendus** :
- ✅ Tous les produits sont dans la table `products`
- ✅ `services.data->'produits'` est NULL ou vide
- ✅ Chaque produit a un `product_index` correct (0, 1, 2, ...)

### Test 2 : Ajouter un produit à un service existant

**Étapes** :
1. Sélectionner un service existant avec des produits
2. Ajouter un nouveau produit via l'API
3. Vérifier dans la base de données :
   ```sql
   -- Vérifier le nombre de produits
   SELECT 
       COUNT(*) as total_produits,
       MAX(product_index) as dernier_index
   FROM products
   WHERE service_id = <service_id>;
   
   -- Vérifier le dernier produit ajouté
   SELECT id, product_index, product_name, created_at
   FROM products
   WHERE service_id = <service_id>
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Résultats attendus** :
- ✅ Le nouveau produit est dans la table `products`
- ✅ Le `product_index` est correct (suivant le dernier)
- ✅ `services.data->'produits'` reste NULL ou vide

### Test 3 : Vérifier autocomplete_characteristics

**Étapes** :
1. Après création/ajout de produit, vérifier :
   ```sql
   -- Vérifier que tous les produits ont une entrée autocomplete_characteristics
   SELECT 
       p.id as product_id,
       p.product_index,
       p.product_name,
       ac.id as autocomplete_id,
       ac.product_id as ac_product_id,
       CASE 
           WHEN ac.id IS NOT NULL AND ac.product_id::INTEGER = p.id THEN '✅ OK'
           WHEN ac.id IS NULL THEN '⚠️ PAS D''ENTRÉE autocomplete'
           ELSE '❌ PRODUCT_ID INCORRECT'
       END as status
   FROM products p
   LEFT JOIN autocomplete_characteristics ac ON ac.product_id::INTEGER = p.id
       AND ac.is_real_product = TRUE
       AND ac.identifiant_base = 'produits'
   WHERE p.service_id = <service_id>
   ORDER BY p.product_index;
   ```

**Résultats attendus** :
- ✅ Tous les produits ont une entrée dans `autocomplete_characteristics`
- ✅ Chaque `ac.product_id` correspond au `p.id` du produit

### Test 4 : Vérifier la recherche de produits

**Étapes** :
1. Rechercher un produit (pas le premier) d'un service
2. Vérifier que le produit est trouvé via la recherche
3. Vérifier dans les logs backend que la recherche utilise la table `products`

**Résultats attendus** :
- ✅ Tous les produits sont trouvables via la recherche
- ✅ La recherche utilise la table `products` (pas JSONB)

### Test 5 : Vérifier les performances

**Étapes** :
1. Mesurer le temps d'ajout d'un produit :
   ```sql
   -- Avant ajout
   SELECT NOW() as start_time;
   
   -- Ajouter un produit via l'API
   -- (mesurer le temps de réponse)
   
   -- Après ajout
   SELECT NOW() as end_time;
   ```

**Résultats attendus** :
- ✅ Ajout produit : < 1s (au lieu de 30-60s avec JSONB)
- ✅ Pas d'erreur "peer closed connection" (timeout)

---

## 📊 CHECKLIST DE VALIDATION

### Tests SQL ✅
- [ ] TEST 1 : 0 différences (ou différences attendues après suppression JSONB)
- [ ] TEST 3 : 0 product_id invalides
- [ ] TEST 4 : Tous les produits ont une entrée autocomplete_characteristics
- [ ] TEST 5 : Statistiques cohérentes

### Tests Manuels ✅
- [ ] Test 1 : Création service avec plusieurs produits fonctionne
- [ ] Test 2 : Ajout produit fonctionne
- [ ] Test 3 : Tous les produits indexés dans autocomplete_characteristics
- [ ] Test 4 : Recherche fonctionne pour tous les produits
- [ ] Test 5 : Performances améliorées (< 1s pour ajout produit)

---

## 🔍 DÉPANNAGE

### Problème : TEST 1 retourne des lignes avec `produits_jsonb > produits_table`
**Solution** : Exécuter Phase 2 (migration des produits existants)

### Problème : TEST 3 retourne des lignes (product_id invalides)
**Solution** : 
1. Vérifier que `save_autocomplete_combination` a été appelé
2. Vérifier que les produits existent dans la table `products`
3. Exécuter Phase 2 (migration des product_id dans autocomplete_characteristics)

### Problème : TEST 4 retourne des lignes (produits sans autocomplete_characteristics)
**Solution** :
1. Vérifier que `save_autocomplete_combination` a été appelé après création
2. Appeler manuellement `save_autocomplete_combination` pour les produits manquants

### Problème : Ajout produit échoue
**Solution** :
1. Vérifier les logs backend
2. Vérifier que la table `products` existe
3. Vérifier que `ProductsService` est correctement initialisé

---

## 📝 NOTES

- Les tests SQL peuvent être exécutés plusieurs fois (idempotents)
- Les tests manuels nécessitent un backend fonctionnel
- Après suppression JSONB, TEST 1 peut retourner des lignes (normal)
- Les nouveaux produits ne seront plus dans JSONB (comportement attendu)

