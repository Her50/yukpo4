# 📊 RÉSUMÉ ANALYSE : Pourquoi les index ne sont pas utilisés

## Date : 2025-11-30

---

## 🔍 PROBLÈME IDENTIFIÉ

### Les index EXISTENT et sont VALIDES ✅
- `idx_services_titre_service_fts` : ✅ Existe, valide
- `idx_services_description_fts` : ✅ Existe, valide
- Tous les index sont `is_valid = true`, `is_ready = true`

### Les index SONT utilisés dans les requêtes directes ✅
```
Bitmap Index Scan on idx_services_titre_service_fts
Execution Time: 18-21ms
```

### MAIS la fonction PL/pgSQL est 10-27x plus lente ❌
```
Function Scan on search_services_gps_final
Execution Time: 223-482ms
```

---

## 🔴 CAUSES IDENTIFIÉES

### 1. **DISTINCT ON avec ORDER BY complexe**

La fonction utilise :
```sql
SELECT DISTINCT ON (s.id)
...
ORDER BY s.id, relevance_score DESC
```

**Problème** : `relevance_score` est une expression calculée (`ts_rank`), ce qui :
- Force PostgreSQL à calculer le score pour toutes les lignes
- Nécessite un tri complet
- Empêche l'optimisation par index

### 2. **CTE avec recalculs multiples**

La fonction utilise une CTE qui recalcule `to_tsvector` et `ts_rank` plusieurs fois.

### 3. **Overhead des fonctions PL/pgSQL**

Les fonctions PL/pgSQL ont un overhead :
- Parsing et préparation
- Gestion des variables
- Appels multiples

### 4. **Ordre COALESCE initialement incorrect**

**AVANT** (ne correspondait pas aux index) :
```sql
COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')
```

**APRÈS** (corrigé pour correspondre aux index) :
```sql
COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')
```

---

## ✅ SOLUTIONS APPLIQUÉES

### Solution 1 : Aligner l'ordre COALESCE ✅
- Modifié la fonction pour utiliser le même ordre que les index
- Les index peuvent maintenant être utilisés

### Solution 2 : Simplifier la fonction ✅
- Supprimé `DISTINCT ON` (remplacé par `ORDER BY relevance_score DESC, s.id`)
- Simplifié les CTE
- Préparé `query_tsquery` une seule fois

### Solution 3 : Optimiser ORDER BY ✅
- Changé de `ORDER BY s.id, relevance_score DESC` 
- Vers `ORDER BY relevance_score DESC, s.id`
- Permet une meilleure utilisation des index

---

## 📊 RÉSULTATS ATTENDUS

### Avant optimisation :
- Fonction : 223-482ms
- Requête directe : 18-21ms
- **Ratio : 10-27x plus lent**

### Après optimisation :
- Fonction : **~20-50ms** (objectif)
- Utilisation des index : ✅
- Performance proche de la requête directe

---

## 🎯 CONCLUSION

**Les index ne sont pas utilisés car :**

1. ✅ **L'ordre COALESCE était incorrect** → CORRIGÉ
2. ✅ **DISTINCT ON + ORDER BY complexe** → SIMPLIFIÉ
3. ✅ **CTE avec recalculs** → OPTIMISÉ
4. ⚠️ **Overhead fonction PL/pgSQL** → Inévitable mais minimisé

**La version optimisée devrait utiliser les index et être 5-10x plus rapide.**

---

*Analyse effectuée le : 2025-11-30*

