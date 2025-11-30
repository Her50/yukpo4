# 🔍 ANALYSE DES PROBLÈMES DE PERFORMANCE

## Date : 2025-11-30

---

## 🔴 PROBLÈMES IDENTIFIÉS

### 1. **Les index GIN ne sont PAS utilisés**

```
scans | tuples_read | tuples_fetched
------+-------------+----------------
   0  |     0       |       0
```

**Tous les index de recherche ont 0 scans !** La fonction fait des **scans séquentiels** au lieu d'utiliser les index GIN.

---

### 2. **Lecture excessive de buffers**

| Méthode | Buffers lus | Temps |
|---------|-------------|-------|
| **Recherche directe** | 2,216 | 22ms |
| **Fonction actuelle** | **7,008** | 316ms |

**3x plus de buffers lus** = 3x plus lent !

---

### 3. **DISTINCT ON avec ORDER BY coûteux**

La fonction utilise :
```sql
SELECT DISTINCT ON (s.id)
...
ORDER BY s.id, relevance_score DESC
```

Le problème : `relevance_score` est une **expression calculée** (`ts_rank`), ce qui empêche l'utilisation des index et force un tri complet.

---

### 4. **Recalculs multiples**

- `to_tsvector` est calculé **plusieurs fois** pour chaque ligne
- `ts_rank` est calculé dans le SELECT et potentiellement dans le ORDER BY
- La requête `plainto_tsquery` est recréée pour chaque appel

---

### 5. **Recherches ne trouvent pas de résultats**

La recherche full-text directe trouve "photographe" en **22ms**, mais :
- La fonction retourne 0 résultat dans certains cas
- La recherche full-text trouve 1 résultat (id: 13 - "Services de photographie professionnelle")

**Le problème** : La fonction peut filtrer incorrectement ou avoir des problèmes de matching.

---

## 📊 COMPARAISON DES PERFORMANCES

| Test | Recherche directe | Fonction actuelle | Ratio |
|------|-------------------|-------------------|-------|
| **Temps** | 22-88ms | 257-561ms | **6-11x plus lent** |
| **Buffers** | 2,216 | 7,008 | **3x plus** |
| **Index utilisés** | ❌ Non | ❌ Non | Même problème |

---

## ✅ SOLUTIONS PROPOSÉES

### Solution 1 : Utiliser les index GIN existants

Les index existent mais ne sont pas utilisés. Il faut :
1. Forcer l'utilisation des index avec des contraintes appropriées
2. Réécrire la fonction pour utiliser les index GIN directement

### Solution 2 : Éviter les recalculs

1. **Préparer `query_tsquery` une seule fois** en dehors de la boucle
2. **Utiliser des CTE** pour calculer les scores une seule fois
3. **Éviter DISTINCT ON** si possible, ou l'optimiser

### Solution 3 : Optimiser DISTINCT ON

Au lieu de :
```sql
ORDER BY s.id, relevance_score DESC
```

Utiliser :
```sql
WITH ranked AS (SELECT ..., score FROM ...)
SELECT DISTINCT ON (id) ... FROM ranked ORDER BY id, score DESC
```

### Solution 4 : Réduire les lectures de buffers

1. Limiter les colonnes lues
2. Utiliser les index pour filtrer avant de lire les données
3. Éviter les scans séquentiels

---

## 🚀 OPTIMISATION CRÉÉE

J'ai créé une version optimisée dans `backend/optimisation_search_gps_final.sql` qui :

1. ✅ Prépare `query_tsquery` une seule fois
2. ✅ Utilise des CTE pour éviter les recalculs
3. ✅ Optimise DISTINCT ON avec CTE
4. ✅ Structure mieux pour permettre l'utilisation des index

---

## 📝 PROCHAINES ÉTAPES

1. **Tester la version optimisée** et comparer les performances
2. **Vérifier que les index sont utilisés** après optimisation
3. **Mesurer l'amélioration** (objectif : <100ms)

---

*Analyse effectuée le : 2025-11-30*

