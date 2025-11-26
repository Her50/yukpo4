# Analyse approfondie du problème de recherche de produits

## Date: 2025-11-26

## Problèmes identifiés dans les logs

### 1. ❌ PROBLÈME CRITIQUE : Extraction incorrecte des mots-clés

**Symptôme observé dans les logs :**
```
[INFO] [RECHERCHE_DIRECTE] Mots-clés extraits: ["résolution,retouches,en", "portrait,studio,1", "heure,impression", "incluse,haute", "photographie"]
```

**Cause :**
La fonction `extract_keywords_from_text` utilise `split_whitespace()` qui ne traite pas les virgules comme séparateurs. Quand l'utilisateur entre :
```
"Photographie de portrait,Studio,1 heure,Impression incluse,Haute résolution,Retouches,En ligne"
```

Les virgules ne sont pas reconnues comme séparateurs, donc on obtient des "mots" comme `"portrait,Studio,1"` au lieu de `["portrait", "Studio", "1"]`.

**Impact :**
- Les recherches échouent car les mots-clés sont malformés
- Le mot-clé principal devient `"résolution,retouches,en"` au lieu de `"photographie"` ou `"portrait"`
- Les requêtes SQL ne trouvent pas de résultats car elles cherchent des chaînes complètes avec virgules

**Solution :**
Modifier `extract_keywords_from_text` pour :
1. Remplacer les virgules par des espaces avant le split
2. Gérer les séparateurs multiples (virgules, points-virgules, etc.)
3. Nettoyer les caractères spéciaux correctement

---

### 2. ❌ PROBLÈME CRITIQUE : Signature de fonction PostgreSQL incompatible

**Symptôme observé dans les logs :**
```
[ERREUR] [NativeSearch] Erreur recherche GPS optimisée: error returned from database: structure of query does not match function result type
```

**Cause :**
La fonction `search_services_gps_final` dans `auto_migrate.rs` retourne :
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

Mais le code Rust dans `native_search_service.rs` ligne 816 attend exactement ces colonnes. Le problème vient probablement d'une version différente de la fonction dans la base de données.

**Impact :**
- Toutes les recherches avec GPS échouent
- Le système bascule vers le fallback SQL qui est beaucoup plus lent
- Les utilisateurs ne trouvent pas de résultats

**Solution :**
1. Vérifier la signature exacte de la fonction dans la base de données
2. Aligner la définition dans `auto_migrate.rs` avec ce que le code Rust attend
3. Créer une migration pour forcer la mise à jour de la fonction

---

### 3. ⚠️ PROBLÈME MAJEUR : Connexions PostgreSQL qui se ferment inattendument

**Symptôme observé dans les logs :**
```
error communicating with database: peer closed connection without sending TLS close_notify
terminating connection because of crash of another server process
```

**Causes possibles :**
1. **Timeout de connexion** : Les requêtes SQL sont très lentes (2-3 secondes), ce qui peut causer des timeouts
2. **Pool de connexions saturé** : Trop de connexions simultanées
3. **Problème réseau** : Connexion instable avec la base de données Render
4. **Requêtes bloquantes** : Les requêtes SQL complexes bloquent d'autres connexions

**Impact :**
- Les recherches échouent de manière intermittente
- Le système doit réessayer plusieurs fois
- Expérience utilisateur dégradée (temps de réponse très long)

**Solution :**
1. Augmenter les timeouts de connexion
2. Optimiser les requêtes SQL pour réduire leur durée
3. Implémenter un système de retry avec backoff exponentiel
4. Surveiller le pool de connexions

---

### 4. ⚠️ PROBLÈME MAJEUR : Requêtes SQL très lentes

**Symptôme observé dans les logs :**
```
slow statement: execution time exceeded alert threshold
elapsed: "2.416939156s"
elapsed: "2.50309161s"
elapsed: "3.150156697s"
```

**Cause :**
La requête SQL de recherche full-text est extrêmement complexe avec :
- Multiples sous-requêtes imbriquées
- Calculs de score complexes
- Recherches dans des arrays JSONB
- Jointures avec `autocomplete_characteristics`
- Calculs de distance GPS

**Impact :**
- Temps de réponse très long (2-4 secondes)
- Surcharge de la base de données
- Risque de timeout
- Expérience utilisateur dégradée

**Solution :**
1. Créer des index sur les colonnes fréquemment recherchées
2. Utiliser des vues matérialisées pour les scores pré-calculés
3. Limiter le nombre de sous-requêtes
4. Utiliser `EXPLAIN ANALYZE` pour identifier les goulots d'étranglement

---

### 5. ⚠️ PROBLÈME : Recherches qui retournent 0 résultats alors qu'il devrait y en avoir

**Symptôme observé dans les logs :**
```
[AutocompleteSearchService] ✅ 0 résultats trouvés
[INFO] [RECHERCHE_DIRECTE] Fallback SQL réussi avec 0 résultats
```

**Causes possibles :**
1. Mots-clés malformés (problème #1)
2. Requêtes SQL trop restrictives
3. Problème avec les filtres de produits actifs
4. Index manquants

**Solution :**
1. Corriger l'extraction des mots-clés (problème #1)
2. Ajouter des logs détaillés pour comprendre pourquoi aucune correspondance
3. Vérifier que les produits sont bien marqués comme actifs dans `products_lifecycle`

---

## Plan d'action prioritaire

### Priorité 1 (CRITIQUE - à corriger immédiatement)
1. ✅ Corriger `extract_keywords_from_text` pour gérer les virgules
2. ✅ Vérifier et corriger la signature de `search_services_gps_final`

### Priorité 2 (MAJEUR - à corriger rapidement)
3. ⏳ Optimiser les requêtes SQL lentes
4. ⏳ Améliorer la gestion des connexions PostgreSQL

### Priorité 3 (IMPORTANT - à améliorer)
5. ⏳ Ajouter des index sur les colonnes de recherche
6. ⏳ Implémenter un système de cache pour les recherches fréquentes
7. ⏳ Améliorer les logs pour le debugging

---

## Détails techniques

### Fonction extract_keywords_from_text actuelle
```rust
let words: Vec<&str> = clean_text
    .split_whitespace()  // ❌ Ne gère pas les virgules
    .filter(|word| { ... })
    .collect();
```

### Fonction extract_keywords_from_text corrigée
```rust
let words: Vec<&str> = clean_text
    .replace(',', ' ')  // ✅ Remplacer virgules par espaces
    .replace(';', ' ')  // ✅ Remplacer point-virgules aussi
    .split_whitespace()
    .filter(|word| { ... })
    .collect();
```

### Signature attendue de search_services_gps_final
Le code Rust attend :
- `service_id: integer`
- `titre_service: text`
- `category: text`
- `gps_coords: text`
- `distance_km: double precision`
- `relevance_score: double precision`
- `gps_source: text`

La fonction dans `auto_migrate.rs` retourne exactement cela, donc le problème vient probablement d'une version différente dans la base de données.

---

## Métriques à surveiller

1. **Temps de réponse moyen des recherches** : Actuellement 2-4s, objectif < 500ms
2. **Taux d'échec des recherches** : Actuellement élevé, objectif < 1%
3. **Nombre de connexions PostgreSQL actives** : Surveiller pour éviter la saturation
4. **Taux de cache hit** : Pour les recherches fréquentes

---

## Notes supplémentaires

- Les logs montrent que l'autocomplete trouve parfois des résultats (1 résultat pour "Photographe") mais la recherche directe échoue
- Le fallback SQL fonctionne mais est très lent
- Il y a des problèmes de connexion récurrents qui suggèrent un problème de pool ou de timeout

