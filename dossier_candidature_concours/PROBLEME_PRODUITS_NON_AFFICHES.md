# 🔍 Analyse : Pourquoi les Produits Créés ne s'Affichent pas dans Mes Services

**Date**: 2025-11-28  
**Problème**: Les produits créés ne s'affichent pas dans la liste "Mes Services"

## 🐛 Problème Identifié

### Code Actuel (Ligne 1219-1220 de `service_controller.rs`)

```sql
LEFT JOIN products_lifecycle pl 
    ON pl.service_id = s.id AND pl.product_index = p.idx - 1
```

**❌ Problème**: La requête récupère **TOUS** les produits sans filtrer ceux qui sont désactivés (`is_active = FALSE`) dans la table `products_lifecycle`.

### Conséquence

1. Les produits sont créés dans `services.data->'produits'`
2. Une entrée est créée dans `products_lifecycle` avec `is_active = TRUE` par défaut
3. **MAIS** si le produit n'a pas d'entrée dans `products_lifecycle` (problème de synchronisation) ou si `is_active = FALSE`, il n'est pas filtré correctement

## 🔧 Solutions Possibles

### Solution 1 : Filtrer les Produits Désactivés dans la Requête SQL ✅ (Recommandée)

**Modifier la requête pour exclure les produits avec `is_active = FALSE`** :

```sql
LEFT JOIN products_lifecycle pl 
    ON pl.service_id = s.id AND pl.product_index = p.idx - 1
    AND (pl.is_active = TRUE OR pl.is_active IS NULL)  -- ✅ Produit actif ou pas d'entrée = actif par défaut
```

**OU utiliser un WHERE dans la sous-requête** :

```sql
WHERE (pl.is_active = TRUE OR pl.is_active IS NULL)
```

### Solution 2 : Utiliser la Fonction `get_active_products` ✅ (Meilleure)

Il existe déjà une fonction SQL `get_active_products` qui filtre correctement les produits actifs. **Utiliser cette fonction au lieu de la requête manuelle** :

```sql
-- Au lieu de :
COALESCE(
    (SELECT jsonb_agg(...) FROM LATERAL jsonb_array_elements(...) ...),
    '[]'::jsonb
) as produits_light

-- Utiliser :
COALESCE(
    get_active_products(s.data, s.id),
    '[]'::jsonb
) as produits_light
```

### Solution 3 : Vérifier la Synchronisation `products_lifecycle`

**Problème possible** : Les produits créés ne sont pas automatiquement synchronisés dans `products_lifecycle`.

**Vérification** :
```sql
-- Vérifier si les produits ont des entrées dans products_lifecycle
SELECT 
    s.id as service_id,
    jsonb_array_length(s.data->'produits') as produits_count,
    COUNT(pl.id) as lifecycle_entries
FROM services s
LEFT JOIN products_lifecycle pl ON pl.service_id = s.id
WHERE s.user_id = [VOTRE_USER_ID]
GROUP BY s.id
HAVING jsonb_array_length(s.data->'produits') > COUNT(pl.id);
```

## 📊 Analyse du Code Actuel

### Ligne 1208 de `service_controller.rs`

```rust
'is_active', COALESCE(pl.is_active, true)
```

**✅ Bon** : Si pas d'entrée dans `products_lifecycle`, le produit est considéré comme actif (`true`).

**❌ Problème** : Mais si `pl.is_active = FALSE`, le produit est quand même inclus dans les résultats !

### Correction Nécessaire

**Option A** : Filtrer dans la sous-requête
```sql
WHERE (pl.is_active = TRUE OR pl.is_active IS NULL)
```

**Option B** : Utiliser `get_active_products` (recommandé)
```sql
get_active_products(s.data, s.id) as produits_light
```

## 🎯 Actions Recommandées

### Priorité 1 : Corriger la Requête SQL

1. **Modifier `get_services_for_prestataire`** pour filtrer les produits désactivés
2. **Utiliser `get_active_products`** si possible (plus maintenable)

### Priorité 2 : Vérifier la Synchronisation

1. **Vérifier** que les produits créés sont bien synchronisés dans `products_lifecycle`
2. **Vérifier** que le trigger `trigger_sync_products` fonctionne correctement

### Priorité 3 : Tests

1. **Créer un produit** et vérifier qu'il apparaît dans "Mes Services"
2. **Désactiver un produit** et vérifier qu'il disparaît
3. **Réactiver un produit** et vérifier qu'il réapparaît

## 🔍 Diagnostic

Pour diagnostiquer le problème pour un utilisateur spécifique :

```sql
-- 1. Vérifier les services de l'utilisateur
SELECT id, data->'titre_service'->>'valeur' as titre, 
       jsonb_array_length(data->'produits') as produits_count
FROM services 
WHERE user_id = [USER_ID];

-- 2. Vérifier les entrées products_lifecycle
SELECT service_id, product_index, product_nom, is_active, created_at
FROM products_lifecycle
WHERE service_id IN (SELECT id FROM services WHERE user_id = [USER_ID])
ORDER BY service_id, product_index;

-- 3. Vérifier les produits désactivés
SELECT service_id, product_index, product_nom, is_active, auto_deactivate_at
FROM products_lifecycle
WHERE service_id IN (SELECT id FROM services WHERE user_id = [USER_ID])
AND is_active = FALSE;
```

## ✅ Solution Immédiate

**Modifier la requête SQL dans `get_services_for_prestataire`** :

```rust
// Ligne ~1219-1220
LEFT JOIN products_lifecycle pl 
    ON pl.service_id = s.id AND pl.product_index = p.idx - 1
    AND (pl.is_active = TRUE OR pl.is_active IS NULL)  // ✅ AJOUTER CETTE LIGNE
```

OU mieux encore, utiliser la fonction existante :

```rust
// Remplacer toute la sous-requête produits_light par :
COALESCE(
    get_active_products(s.data, s.id),
    '[]'::jsonb
) as produits_light,
```

---

**Status**: 🔴 **Problème identifié - Correction nécessaire**

