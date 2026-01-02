# 🔍 Analyse des Problèmes Backend - 2025-12-12

## 📊 Problèmes Identifiés

### 1. ⚠️ **CRITIQUE** : Requête SQL très lente (1-2 secondes)
**Fichier** : `backend/src/services/native_search_service.rs` (ligne ~1453)
**Requête** : `WITH all_products_extracted AS` avec multiples CTEs
**Impact** : Timeouts API, expérience utilisateur dégradée

**Causes** :
- Requête SQL très complexe avec 4 CTEs imbriqués
- Multiples calculs de scores (fulltext, trigram, word_similarity)
- Recherche dans `autocomplete_characteristics.full_vector` avec `unnest()`
- Conditions OR multiples avec `ILIKE '%' || $1 || '%'` (pas d'index utilisable)

**Solutions proposées** :
1. ✅ Ajouter des index sur `autocomplete_characteristics.full_vector` (GIN)
2. ✅ Limiter le nombre de résultats dans les CTEs intermédiaires
3. ✅ Utiliser `LIMIT` plus tôt dans la requête
4. ✅ Optimiser les conditions `word_similarity()` avec index trigram

---

### 2. ⚠️ **CRITIQUE** : Problèmes de connexion DB
**Fichier** : `backend/src/main.rs` (lignes 108-254)
**Symptômes** :
- `terminating connection because of crash of another server process`
- `acquired connection, but time to acquire exceeded slow threshold` (2+ secondes)
- `error communicating with database: peer closed connection without sending TLS close_notify`

**Causes** :
- Render PostgreSQL ferme les connexions idle après ~5 minutes
- Pool de connexions trop grand (50 max) → surcharge PostgreSQL
- `max_lifetime` à 240s mais Render ferme à ~5 min → décalage
- Connexions mortes non détectées assez tôt

**Solutions proposées** :
1. ✅ Réduire `max_lifetime` à 4 minutes (240s) - **DÉJÀ FAIT**
2. ✅ Activer `test_before_acquire(true)` - **DÉJÀ FAIT**
3. ✅ Réduire `idle_timeout` à 3 minutes (180s) pour détecter tôt les connexions mortes
4. ✅ Réduire `DB_POOL_SIZE` à 30 (au lieu de 50) pour éviter surcharge
5. ✅ Ajouter retry logic avec backoff exponentiel

---

### 3. ⚠️ **IMPORTANT** : Timeouts API (30 secondes)
**Fichier** : `backend/src/routers/router_yukpo.rs` (ligne ~711)
**Endpoint** : `/api/search/direct`
**Symptôme** : Timeout côté client après 30 secondes

**Causes** :
- Pas de timeout explicite sur `handle_direct_search`
- Requête SQL lente (1-2s) + traitement IA (si image) → peut dépasser 30s
- Pas de timeout sur `rechercher_besoin_direct()`

**Solutions proposées** :
1. ✅ Ajouter timeout de 25 secondes sur `handle_direct_search` (avant timeout client 30s)
2. ✅ Ajouter timeout de 20 secondes sur la requête SQL principale
3. ✅ Retourner réponse partielle si timeout atteint (avec résultats déjà obtenus)

---

### 4. ⚠️ **MOYEN** : Erreurs SQL (syntax error, invalid JSON)
**Symptômes** :
- `syntax error at or near "WITH"` dans `ProductVideoController`
- `invalid input syntax for type json` dans `list_user_specialized_services`

**Causes** :
- Requêtes SQL malformées
- Données JSON invalides dans la base

**Solutions proposées** :
1. ✅ Vérifier les requêtes SQL dans `ProductVideoController`
2. ✅ Valider les données JSON avant insertion
3. ✅ Ajouter try-catch avec messages d'erreur clairs

---

## 🎯 Plan d'Action Prioritaire

### Phase 1 : Corrections Immédiates (Impact Élevé)
1. ✅ Ajouter timeout sur `handle_direct_search` (25s)
2. ✅ Réduire `idle_timeout` à 180s (3 min)
3. ✅ Réduire `DB_POOL_SIZE` à 30 (au lieu de 50)
4. ✅ Ajouter timeout sur requête SQL principale (20s)

### Phase 2 : Optimisations SQL (Impact Moyen)
1. ✅ Ajouter index GIN sur `autocomplete_characteristics.full_vector`
2. ✅ Limiter résultats dans CTEs intermédiaires (LIMIT 1000)
3. ✅ Optimiser conditions `word_similarity()` avec index trigram

### Phase 3 : Améliorations Long Terme (Impact Faible)
1. ✅ Monitoring des requêtes lentes (déjà activé)
2. ✅ Cache multi-niveaux (déjà implémenté)
3. ✅ Read replica pour scaling horizontal (déjà configuré)

---

## 📈 Métriques Attendues

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Temps requête SQL | 1-2s | 0.5-1s | **50%** |
| Timeouts API | 30s | 25s (géré) | **100%** (plus de timeouts) |
| Connexions DB mortes | Fréquentes | Rares | **80%** |
| Erreurs TLS | Fréquentes | Rares | **90%** |

---

## 🔧 Fichiers à Modifier

1. `backend/src/routers/router_yukpo.rs` - Ajouter timeout sur `handle_direct_search`
2. `backend/src/main.rs` - Ajuster `idle_timeout` et `DB_POOL_SIZE`
3. `backend/src/services/native_search_service.rs` - Optimiser requête SQL
4. `backend/migrations/` - Ajouter index GIN sur `full_vector`

---

## ✅ Validation

Après corrections, vérifier :
- [ ] Plus de timeouts API 30s
- [ ] Temps requête SQL < 1s (p95)
- [ ] Plus d'erreurs "terminating connection"
- [ ] Pool de connexions stable (< 30 connexions actives)









