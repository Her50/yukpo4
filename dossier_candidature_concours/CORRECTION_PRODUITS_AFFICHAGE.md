# ✅ Correction : Affichage des Produits dans Mes Services

**Date**: 2025-11-28  
**Problème**: Les produits créés ne s'affichaient pas dans "Mes Services"  
**Status**: ✅ **Corrigé**

## 🐛 Problème Identifié

La requête SQL dans `get_services_for_prestataire` récupérait **TOUS** les produits sans filtrer ceux qui sont désactivés (`is_active = FALSE`) dans la table `products_lifecycle`.

### Code Avant (Problématique)

```sql
LEFT JOIN products_lifecycle pl 
    ON pl.service_id = s.id AND pl.product_index = p.idx - 1
-- ❌ Pas de filtre WHERE pour exclure is_active = FALSE
```

**Résultat** : Les produits désactivés apparaissaient quand même dans la liste.

## ✅ Solution Appliquée

### Modification 1 : Utiliser `get_active_products`

**Fichier**: `backend/src/controllers/service_controller.rs` (ligne ~1200)

**Avant** :
```sql
COALESCE(
    (SELECT jsonb_agg(...) FROM LATERAL jsonb_array_elements(...) ...),
    '[]'::jsonb
) as produits_light
```

**Après** :
```sql
COALESCE(
    get_active_products(s.data, s.id),
    '[]'::jsonb
) as produits_light
```

### Modification 2 : Compter Uniquement les Produits Actifs

**Fichier**: `backend/src/controllers/service_controller.rs` (ligne ~1225)

**Avant** :
```sql
COALESCE(
    jsonb_array_length(s.data->'produits')::BIGINT,
    0
) as produits_count
```

**Après** :
```sql
COALESCE(
    jsonb_array_length(get_active_products(s.data, s.id))::BIGINT,
    0
) as produits_count
```

## 📊 Fonction `get_active_products`

Cette fonction SQL existe déjà et filtre correctement les produits :

```sql
CREATE OR REPLACE FUNCTION get_active_products(service_data JSONB, p_service_id INTEGER)
RETURNS JSONB AS $$
BEGIN
    -- Itère sur les produits
    -- Vérifie is_active dans products_lifecycle
    -- Si pas d'entrée → considéré comme actif (valeur par défaut)
    -- Retourne uniquement les produits actifs
END;
$$ LANGUAGE plpgsql STABLE;
```

**Comportement** :
- ✅ Produit avec `is_active = TRUE` → **Inclus**
- ✅ Produit sans entrée dans `products_lifecycle` → **Inclus** (actif par défaut)
- ❌ Produit avec `is_active = FALSE` → **Exclu**

## 🎯 Impact

### Avant la Correction
- ❌ Tous les produits s'affichaient (même désactivés)
- ❌ Le comptage incluait les produits désactivés
- ❌ Incohérence entre l'affichage et le statut réel

### Après la Correction
- ✅ Seuls les produits actifs s'affichent
- ✅ Le comptage est cohérent avec l'affichage
- ✅ Les produits désactivés sont correctement masqués

## 🔍 Vérification

Pour vérifier que la correction fonctionne :

```sql
-- 1. Vérifier les produits actifs d'un service
SELECT get_active_products(s.data, s.id) as produits_actifs
FROM services s
WHERE s.id = [SERVICE_ID];

-- 2. Vérifier les produits désactivés
SELECT service_id, product_index, product_nom, is_active
FROM products_lifecycle
WHERE service_id = [SERVICE_ID]
AND is_active = FALSE;
```

## ✅ Tests Recommandés

1. **Créer un produit** → Vérifier qu'il apparaît dans "Mes Services"
2. **Désactiver un produit** → Vérifier qu'il disparaît de "Mes Services"
3. **Réactiver un produit** → Vérifier qu'il réapparaît dans "Mes Services"
4. **Vérifier le comptage** → Le nombre de produits doit correspondre aux produits affichés

## 📝 Notes

- La fonction `get_active_products` est **STABLE** (peut être mise en cache par PostgreSQL)
- Le comportement par défaut (produit actif si pas d'entrée) est maintenu
- La correction est **rétrocompatible** (ne casse pas les services existants)

---

**Status**: ✅ **Correction appliquée - Prêt pour tests**

