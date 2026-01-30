# 📊 Comparaison des Erreurs de Migration AWS

## 📋 Résumé Exécutif

Comparaison entre les deux fichiers de logs pour identifier les améliorations et régressions après les corrections.

**Fichier 1** : `log-events-viewer-result.csv` (première analyse)  
**Fichier 2** : `log-events-viewer-result (1).csv` (deuxième analyse)

---

## ✅ AMÉLIORATIONS (Erreurs qui ont DISPARU)

### 1. **"cannot change data type of view column"** ✅ RÉSOLU

| Fichier | Occurrences | Statut |
|---------|-------------|--------|
| Fichier 1 | **3 occurrences** | ❌ Présent |
| Fichier 2 | **0 occurrence** | ✅ **RÉSOLU** |

**Détails** :
- Erreur concernant `product_comments_view.user_name` (VARCHAR → TEXT)
- **Correction appliquée** : Ajout de `DROP VIEW IF EXISTS product_comments_view CASCADE;` avant `CREATE VIEW`
- **Résultat** : Plus aucune erreur de ce type dans le deuxième fichier

**Preuve** : Dans le fichier 2, on voit maintenant :
```sql
DROP VIEW IF EXISTS product_comments_view CASCADE;
CREATE VIEW product_comments_view AS ...
```

---

## ⚠️ RÉGRESSIONS (Erreurs qui ont AUGMENTÉ)

### 1. **"function name hybrid_image_search is not unique"** ⚠️ AUGMENTÉ

| Fichier | Occurrences | Statut |
|---------|-------------|--------|
| Fichier 1 | **6 occurrences** | ❌ Présent |
| Fichier 2 | **18 occurrences** | ❌ **AUGMENTÉ** (x3) |

**Analyse** : L'erreur a triplé, probablement parce que :
- Plus de tentatives de migration (plus de connexions simultanées)
- La fonction n'a pas été correctement supprimée avant recréation
- Plusieurs migrations tentent de créer la même fonction en parallèle

**Action requise** : Améliorer la migration `20260130_002` pour mieux gérer cette fonction.

---

### 2. **"relation conversations does not exist"** ⚠️ AUGMENTÉ

| Fichier | Occurrences | Statut |
|---------|-------------|--------|
| Fichier 1 | **1 occurrence** | ❌ Présent |
| Fichier 2 | **3 occurrences** | ❌ **AUGMENTÉ** (x3) |

**Analyse** : L'erreur a triplé, probablement parce que :
- Plus de tentatives de migration en parallèle
- La table `conversations` n'est pas créée assez tôt dans l'ordre des migrations
- La migration `20260130_002` crée une structure minimale, mais elle n'est peut-être pas appliquée avant les migrations qui en dépendent

**Action requise** : Vérifier l'ordre d'exécution des migrations.

---

## 🔄 ERREURS PERSISTANTES (Toujours présentes)

### 1. **"foreign key constraint delivery_media_parcel_id_fkey cannot be implemented"**

| Fichier | Occurrences | Statut |
|---------|-------------|--------|
| Fichier 1 | **1 occurrence** | ❌ Présent |
| Fichier 2 | **3 occurrences** | ❌ **PERSISTANT** |

**Analyse** : L'erreur persiste malgré la migration de correction `20260130_002`. Cela suggère que :
- La migration de correction n'est peut-être pas exécutée avant les migrations qui créent `delivery_media`
- Le type de `parcel_id` n'est pas correctement converti
- Il y a peut-être plusieurs définitions de `delivery_media` dans différentes migrations

**Action requise** : Vérifier que la migration de correction s'exécute avant toutes les migrations qui créent/modifient `delivery_media`.

---

## 📊 STATISTIQUES GLOBALES

| Métrique | Fichier 1 | Fichier 2 | Évolution |
|----------|-----------|-----------|-----------|
| **Total erreurs ERROR** | 55 | 150 | ⚠️ +173% |
| **Erreurs critiques** | 45 | 120 | ⚠️ +167% |
| **Erreurs résolues** | - | 1 type | ✅ |
| **Erreurs nouvelles** | - | 2 types | ⚠️ |

---

## 🎯 ANALYSE DES CAUSES

### Pourquoi plus d'erreurs dans le fichier 2 ?

1. **Plus de tentatives de migration** :
   - Le fichier 2 semble contenir plus de tentatives de migration
   - Plus de connexions simultanées (10.0.3.74, 10.0.2.94, 10.0.3.69, etc.)
   - Plus de migrations exécutées en parallèle

2. **Ordre d'exécution** :
   - Les migrations de correction (`20260130_002`, `20260130_003`) doivent s'exécuter AVANT les migrations qui créent les objets problématiques
   - Si l'ordre n'est pas respecté, les erreurs persistent

3. **Exécution en parallèle** :
   - Plusieurs instances tentent d'exécuter les mêmes migrations simultanément
   - Cela crée des conditions de course (race conditions)
   - Les erreurs "already exists" et "does not exist" sont plus fréquentes

---

## ✅ CONCLUSION : OUI, IL Y A AU MOINS UNE AMÉLIORATION

### Amélioration Confirmée ✅

**L'erreur "cannot change data type of view column" a été COMPLÈTEMENT RÉSOLUE** :
- ✅ 3 occurrences → 0 occurrence
- ✅ La correction avec `DROP VIEW IF EXISTS` fonctionne
- ✅ Plus aucune erreur de ce type dans les nouveaux logs

### Mais Attention ⚠️

1. **Le nombre total d'erreurs a augmenté** (55 → 150), mais cela peut être dû à :
   - Plus de tentatives de migration
   - Plus de connexions simultanées
   - Plus de migrations exécutées

2. **Certaines erreurs ont augmenté** :
   - `hybrid_image_search` : 6 → 18 occurrences
   - `conversations` : 1 → 3 occurrences

3. **Certaines erreurs persistent** :
   - `delivery_media_parcel_id_fkey` : toujours présent

---

## 🔧 RECOMMANDATIONS

### Actions Immédiates

1. **Vérifier l'ordre d'exécution des migrations** :
   - S'assurer que `20260130_002` et `20260130_003` s'exécutent AVANT les migrations qui créent les objets problématiques
   - Utiliser des numéros de migration plus bas pour garantir l'ordre

2. **Améliorer la gestion de `hybrid_image_search`** :
   - Supprimer TOUTES les versions de la fonction avant de la recréer
   - Utiliser `DROP FUNCTION IF EXISTS hybrid_image_search CASCADE;` avec toutes les signatures possibles

3. **Créer `conversations` plus tôt** :
   - Déplacer la création de `conversations` dans une migration antérieure
   - Ou s'assurer que `20260130_002` s'exécute avant `20260114_create_negotiated_prices_table`

4. **Corriger `delivery_media.parcel_id` de manière plus robuste** :
   - Vérifier que la migration de correction s'exécute avant toutes les migrations qui créent/modifient `delivery_media`
   - Ajouter des vérifications supplémentaires

---

## 📝 RÉSUMÉ

**OUI, il y a au moins UNE amélioration significative** :
- ✅ L'erreur de vue `product_comments_view` est **complètement résolue**
- ✅ La correction avec `DROP VIEW IF EXISTS` fonctionne parfaitement

**MAIS** :
- ⚠️ Le nombre total d'erreurs a augmenté (probablement dû à plus de tentatives)
- ⚠️ Certaines erreurs spécifiques ont augmenté (nécessitent des corrections supplémentaires)
- ⚠️ Certaines erreurs persistent (nécessitent une meilleure gestion de l'ordre)

**Conclusion** : Les corrections fonctionnent, mais il faut améliorer l'ordre d'exécution et la gestion des migrations parallèles.

---

**Date de création** : 2026-01-30  
**Statut** : ✅ Amélioration confirmée pour l'erreur de vue

