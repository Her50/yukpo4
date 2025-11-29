# Analyse des Problèmes de Recherche - 29 Novembre 2025

## 🔴 Problèmes Critiques Identifiés

### 1. **Erreur de Structure de Requête avec `search_services_gps_final`**

**Erreur observée :**
```
[NativeSearch] ⚠️ Erreur structure requête GPS - Fallback vers recherche sans GPS. 
Erreur: error returned from database: structure of query does not match function result type
```

**Cause :**
- Le code Rust attend 7 colonnes : `service_id`, `titre_service`, `category`, `gps_coords`, `distance_km`, `relevance_score`, `gps_source`
- La fonction PostgreSQL `search_services_gps_final` retourne probablement une structure différente
- Cette erreur force un fallback vers une recherche non optimisée, plus lente

**Impact :**
- Recherches GPS échouent systématiquement
- Fallback vers recherche fulltext lente (4+ secondes)
- 0 résultats pour "avensis" malgré des requêtes complexes

**Solution :**
Vérifier et corriger la définition de la fonction PostgreSQL pour correspondre exactement à :
```sql
RETURNS TABLE(
    service_id integer,
    titre_service text,
    category text,
    gps_coords text,
    distance_km double precision,
    relevance_score double precision,
    gps_source text
)
```

---

### 2. **Requêtes SQL Extrêmement Lentes**

**Temps d'exécution observés :**
- Requête fulltext "avensis" : **4.2 secondes** (seuil: 1s)
- Requête fulltext "glace" : **2.2 secondes** puis **4.3 secondes**
- Requête trigram : **588ms**
- Requête keyword : **1.8 secondes**

**Causes probables :**
1. **Requêtes SQL trop complexes** avec multiples CTE (Common Table Expressions)
2. **Manque d'index** sur les colonnes JSONB recherchées
3. **Recherche dans TOUTE la base** au lieu d'utiliser le filtrage GPS
4. **Fonction `unaccent()` appelée plusieurs fois** sans index GIN

**Impact :**
- Temps de réponse utilisateur : **20-22 secondes** pour une recherche
- Expérience utilisateur dégradée
- Risque de timeout

**Solutions :**
1. Créer des index GIN sur les colonnes JSONB fréquemment recherchées
2. Optimiser les requêtes CTE pour éviter les recalculs
3. Utiliser des index trigram pour les recherches de similarité
4. Implémenter un cache Redis fonctionnel (actuellement indisponible)

---

### 3. **Connexions Base de Données qui se Terminent**

**Erreurs observées :**
```
terminating connection because of crash of another server process
ping on idle connection returned error: peer closed connection without sending TLS close_notify
```

**Causes probables :**
1. **Requêtes trop longues** qui font crasher le processus PostgreSQL
2. **Pool de connexions saturé** (10 connexions actives)
3. **Timeout de connexion** dépassé
4. **Problème de mémoire** sur le serveur Render

**Impact :**
- Connexions perdues pendant les requêtes
- Retry automatique nécessaire (délai supplémentaire)
- Risque de perte de données

**Solutions :**
1. Réduire la complexité des requêtes SQL
2. Augmenter le timeout des connexions
3. Implémenter un circuit breaker pour éviter la saturation
4. Monitorer l'utilisation mémoire du serveur

---

### 4. **Redis Indisponible**

**Erreurs observées :**
```
[CacheService] Redis indisponible pour set search:fulltext:...
Connexion Redis échouée: failed to lookup address information: Name or service not known
```

**Impact :**
- **Aucun cache** des résultats de recherche
- Chaque recherche exécute des requêtes SQL complètes
- Performance dégradée

**Solutions :**
1. Vérifier la configuration Redis sur Render
2. Implémenter un fallback vers un cache en mémoire (HashMap)
3. Utiliser le cache PostgreSQL si Redis n'est pas disponible

---

### 5. **Erreur SQLite sur Mobile : Cache Plein**

**Erreurs observées :**
```
[CacheManager] Erreur écriture cache cache_autocomplete_toyota: 
database or disk is full (code 13 SQLITE_FULL)
```

**Impact :**
- Cache mobile ne fonctionne plus
- Requêtes répétées inutiles
- Performance mobile dégradée

**Solutions :**
1. Implémenter une politique de nettoyage du cache SQLite
2. Limiter la taille du cache mobile
3. Utiliser AsyncStorage au lieu de SQLite pour le cache simple

---

### 6. **Recherches Retournent 0 Résultats**

**Observations :**
- Recherche "avensis" : 0 résultats après 20 secondes
- Recherche "glace" : 1 résultat après 10 secondes (fallback SQL simple)
- Recherche "Toyota Avensis 2002" : 0 résultats

**Causes probables :**
1. **Filtres trop restrictifs** dans les requêtes SQL
2. **Problème de normalisation** des termes de recherche
3. **Données manquantes** dans les colonnes JSONB
4. **Erreur dans la logique de scoring** qui exclut tous les résultats

**Solutions :**
1. Vérifier que les données existent dans la base
2. Simplifier les conditions WHERE pour être moins restrictives
3. Ajouter des logs détaillés pour comprendre pourquoi aucun résultat n'est retourné
4. Tester avec des requêtes SQL directes pour valider les données

---

## 📊 Résumé des Performances

| Métrique | Valeur Observée | Seuil Acceptable | Statut |
|----------|----------------|------------------|--------|
| Temps recherche "avensis" | 20.9s | < 2s | 🔴 Critique |
| Temps recherche "glace" | 10.5s | < 2s | 🔴 Critique |
| Requête SQL fulltext | 4.2s | < 1s | 🔴 Critique |
| Requête SQL trigram | 588ms | < 500ms | 🟡 Acceptable |
| Résultats "avensis" | 0 | > 0 | 🔴 Critique |
| Résultats "glace" | 1 | > 0 | 🟡 Acceptable |

---

## 🎯 Actions Prioritaires

### Priorité 1 (Critique - À corriger immédiatement)
1. ✅ **Corriger la fonction `search_services_gps_final`** pour correspondre à la structure attendue par Rust
2. ✅ **Optimiser les requêtes SQL fulltext** (réduire de 4s à < 1s)
3. ✅ **Créer des index manquants** sur les colonnes JSONB

### Priorité 2 (Important - À corriger cette semaine)
4. ✅ **Rétablir Redis** ou implémenter un cache alternatif
5. ✅ **Corriger les connexions DB qui se terminent** (timeout, pool)
6. ✅ **Nettoyer le cache SQLite mobile** (politique de nettoyage)

### Priorité 3 (Amélioration - À planifier)
7. ✅ **Améliorer la détection de lieux** dans les recherches
8. ✅ **Optimiser le scoring** pour retourner plus de résultats pertinents
9. ✅ **Implémenter un circuit breaker** pour éviter la saturation

---

## 🔍 Prochaines Étapes de Diagnostic

1. **Vérifier la définition actuelle de `search_services_gps_final`** dans PostgreSQL
2. **Exécuter EXPLAIN ANALYZE** sur les requêtes lentes pour identifier les goulots d'étranglement
3. **Vérifier les index existants** sur les tables `services` et `autocomplete_characteristics`
4. **Tester des requêtes SQL directes** pour valider que les données existent
5. **Monitorer l'utilisation mémoire** du serveur Render pendant les recherches

---

## 📝 Notes Techniques

- **Base de données** : PostgreSQL sur Render (pgvector, imgsmlr)
- **Backend** : Rust avec Axum, SQLx
- **Cache** : Redis (indisponible) + SQLite mobile (plein)
- **Pool de connexions** : 10 connexions max
- **Timeout requêtes** : Non spécifié (probablement 30s par défaut)

