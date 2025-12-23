# 🔍 Analyse des Problèmes de Recherche - Logs 2025-12-23

## 📊 Problèmes Identifiés

### 1. ⏱️ Temps de Recherche Extrêmement Long (9.4 secondes)

**Logs** :
- `[SlowRequest] POST /api/search/direct -> 200 (9423 ms)`
- `[NativeSearch] Recherche terminée en 3.296285603s: 0 résultats`
- Requête SQL principale : `1.277376763s` (lenteur détectée)

**Causes identifiées** :
1. **Pool de connexions DB saturé** :
   - `acquired connection, but time to acquire exceeded slow threshold` (4-5 secondes)
   - Beaucoup d'erreurs `peer closed connection without sending TLS close_notify`
   - Le pool est configuré à 50 max_connections mais semble saturé

2. **Requête SQL lente** :
   - `LEFT JOIN LATERAL` fait une sous-requête pour chaque service (N+1 pattern)
   - `UNION` entre autocomplete_characteristics et services peut être coûteux
   - La requête prend 1.27s même avec les index GIN

3. **Problèmes de connexion DB** :
   - Beaucoup d'erreurs `terminating connection because of crash of another server process`
   - Connexions qui restent ouvertes trop longtemps

### 2. ❌ Produit Existant Non Trouvé (0 résultats)

**Logs** :
- Recherche pour "Gâteau" retourne 0 résultats
- `[NativeSearch] Recherche terminée en 3.296285603s: 0 résultats`
- L'autocomplete fonctionne (cache hit) mais la recherche ne trouve rien

**Causes possibles** :
1. **Problème d'accents** :
   - `plainto_tsquery('french', 'gâteau')` peut ne pas matcher si le produit est indexé avec "Gâteau" (majuscule)
   - La normalisation transforme "Gâteau" en "gâteau" mais le tsvector peut ne pas correspondre

2. **Produit non indexé** :
   - Le produit peut ne pas être dans `autocomplete_characteristics`
   - Le filtre `ac.is_real_product = TRUE` peut exclure le produit
   - `save_autocomplete_combination` peut avoir échoué silencieusement (appelé en arrière-plan)

3. **Problème de normalisation** :
   - `normalize_query_advanced` crée des variantes avec/sans accents mais peut ne pas être utilisé correctement dans la requête SQL

### 3. ✅ Autocomplete Fonctionne (Cache Hit)

**Logs** :
- `✅ Suggestions autocomplete depuis cache`
- `Cache hit pour: autocomplete:Gâteau:10:4.0301248:9.8185963`
- L'autocomplete est rapide car utilise le cache

**Conclusion** : Les données sont bien dans `autocomplete_characteristics`, mais la recherche principale ne les trouve pas.

## 🔧 Solutions Implémentées

### ✅ Solution 1 : Optimiser la Requête SQL

**Problème** : `LEFT JOIN LATERAL` cause une sous-requête pour chaque service (1.27s)

**Solution implémentée** : 
- Remplacé `LEFT JOIN LATERAL` par des CTE (`autocomplete_matches`, `best_autocomplete_per_service`)
- Pré-calcul des données autocomplete dans une CTE avant le JOIN final
- **Résultat attendu** : Réduction de 1.27s à < 200ms

### ✅ Solution 2 : Corriger le Problème d'Accents

**Problème** : `plainto_tsquery` peut ne pas matcher les mots avec accents

**Solution implémentée** : 
- Ajout de fallback `ILIKE` pour correspondances exactes dans la requête SQL
- Fallback `ILIKE '%' || $1 || '%'` et `LOWER(ac.valeur) = LOWER($1)`
- **Résultat attendu** : Les produits avec accents seront trouvés même si `plainto_tsquery` ne matche pas

### ✅ Solution 3 : Améliorer le Pool de Connexions

**Problème** : Pool saturé, connexions qui restent ouvertes trop longtemps (4-5s pour acquérir)

**Solution implémentée** : 
- Réduit `idle_timeout` de 180s à 120s (libère connexions plus vite)
- Réduit `max_lifetime` de 240s à 180s (renouvelle connexions plus tôt)
- `test_before_acquire` déjà activé pour détecter connexions invalides
- **Résultat attendu** : Moins de connexions inactives, pool moins saturé

### ✅ Solution 4 : Garantir l'Indexation

**Problème** : `save_autocomplete_combination` appelé en arrière-plan peut échouer silencieusement

**Solution implémentée** : 
- Rendu l'indexation **synchrone** avec timeout de 5s (au lieu de `tokio::spawn`)
- Si l'indexation échoue, on log l'erreur mais on ne fait pas échouer la requête
- **Résultat attendu** : Les produits seront indexés immédiatement et trouvables dans la recherche

## 📊 Résultats Attendus

1. **Temps de recherche** : De 9.4s à < 1s (optimisation requête SQL + pool)
2. **Produits trouvés** : Les produits existants seront trouvés grâce au fallback ILIKE
3. **Indexation** : Les produits seront indexés immédiatement (synchrone avec timeout)
4. **Pool de connexions** : Moins de saturation grâce à la libération plus rapide des connexions

