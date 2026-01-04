# 🧪 INSTRUCTIONS TESTS PHASE 1

## 📋 TESTS SQL (PRIORITÉ HAUTE)

### Option 1 : Tests Rapides (Recommandé pour début)

```bash
# Se connecter à la base de données
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Exécuter les tests rapides
\i backend/tests/phase1_quick_tests.sql
```

**Résultats attendus** :
- TEST 1 : `services_avec_differences = 0` (ou différences attendues après suppression JSONB)
- TEST 2 : `product_id_invalides = 0`
- TEST 3 : Statistiques cohérentes
- TEST 4 : Services récents avec `status_jsonb = '✅ NULL'`

### Option 2 : Tests Complets

```bash
# Exécuter tous les tests détaillés
\i backend/tests/phase1_integrity_tests.sql
```

**Voir** : `GUIDE_TESTS_PHASE1.md` pour l'interprétation détaillée de chaque test

---

## 🧪 TESTS MANUELS (PRIORITÉ MOYENNE)

### Test 1 : Créer un service avec plusieurs produits

**Via API** :
```bash
POST /api/services/create
{
  "user_id": <votre_user_id>,
  "data": {
    "titre_service": { "valeur": "Test Service" },
    "produits": {
      "type_donnee": "listeproduit",
      "valeur": [
        { "nom": { "valeur": "Produit 1" }, "prix": { "valeur": { "montant": 1000 } } },
        { "nom": { "valeur": "Produit 2" }, "prix": { "valeur": { "montant": 2000 } } },
        { "nom": { "valeur": "Produit 3" }, "prix": { "valeur": { "montant": 3000 } } }
      ]
    }
  }
}
```

**Vérification SQL** :
```sql
-- Récupérer le service_id créé
SELECT id, data->'titre_service'->>'valeur' as titre, created_at
FROM services 
WHERE user_id = <votre_user_id>
ORDER BY created_at DESC 
LIMIT 1;

-- Vérifier les produits dans la table products
SELECT id, product_index, product_name, is_active, created_at
FROM products
WHERE service_id = <service_id>
ORDER BY product_index;

-- Vérifier que services.data->'produits' est NULL
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
- ✅ 3 produits dans la table `products` avec `product_index` 0, 1, 2
- ✅ `services.data->'produits'` est NULL
- ✅ Chaque produit a un `product_id` unique

### Test 2 : Ajouter un produit à un service existant

**Via API** :
```bash
POST /api/services/<service_id>/products
{
  "user_id": <votre_user_id>,
  "product_data": {
    "nom": { "valeur": "Nouveau Produit" },
    "prix": { "valeur": { "montant": 4000 } }
  }
}
```

**Vérification SQL** :
```sql
-- Vérifier le nombre de produits
SELECT 
    COUNT(*) as total_produits,
    MAX(product_index) as dernier_index,
    MIN(product_index) as premier_index
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
- ✅ Temps de réponse < 1s

### Test 3 : Vérifier autocomplete_characteristics

**Vérification SQL** :
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

### Test 4 : Vérifier la recherche

**Via API** :
```bash
GET /api/search?q=Produit+2
```

**Vérification** :
- ✅ Le produit "Produit 2" est trouvé dans les résultats
- ✅ Les logs backend montrent l'utilisation de la table `products`

---

## 📊 CHECKLIST RAPIDE

### Tests SQL ✅
- [ ] TEST 1 : 0 différences (ou différences attendues)
- [ ] TEST 2 : 0 product_id invalides
- [ ] TEST 3 : Statistiques cohérentes
- [ ] TEST 4 : Services récents avec JSONB NULL

### Tests Manuels ✅
- [ ] Création service avec plusieurs produits → Produits dans table uniquement
- [ ] Ajout produit → Produit dans table uniquement
- [ ] Tous les produits indexés dans autocomplete_characteristics
- [ ] Recherche fonctionne pour tous les produits
- [ ] Performances < 1s pour ajout produit

---

## 🔍 DÉPANNAGE RAPIDE

### TEST 1 retourne des lignes
- **Si `produits_jsonb > produits_table`** : Produits existants non migrés → Phase 2 nécessaire
- **Si `produits_jsonb < produits_table`** : Normal après suppression JSONB

### TEST 2 retourne des lignes
- Vérifier que `save_autocomplete_combination` a été appelé
- Exécuter Phase 2 si nécessaire

### Ajout produit échoue
- Vérifier les logs backend
- Vérifier que la table `products` existe
- Vérifier les permissions de la base de données

---

**Voir** : `GUIDE_TESTS_PHASE1.md` pour plus de détails

