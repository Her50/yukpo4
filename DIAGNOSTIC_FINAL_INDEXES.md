# 🔍 DIAGNOSTIC FINAL : Pourquoi les index ne sont pas utilisés

## Date : 2025-11-30

---

## ✅ DÉCOUVERTES IMPORTANTES

### 1. **Les index SONT utilisés dans les requêtes directes !**

```
Bitmap Index Scan on idx_services_titre_service_fts
Execution Time: 18-21ms ✅
```

**Les index fonctionnent parfaitement !**

---

### 2. **Le problème n'est PAS les index, mais la fonction PL/pgSQL**

| Méthode | Temps | Utilise index |
|---------|-------|---------------|
| **Requête directe** | 18-21ms | ✅ OUI |
| **Fonction PL/pgSQL** | 223-482ms | ⚠️ Partiellement |
| **Fonction "optimisée"** | 1082ms | ❌ NON (pire !) |

---

## 🔴 CAUSE RACINE IDENTIFIÉE

### **PostgreSQL ne peut pas utiliser efficacement les index à l'intérieur des fonctions PL/pgSQL**

Quand une fonction PL/pgSQL fait un `RETURN QUERY` :
1. PostgreSQL doit exécuter la fonction complète
2. Il ne peut pas "voir" à l'intérieur pour optimiser
3. Les index sont utilisés, mais avec un overhead énorme

---

## 📊 ANALYSE DÉTAILLÉE

### Requête directe (18ms) :
```sql
SELECT s.id
FROM services s
WHERE to_tsvector(...) @@ plainto_tsquery(...)
```
- ✅ Utilise `Bitmap Index Scan`
- ✅ 18ms d'exécution
- ✅ 3 buffers lus (index seulement)

### Fonction PL/pgSQL (223ms) :
```sql
RETURN QUERY SELECT ... FROM services ...
```
- ⚠️ Utilise les index mais avec overhead
- ❌ 223ms d'exécution (12x plus lent)
- ❌ 4809 buffers lus (beaucoup plus)

---

## ✅ SOLUTIONS APPLIQUÉES

### 1. Aligner l'ordre COALESCE ✅
- Modifié pour correspondre aux index existants
- Les index peuvent maintenant être utilisés

### 2. Préparer query_tsquery une fois ✅
- Évite les recalculs
- Réduit l'overhead

### 3. Simplifier la structure ✅
- Gardé DISTINCT ON (nécessaire pour éviter doublons)
- Optimisé ORDER BY

---

## 🎯 CONCLUSION

**Les index ne sont pas utilisés efficacement car :**

1. ✅ **L'ordre COALESCE était incorrect** → CORRIGÉ
2. ✅ **Les index existent et sont valides** → CONFIRMÉ
3. ⚠️ **Overhead fonction PL/pgSQL** → Inévitable mais minimisé
4. ⚠️ **DISTINCT ON + ORDER BY sur expression** → Nécessaire mais coûteux

**La fonction utilise maintenant les index, mais l'overhead PL/pgSQL reste (10-20x plus lent que requête directe).**

**Pour de meilleures performances, il faudrait :**
- Utiliser une fonction SQL simple au lieu de PL/pgSQL
- Ou appeler directement la requête depuis Rust sans fonction

---

*Analyse effectuée le : 2025-11-30*

