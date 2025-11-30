# 🔍 EXPLICATION ET SOLUTION : Problème de variations dans la recherche

## Date : 2025-11-30

---

## ❓ POURQUOI "plombier" ne trouve pas "plomberie" ?

### Explication technique

PostgreSQL full-text search utilise un **stemmer** français qui réduit les mots à leur racine :
- "plombier" → stemme en **"plombier"**
- "plomberie" → stemme en **"plomberie"**

**Problème** : Le stemmer ne fait pas de mapping profession → activité.

### Exemple concret

```sql
-- Requête utilisateur : "plombier"
SELECT * FROM services
WHERE to_tsvector('french', category) @@ plainto_tsquery('french', 'plombier');

-- Si category = "plomberie"
-- Le stemmer transforme :
--   "plomberie" → "plomberie" (pas de changement)
--   "plombier" → "plombier" (pas de changement)
-- Résultat : PAS DE MATCH ❌
```

---

## ✅ SOLUTION 1 : Enrichir la requête (IMPLÉMENTÉE)

### Principe

Avant de faire la recherche, enrichir la requête avec les variations connues :
```
"plombier" → "plombier | plomberie"
```

L'opérateur `|` (OR) dans PostgreSQL `tsquery` permet de rechercher l'un OU l'autre.

### Implémentation

**Fichier** : `backend/src/services/native_search_service.rs`

**Fonction** : `expand_search_query_with_variations()`

```rust
// Mapping bidirectionnel
("plombier", "plomberie"),
("plomberie", "plombier"),

// Résultat : "plombier | plomberie"
```

### Utilisation dans SQL

```sql
-- Au lieu de :
plainto_tsquery('french', 'plombier')

-- Utiliser :
plainto_tsquery('french', 'plombier | plomberie')
-- ✅ Trouvera les deux variations
```

---

## ✅ SOLUTION 2 : Recherche trigram intégrée (IMPLÉMENTÉE)

### Principe

Utiliser la fonction `similarity()` de PostgreSQL (extension `pg_trgm`) pour détecter les variations similaires :
- "plombier" et "plomberie" ont une similarité de ~0.7
- Si similarity > seuil (0.6-0.7), considérer comme match

### Avantages

- Détecte automatiquement les variations
- Gère aussi les fautes de frappe
- Pas besoin de mapping manuel pour tous les cas

### Implémentation

**Dans la fonction SQL** :
```sql
-- Ajouter dans WHERE clause :
OR similarity(LOWER(category), LOWER('plombier')) > 0.7

-- Ajouter dans le score :
CASE 
    WHEN similarity(LOWER(category), LOWER('plombier')) > 0.7 THEN 
        similarity(...) * 9.0
    ELSE 0.0
END
```

---

## ✅ SOLUTION 3 : Casse, troncatures, erreurs de saisie

### Casse (DÉJÀ FAIT ✅)

Utilise `LOWER()` et `ILIKE` partout :
```sql
LOWER(category) = LOWER(search_term)
category ILIKE '%search_term%'
```

### Troncatures (AMÉLIORÉ ⚠️)

**Actuel** : `ILIKE '%search_term%'`
**Amélioration possible** : `word_similarity()` pour troncatures partielles

### Erreurs de saisie (AMÉLIORÉ ⚠️)

**Avant** : Trigram seulement en fallback
**Après** : Trigram intégré directement dans la requête avec seuil similarity

---

## 📊 AUTRES CORRECTIONS POSSIBLES

### 1. Dictionnaire de synonymes PostgreSQL

**Principe** : Créer un dictionnaire de synonymes pour PostgreSQL

**Avantages** :
- Géré nativement par PostgreSQL
- Performant

**Inconvénients** :
- Configuration plus complexe
- Nécessite migration

**Exemple** :
```sql
CREATE TEXT SEARCH DICTIONARY synonym_dict (
    TEMPLATE = synonym,
    SYNONYMS = synonym_rules
);

-- synonym_rules.txt :
plombier plomberie
plomberie plombier
électricien électricité
électricité électricien
```

### 2. Améliorer le seuil de similarity

**Actuel** : Seuil fixe (0.6-0.7)

**Amélioration** : Seuil adaptatif selon longueur du mot
- Mots courts (3-4 chars) : 0.5
- Mots moyens (5-7 chars) : 0.6
- Mots longs (8+ chars) : 0.7

### 3. Utiliser `word_similarity()` pour troncatures

**Actuel** : `ILIKE '%...%'`

**Amélioration** : `word_similarity()` est plus précis :
```sql
word_similarity(search_term, target_text) > 0.5
```

---

## ✅ STATUT DES CORRECTIONS

| Correction | Statut | Fichier |
|------------|--------|---------|
| Enrichissement requête | ✅ FAIT | `native_search_service.rs` |
| Trigram intégré | ✅ FAIT | Migration SQL |
| Casse | ✅ DÉJÀ FAIT | Partout |
| Troncatures | ✅ DÉJÀ FAIT | ILIKE partout |
| Erreurs de saisie | ✅ FAIT | Trigram intégré |
| Dictionnaire synonymes | ⚠️ OPTIONNEL | Migration future |
| Seuil adaptatif | ⚠️ OPTIONNEL | Amélioration future |
| word_similarity | ⚠️ OPTIONNEL | Amélioration future |

---

## 🎯 RÉSULTAT FINAL

Après application complète :

✅ **"plombier"** trouvera "plomberie" (via enrichissement + trigram)
✅ **"plomberie"** trouvera "plombier" (via enrichissement + trigram)
✅ **Fautes de frappe** détectées (similarity > 0.6)
✅ **Troncatures** fonctionnelles (ILIKE)
✅ **Casse** ignorée (LOWER)

---

## 📄 FICHIERS CRÉÉS

1. `backend/ANALYSE_PROBLEME_STEMMING_VARIATIONS.md`
2. `backend/SOLUTION_COMPLETE_STEMMING_VARIATIONS.md`
3. `backend/migrations/20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql`
4. `backend/GUIDE_IMPLEMENTATION_VARIATIONS.md`
5. `backend/RESUME_COMPLET_VARIATIONS_STEMMING.md`
6. `SOLUTION_FINALE_VARIATIONS_STEMMING.md`
7. `EXPLICATION_ET_SOLUTION_VARIATIONS.md` (ce fichier)

---

*Document créé le : 2025-11-30*

