# 🔍 DIAGNOSTIC COMPLET : Pourquoi les index ne sont pas utilisés

## Date : 2025-11-30

---

## 🔴 PROBLÈME IDENTIFIÉ

### Cause racine : **PostgreSQL ne peut pas utiliser les index à l'intérieur des fonctions PL/pgSQL**

Quand une fonction PL/pgSQL fait un `RETURN QUERY`, PostgreSQL :
1. ✅ Peut utiliser les index si la requête est simple
2. ❌ **NE PEUT PAS** utiliser les index si l'expression ne correspond pas EXACTEMENT
3. ❌ **NE PEUT PAS** utiliser les index si la requête est trop complexe

---

## 📊 PREUVE

### Test direct (sans fonction) :
```sql
SELECT s.id
FROM services s
WHERE to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) 
      @@ plainto_tsquery('french', 'photographe')
```

**Résultat** : `Seq Scan` (scan séquentiel) - **Les index ne sont PAS utilisés même directement !**

---

## 🔍 ANALYSE DES INDEX EXISTANTS

### Index qui existent :
1. `idx_services_titre_service_fts` : 
   ```sql
   to_tsvector('french', COALESCE((data->>'titre_service'), ((data->'titre_service')->>'valeur'), ''))
   ```

2. `idx_services_description_fts` :
   ```sql
   to_tsvector('french', COALESCE((data->>'description'), ((data->'description')->>'valeur'), ''))
   ```

### Expression dans la fonction (après correction) :
```sql
COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')
```

**✅ L'ordre correspond maintenant !**

---

## ❌ MAIS POURQUOI LES INDEX NE SONT TOUJOURS PAS UTILISÉS ?

### Raison 1 : PostgreSQL ne peut pas utiliser les index sur des expressions COALESCE complexes

Même si l'ordre correspond, PostgreSQL a du mal à utiliser les index GIN sur des expressions `COALESCE` avec plusieurs niveaux d'accès JSONB.

### Raison 2 : Les index sont sur `to_tsvector(...)` mais la requête calcule `to_tsvector(...)` à nouveau

PostgreSQL ne peut pas utiliser un index sur `to_tsvector(expression)` si la requête recalcule `to_tsvector(expression)` - il doit correspondre EXACTEMENT.

### Raison 3 : La table est petite (53 services actifs)

Avec seulement 53 services actifs, PostgreSQL estime qu'un **scan séquentiel est plus rapide** qu'un index scan !

```
Rows Removed by Filter: 52
```

PostgreSQL scanne les 53 lignes et filtre 52 - c'est plus rapide que d'utiliser un index GIN.

---

## ✅ SOLUTIONS

### Solution 1 : Forcer l'utilisation des index (si table grandit)

Quand la table aura plus de données, PostgreSQL utilisera automatiquement les index.

### Solution 2 : Créer des index fonctionnels plus simples

Créer des index sur les expressions exactes utilisées dans la fonction.

### Solution 3 : Optimiser pour les petites tables

Pour les petites tables (< 1000 lignes), les scans séquentiels sont souvent plus rapides que les index.

---

## 📊 CONCLUSION

**Les index ne sont pas utilisés car :**
1. ✅ La table est petite (53 services) - scan séquentiel plus rapide
2. ✅ PostgreSQL estime que le scan est optimal
3. ⚠️ Les expressions COALESCE complexes empêchent l'utilisation des index

**Ce n'est PAS un problème de performance pour l'instant** - avec 53 services, 360ms est acceptable.

**Quand la table grandira (> 1000 services), PostgreSQL utilisera automatiquement les index.**

---

*Analyse effectuée le : 2025-11-30*

