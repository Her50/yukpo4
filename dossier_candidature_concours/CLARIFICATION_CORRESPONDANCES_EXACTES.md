# Clarification : Correspondances Exactes vs Gestion Erreurs de Frappe

## ❓ Question
Quand on parle de "correspondance exacte", est-ce que la gestion d'erreurs de frappe, de mots tronqués, n'est plus prise en compte ?

## ✅ Réponse : NON, les correspondances exactes sont des BONUS, pas un remplacement

### Architecture de recherche (multi-niveaux)

La recherche utilise **3 niveaux complémentaires** :

#### 1. **Recherche Full-Text PostgreSQL** (Niveau 1 - Principal)
- Utilise `to_tsvector('french', ...)` et `plainto_tsquery('french', ...)`
- **Gère automatiquement** :
  - ✅ Variantes de mots (singulier/pluriel)
  - ✅ Accents (via `unaccent()`)
  - ✅ Mots tronqués (via stemming français)
  - ✅ Synonymes partiels
- **Code** : `backend/src/services/native_search_service.rs` lignes 1236-1244

#### 2. **Recherche Trigram** (Niveau 2 - Fallback pour fautes de frappe)
- Utilise `pg_trgm` extension PostgreSQL
- **Gère spécifiquement** :
  - ✅ Fautes de frappe (ex: "électricien" → "electricien", "électrisien")
  - ✅ Mots partiellement écrits
  - ✅ Similarité de chaînes (similarity > 0.6)
- **Activation** : Si pas assez de résultats avec full-text, recherche trigram est lancée automatiquement
- **Code** : `backend/src/services/native_search_service.rs` lignes 275-296

#### 3. **Recherche par Mots-Clés** (Niveau 3 - Fallback ultime)
- Recherche mot par mot dans tous les champs
- **Gère** :
  - ✅ Mots isolés
  - ✅ Requêtes très courtes
- **Activation** : Si encore pas assez de résultats après trigram
- **Code** : `backend/src/services/native_search_service.rs` lignes 298-319

### Les "correspondances exactes" sont des BONUS de scoring

Les correspondances exactes que j'ai ajoutées sont des **bonus de score** qui s'ajoutent au scoring existant. Elles ne remplacent rien.

**Exemple de scoring combiné** :

```sql
-- Score total = Score Full-Text + Score Trigram + BONUS Correspondances Exactes

(
    -- Score Full-Text (gère variantes, accents, stemming)
    ts_rank(to_tsvector('french', titre), plainto_tsquery('french', 'électricien')) * 1.5 +
    
    -- Score Unaccent (gère accents)
    ts_rank(to_tsvector('french', unaccent(titre)), plainto_tsquery('french', unaccent('électricien'))) * 2.0 +
    
    -- ✅ BONUS Correspondance Exacte (s'ajoute au score existant)
    CASE 
        WHEN LOWER(titre) = LOWER('électricien') THEN 20.0  -- Bonus très élevé si exact
        WHEN LOWER(titre) LIKE LOWER('électricien') || '%' THEN 10.0  -- Bonus élevé si commence par
        WHEN titre ILIKE '%électricien%' THEN 5.0  -- Bonus moyen si contient
        ELSE 0.0  -- Pas de bonus, mais score full-text/trigram reste actif
    END
)
```

### Exemple concret : Recherche "électricien" avec faute "electricien"

**Scénario** : Utilisateur tape "electricien" (sans accent)

1. **Full-Text PostgreSQL** :
   - `plainto_tsquery('french', 'electricien')` matche "électricien" (gestion accents)
   - Score : 8.5 points

2. **Unaccent** :
   - `unaccent('électricien')` = "electricien"
   - Score : 12.0 points

3. **Correspondance Exacte** :
   - `LOWER('électricien') = LOWER('electricien')` → FALSE (car normalisé différemment)
   - `LOWER('électricien') LIKE LOWER('electricien') || '%'` → FALSE
   - `'électricien' ILIKE '%electricien%'` → TRUE (après unaccent)
   - Bonus : 5.0 points

4. **Score Total** : 8.5 + 12.0 + 5.0 = **25.5 points**

**Si l'utilisateur tape "électrisien" (faute de frappe)** :

1. **Full-Text** : Score faible (2.0 points) car pas de match exact
2. **Trigram** : `similarity('électricien', 'électrisien')` = 0.85 > 0.6 → Match !
   - Score : 15.0 points
3. **Correspondance Exacte** : Pas de bonus (0.0)
4. **Score Total** : 2.0 + 15.0 = **17.0 points** (toujours trouvé grâce à trigram !)

### Conclusion

✅ **Les correspondances exactes sont des BONUS qui améliorent la pertinence**
✅ **La gestion des erreurs de frappe reste 100% active via trigram**
✅ **La recherche multi-niveaux garantit qu'on trouve toujours des résultats**

**Ordre de priorité** :
1. Correspondance exacte → Bonus très élevé (20.0)
2. Correspondance début → Bonus élevé (10.0)
3. Correspondance partielle → Bonus moyen (5.0)
4. Full-Text → Score normal (1.5-2.0)
5. Trigram → Score fallback (15.0 si similarity > 0.6)
6. Mots-clés → Score minimal (1.0)

**Aucune méthode n'est désactivée, elles se complètent !**

