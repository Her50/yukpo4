# 📋 GUIDE D'IMPLÉMENTATION : Gestion des variations et corrections

## Date : 2025-11-30

---

## ✅ DÉJÀ FAIT

1. ✅ Fonction `expand_search_query_with_variations()` créée (ligne ~1998)
2. ✅ Migration SQL créée : `20251130_002_IMPROVE_SEARCH_VARIATIONS_TRIGRAM.sql`
3. ✅ Code Rust modifié dans `intelligent_search_internal()` pour utiliser la requête enrichie

---

## ⏳ À FAIRE : MODIFICATIONS RESTANTES

### 1. Modifier `fulltext_search_with_gps()` - Utiliser requête enrichie

**Fichier** : `backend/src/services/native_search_service.rs`

**Ligne ~950** : Avant l'appel à `search_services_gps_final()`
```rust
// ✅ AJOUTER AVANT :
let expanded_query = self.expand_search_query_with_variations(query);

// ✅ UTILISER expanded_query au lieu de query dans .bind()
```

**Ligne ~1232** : Dans la requête SQL directe (pas search_services_gps_final)
```rust
// Remplacer toutes les occurrences de :
plainto_tsquery('french', $1)

// Par :
plainto_tsquery('french', expanded_query_param)
```

### 2. Ajouter recherche trigram dans la requête SQL principale

**Fichier** : `backend/src/services/native_search_service.rs`

**Ligne ~1276-1285** : Dans le calcul du score, ajouter :
```sql
-- ✅ AJOUTER après les lignes existantes :
+ CASE 
+     WHEN similarity(LOWER(pe.data->'category'->>'valeur'), LOWER($1)) > 0.7 THEN 
+         similarity(LOWER(pe.data->'category'->>'valeur'), LOWER($1)) * 9.0
+     ELSE 0.0
+ END +
+ CASE 
+     WHEN similarity(LOWER(pe.data->'titre_service'->>'valeur'), LOWER($1)) > 0.6 THEN 
+         similarity(LOWER(pe.data->'titre_service'->>'valeur'), LOWER($1)) * 8.0
+     ELSE 0.0
+ END +
```

**Ligne ~1180-1200** : Dans la clause WHERE, ajouter :
```sql
-- ✅ AJOUTER après les conditions existantes :
OR similarity(LOWER(COALESCE(pe.data->'category'->>'valeur', pe.category, '')), LOWER($1)) > 0.7
OR similarity(LOWER(COALESCE(pe.data->'titre_service'->>'valeur', '')), LOWER($1)) > 0.6
```

### 3. Modifier `trigram_search_with_gps()` et `keyword_search_with_gps()`

**Fichier** : `backend/src/services/native_search_service.rs`

**Même principe** : Utiliser la requête enrichie avant d'appeler `search_services_gps_final()`

---

## 🔧 CORRECTIONS SUPPLÉMENTAIRES

### 1. Gérer la casse

**Statut** : ✅ DÉJÀ FAIT
- Utilise `LOWER()` et `ILIKE` partout

### 2. Gérer les troncatures

**Statut** : ✅ DÉJÀ FAIT
- Utilise `ILIKE '%...%'` partout

**À améliorer** : Utiliser `word_similarity()` pour troncatures partielles :
```sql
word_similarity($1, LOWER(category)) > 0.5
```

### 3. Gérer les erreurs de saisie

**Statut** : ⚠️ Partiellement fait (trigram en fallback seulement)

**À faire** : Intégrer trigram dans la requête principale (voir migration SQL créée)

### 4. Optimiser l'ordre des conditions

**Actuel** : Full-text → Trigram → Keyword

**Recommandation** : Combiner les trois dans une seule requête avec des poids différents

---

## 📝 CHECKLIST FINALE

- [ ] Migration SQL appliquée
- [ ] Code Rust modifié pour utiliser requête enrichie dans `fulltext_search_with_gps()`
- [ ] Code Rust modifié pour utiliser requête enrichie dans `trigram_search_with_gps()`
- [ ] Code Rust modifié pour utiliser requête enrichie dans `keyword_search_with_gps()`
- [ ] Recherche trigram intégrée dans la requête SQL principale
- [ ] Test avec "plombier" / "plomberie"
- [ ] Test avec "électricien" / "électricité"
- [ ] Vérifier les performances

---

*Guide créé le : 2025-11-30*

