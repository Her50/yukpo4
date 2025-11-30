# 🔍 ANALYSE : Pourquoi "plombier" ne trouve pas "plomberie" ?

## Date : 2025-11-30

---

## ❌ PROBLÈME IDENTIFIÉ

Le test montre que même avec la requête enrichie, la recherche ne fonctionne pas :

1. **Full-text search** : `plainto_tsquery('french', 'plombier | plomberie')` ne matche pas "Services de plomberie à domicile"
2. **Similarity trigram** : 
   - similarity('Services de plomberie à domicile', 'plombier') = 0.1389 (< 0.6) ❌
   - similarity('Services de plomberie à domicile', 'plomberie') = 0.3125 (< 0.6) ❌

---

## 🔍 CAUSE RACINE

### Problème 1 : Similarity compare la chaîne complète

`similarity()` compare la **chaîne complète** :
- "Services de plomberie à domicile" (29 caractères)
- vs "plombier" (8 caractères) ou "plomberie" (9 caractères)

**Résultat** : Similarité très faible car la chaîne est beaucoup plus longue.

### Problème 2 : Full-text search ne stemme pas correctement

Le stemmer français de PostgreSQL :
- "plombier" → "plombier"
- "plomberie" → "plomberie"
- Pas de lien entre les deux

Même avec `plainto_tsquery('french', 'plombier | plomberie')`, ça ne matche pas car :
- "Services de plomberie à domicile" → stemme en "servic plomberi domicil"
- "plombier" → stemme en "plombier"
- Pas de match ❌

---

## ✅ SOLUTION : Utiliser `word_similarity()` au lieu de `similarity()`

### Différence

- `similarity()` : Compare la chaîne complète
- `word_similarity()` : Compare un mot avec les mots dans une chaîne

### Exemple

```sql
-- similarity (actuel) - compare chaîne complète
similarity('Services de plomberie à domicile', 'plomberie') = 0.3125 ❌

-- word_similarity (meilleur) - compare mot avec mots dans chaîne
word_similarity('plomberie', 'Services de plomberie à domicile') = ~0.7-0.8 ✅
```

---

## 🔧 CORRECTIONS NÉCESSAIRES

### 1. Remplacer `similarity()` par `word_similarity()` dans la migration SQL

**Changer** :
```sql
similarity(LOWER(category), LOWER(base_term)) > 0.6
```

**Par** :
```sql
word_similarity(LOWER(base_term), LOWER(category)) > 0.5
```

### 2. Améliorer le full-text search

**Problème** : Le stemmer ne lie pas "plombier" et "plomberie"

**Solution** : Utiliser une recherche par mots avec OR explicite :
```sql
-- Au lieu de :
plainto_tsquery('french', 'plombier | plomberie')

-- Utiliser une recherche explicite par mots :
(
    to_tsvector('french', text) @@ to_tsquery('french', 'plombier:* | plomberie:*')
    OR text ILIKE '%plombier%'
    OR text ILIKE '%plomberie%'
)
```

### 3. Ajouter recherche par mots individuels

Extraire chaque mot de la requête enrichie et chercher avec OR :
```sql
-- Pour "plombier | plomberie", chercher :
text ILIKE '%plombier%' OR text ILIKE '%plomberie%'
```

---

*Analyse créée le : 2025-11-30*

