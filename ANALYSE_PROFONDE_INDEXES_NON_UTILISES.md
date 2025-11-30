# 🔍 ANALYSE PROFONDE : Pourquoi les index ne sont pas utilisés ?

## Date : 2025-11-30

---

## 🔴 PROBLÈME PRINCIPAL IDENTIFIÉ

### 1. **Les index EXISTENT mais ne sont JAMAIS utilisés**

```
total_scans | tuples_read | tuples_fetched | status
------------+-------------+----------------+----------
     0      |     0       |       0        | ❌ JAMAIS UTILISÉ
```

**Tous les index de recherche ont 0 scans !**

---

## 🔍 CAUSE RACINE : Incompatibilité entre expression et index

### Expression dans la fonction :
```sql
COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')
```

### Index existants :
```sql
-- Index 1
idx_services_titre_service_fts: 
  to_tsvector('french', COALESCE((data->>'titre_service'), ((data->'titre_service')->>'valeur'), ''))

-- Index 2  
idx_services_description_fts:
  to_tsvector('french', COALESCE((data->>'description'), ((data->'description')->>'valeur'), ''))
```

### ❌ PROBLÈME :

**L'ordre dans COALESCE est différent !**

- **Fonction** : `COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '')`
  - Ordre : `valeur` → `titre_service` → `''`

- **Index** : `COALESCE((data->>'titre_service'), ((data->'titre_service')->>'valeur'), '')`
  - Ordre : `titre_service` → `valeur` → `''`

**PostgreSQL ne peut PAS utiliser les index car l'expression ne correspond pas exactement !**

---

## 📊 PREUVE : EXPLAIN ANALYZE

```
-> Seq Scan on services s  (cost=0.00..19.64 rows=1 width=4)
   Filter: (to_tsvector('french', COALESCE(...)) @@ '''photograph'''::tsquery)
   Rows Removed by Filter: 52
   Buffers: shared hit=1140
```

**PostgreSQL fait un SCAN SÉQUENTIEL** au lieu d'utiliser les index GIN !

---

## 🔍 AUTRES PROBLÈMES IDENTIFIÉS

### 2. **Les index de la migration 20250830001 ne sont PAS dans auto_migrate**

La migration `20250830001_001_add_native_search_indexes.sql` crée des index comme :
- `idx_services_fulltext_titre`
- `idx_services_fulltext_description`
- `idx_services_structured_titre`
- etc.

**Mais ces index ne sont PAS créés dans `auto_migrate.rs` !**

Résultat : Ces index n'existent peut-être pas sur Render si la migration n'a pas été appliquée.

---

### 3. **Les index qui existent utilisent un ordre différent de COALESCE**

Les index existants qui fonctionnent :
- `idx_services_titre_service_fts` : `COALESCE((data->>'titre_service'), ((data->'titre_service')->>'valeur'), '')`
- `idx_services_description_fts` : `COALESCE((data->>'description'), ((data->'description')->>'valeur'), '')`

**Mais la fonction utilise l'ordre inverse !**

---

## ✅ SOLUTIONS

### Solution 1 : Aligner l'ordre de COALESCE dans la fonction

**Modifier la fonction pour utiliser le même ordre que les index :**

```sql
-- AVANT (ne correspond pas aux index)
COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')

-- APRÈS (correspond aux index)
COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')
```

### Solution 2 : Créer des index qui correspondent à la fonction

Créer de nouveaux index avec l'ordre utilisé par la fonction.

### Solution 3 : Ajouter les index manquants dans auto_migrate

Ajouter la création des index de `20250830001_001_add_native_search_indexes.sql` dans `auto_migrate.rs`.

---

## 🎯 RECOMMANDATION

**Solution 1 + Solution 3** :
1. Modifier la fonction pour utiliser l'ordre des index existants
2. Ajouter les index manquants dans auto_migrate pour garantir leur création

---

*Analyse effectuée le : 2025-11-30*

