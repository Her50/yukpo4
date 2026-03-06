# Test de correction du premier produit créé lors de la création du service

## Problème identifié
Le premier produit créé lors de la création du service s'affichait bizarrement ou disparaissait des recherches car:
1. `product_name` générait "Produit sans nom" (structure de données non gérée)
2. Score de recherche = 0 → filtré out dans `ResultatBesoinScreen`
3. Informations incomplètes dans la carte produit

## Solutions appliquées

### 1. Correction de la colonne générée `product_name`
```sql
product_name TEXT GENERATED ALWAYS AS (
    COALESCE(
        product_data->'nom'->>'valeur',      -- formulaire dynamique
        product_data->'nom_produit'->>'valeur', -- formulaire dynamique
        product_data->>'nom',               -- format simple
        product_data->>'nom_produit',       -- format simple
        product_data->>'titre',             -- fallback
        product_data->>'title',             -- fallback anglais
        product_data->>'name',              -- fallback anglais
        'Produit sans nom'                  -- fallback final
    )
) STORED
```

### 2. Migration des données existantes
- Correction automatique des `product_name = 'Produit sans nom'` avec données disponibles
- Migration dans `auto_migrate.rs` pour futures installations

### 3. Amélioration du filtrage mobile
- Score minimal de 1 pour produits avec données de base (images, id, etc.)
- Logs debug détaillés pour diagnostiquer les problèmes
- Vérification explicite du premier produit (product_index === 0)

## Tests à effectuer

### Test 1: Création d'un nouveau service avec produit
1. Créer un service via l'application mobile
2. Vérifier que le premier produit s'affiche correctement
3. Vérifier `product_name` dans la base de données

```sql
SELECT id, product_index, product_name, product_data->>'nom' as nom_simple
FROM service_products 
WHERE service_id = [ID_DU_NOUVEAU_SERVICE]
ORDER BY product_index;
```

### Test 2: Recherche avec plusieurs produits
1. Créer un service avec 2+ produits
2. Faire une recherche pertinente
3. Vérifier que TOUS les produits s'affichent (y compris le premier)
4. Vérifier les logs debug dans la console mobile

### Test 3: Vérification des logs debug
Activer le mode debug `__DEV__` et vérifier les logs:
```
🔍 [ResultatBesoinScreen] DEBUG Score produit (index=0): {...}
🎯 [ResultatBesoinScreen] Service X: Filtrage recherche "requete" {...}
⚠️ [ResultatBesoinScreen] Score minimal appliqué pour produit avec données de base...
```

## Résultats attendus
- ✅ Le premier produit a un `product_name` correct
- ✅ Le premier produit apparaît dans les recherches pertinentes
- ✅ La carte produit affiche toutes les informations
- ✅ Pas de "Produit sans nom" dans les résultats

## Fichiers modifiés
- `backend/migrations/fix_product_name_generation.sql` - Migration immédiate
- `backend/src/migrations/auto_migrate.rs` - Migration automatique
- `mobile/src/screens/ResultatBesoinScreen.tsx` - Logs et score minimal
