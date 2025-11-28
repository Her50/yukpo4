# Analyse des Logs Backend - Problèmes Identifiés

**Date d'analyse**: 2025-11-28  
**Fichier analysé**: `logbackend1.md`

## 📊 Résumé Exécutif

L'analyse des logs révèle plusieurs problèmes critiques affectant les performances et la stabilité du backend :

1. **Recherches très lentes** : ~10 secondes par requête (11697ms)
2. **Requêtes SQL complexes et non optimisées** : Plusieurs requêtes dépassent 2-3 secondes
3. **Problèmes de connexion à la base de données** : Timeouts et connexions fermées
4. **Médias dans les résultats de recherche** : Les images/vidéos apparaissent dans les recherches texte
5. **Aucun log de création de vidéo** : Pas de traces d'erreurs de génération vidéo dans les logs analysés

---

## 🔍 1. PROBLÈMES DE PERFORMANCE - RECHERCHES LENTES

### 1.1 Temps de réponse excessifs

**Problème identifié** :
- Recherche "Plombier" : **11697 ms** (11.7 secondes)
- Recherche native : **9.995 secondes**
- Temps total de requête : **11699 ms**

**Logs pertinents** :
```
[Monitoring] POST /api/search/direct -> 200 (11697 ms)
[NativeSearch] Recherche terminée en 9.995438849s: 1 résultats
```

### 1.2 Causes identifiées

#### A. Requêtes SQL extrêmement complexes

**Requête principale** (ligne 231) : **2.85 secondes**
- Requête avec multiples sous-requêtes corrélées
- Calculs de scoring complexes avec `ts_rank`, `unaccent`, `ILIKE`
- Parcours de table `autocomplete_characteristics` pour chaque service
- Multiple `jsonb_array_elements` sur les produits

**Problèmes spécifiques** :
1. **Sous-requêtes corrélées multiples** :
   ```sql
   SELECT COALESCE(SUM(...)) FROM jsonb_array_elements(...) AS product
   ```
   - Exécutée pour CHAQUE service dans la base
   - Pas d'index sur les champs JSONB parcourus

2. **Calculs de scoring redondants** :
   - `ts_rank` avec `to_tsvector` sur plusieurs champs
   - `unaccent` appliqué plusieurs fois sur les mêmes données
   - `ILIKE '%' || word || '%'` sur de nombreux champs

3. **Recherche dans `autocomplete_characteristics`** :
   ```sql
   EXISTS (
       SELECT 1 FROM autocomplete_characteristics ac
       WHERE ac.service_id = s.id
       AND EXISTS (
           SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
           WHERE vec_val ILIKE '%' || $1 || '%'
       )
   )
   ```
   - Pas d'index sur `characteristic_vector`
   - `unnest` + `ILIKE` très coûteux

#### B. Requête de publicités lente (ligne 225) : **1.12 secondes**
```sql
SELECT id, produits_indexes, zone_geographique, 
       ST_X(geo_publicitaire::geometry) as pub_lng,
       ST_Y(geo_publicitaire::geometry) as pub_lat,
       rayon_km
FROM publicites
WHERE status = 'active' AND date_fin > NOW()
```
- Pas d'index sur `status` et `date_fin`
- Calculs géométriques (`ST_X`, `ST_Y`) sur toutes les lignes

#### C. Problèmes d'acquisition de connexion DB

**Logs** :
```
acquired connection, but time to acquire exceeded slow threshold
aquired_after_secs: 2.2441306819999998
aquired_after_secs: 2.192436223
aquired_after_secs: 2.402502626
```

**Causes** :
- Pool de connexions saturé
- Connexions longues non libérées
- Connexions qui crash (voir section 2)

---

## 🚨 2. ERREURS ET WARNINGS - BASE DE DONNÉES

### 2.1 Connexions PostgreSQL qui crash

**Problème récurrent** :
```
terminating connection because of crash of another server process
```

**Fréquence** : Apparaît **plusieurs dizaines de fois** dans les logs

**Causes possibles** :
1. **Requêtes trop longues** qui font timeout
2. **Mémoire insuffisante** sur le serveur PostgreSQL
3. **Deadlocks** ou **locks** prolongés
4. **Connexions orphelines** non fermées correctement

**Impact** :
- Perte de connexions du pool
- Retries automatiques (visible dans les logs)
- Dégradation des performances

### 2.2 Erreurs de connexion TLS

```
error communicating with database: peer closed connection without sending TLS close_notify
```

**Tentatives de retry** :
```
[DB Retry] Tentative 1/3 échouée (erreur récupérable): ...
```

---

## 🖼️ 3. MÉDIAS DANS LES RÉSULTATS DE RECHERCHE

### 3.1 Problème identifié

Les recherches texte retournent des **médias (images/vidéos)** alors qu'elles ne devraient retourner que des **services/produits**.

### 3.2 Analyse du code

D'après le code source (`image_search_service.rs`), il existe un service de recherche par image qui :
- Retourne des `ImageSearchResult` avec `media_id`, `media_path`, `service_data`
- Joint la table `media` avec `services`

### 3.3 Causes possibles

1. **Filtrage insuffisant dans les requêtes de recherche texte** :
   - Les requêtes de recherche texte ne filtrent peut-être pas les résultats qui sont uniquement des médias
   - La table `media` pourrait être jointe par erreur dans les recherches texte

2. **Logique de recherche mixte** :
   - Le système pourrait mélanger recherche texte et recherche image
   - Les résultats de recherche image pourraient être inclus dans les résultats de recherche texte

3. **Données dans `service_data`** :
   - Les services retournés contiennent peut-être des références aux médias dans leur `data` JSON
   - Ces médias sont peut-être affichés comme résultats au lieu d'être des métadonnées

### 3.4 Logs pertinents

Dans les résultats de recherche, on voit :
```json
{
  "service_id": 5,
  "data": {
    // ... données du service ...
  }
}
```

**Pas de médias directs dans les résultats**, mais ils pourraient être dans `data->produits->images` ou similaires.

---

## 🎬 4. PROBLÈMES DE CRÉATION DE VIDÉO

### 4.1 Aucun log de création de vidéo trouvé

**Observation** : Aucun log d'erreur ou de problème lié à la création de vidéo dans les logs analysés.

**Recherches effectuées** :
- `video.*creation`
- `creation.*video`
- `video.*generate`
- `generate.*video`
- `remotion`
- `worker`

**Résultat** : Seulement des logs de `DeliveryMatchingWorker` (non lié aux vidéos)

### 4.2 Hypothèses

1. **Pas de tentatives de création de vidéo** pendant la période des logs
2. **Logs de vidéo dans un autre fichier** ou système de logging
3. **Erreurs silencieuses** non loggées
4. **Worker de vidéo non démarré** ou désactivé

### 4.3 Recommandations

- Vérifier les logs du worker Remotion séparément
- Vérifier les logs d'erreur du système de génération vidéo
- Activer le logging détaillé pour la création de vidéo

---

## ⚠️ 5. AUTRES PROBLÈMES IDENTIFIÉS

### 5.1 LiveKit non disponible

```
❌ Serveur: Connexion refusée - Le serveur LiveKit n'est probablement pas démarré
```

**Impact** : Synchronisation analytics désactivée (service optionnel)

### 5.2 Requêtes de recherche sans filtre GPS

```
⚠️ AUCUN lieu détecté → Recherche dans TOUTE la base de données
```

**Impact** : Recherches beaucoup plus lentes car elles parcourent toute la base

### 5.3 Requêtes avec multiples variantes de mots

Les requêtes génèrent des variantes avec accents :
- `plombier`
- `ploôömbiîïeéèêër`
- `plooombiiieeeeer`
- `plom%`

**Impact** : Multiplie le nombre de conditions `ILIKE` dans les requêtes

---

## 🔧 6. RECOMMANDATIONS PRIORITAIRES

### 6.1 Optimisation des requêtes SQL (URGENT)

1. **Créer des index** :
   ```sql
   -- Index sur les champs JSONB fréquemment recherchés
   CREATE INDEX idx_services_data_titre_service ON services 
     USING gin ((data->'titre_service'->>'valeur') gin_trgm_ops);
   
   CREATE INDEX idx_services_data_category ON services 
     USING gin ((data->'category'->>'valeur') gin_trgm_ops);
   
   -- Index sur autocomplete_characteristics
   CREATE INDEX idx_ac_service_id ON autocomplete_characteristics(service_id);
   CREATE INDEX idx_ac_characteristic_vector ON autocomplete_characteristics 
     USING gin(characteristic_vector);
   
   -- Index sur publicites
   CREATE INDEX idx_publicites_status_date ON publicites(status, date_fin);
   ```

2. **Simplifier les requêtes de scoring** :
   - Pré-calculer certains scores dans des colonnes dérivées
   - Utiliser des vues matérialisées pour les scores fréquents
   - Limiter le nombre de sous-requêtes corrélées

3. **Optimiser les recherches JSONB** :
   - Extraire les champs fréquents dans des colonnes dédiées
   - Utiliser des index GIN sur les champs JSONB

### 6.2 Gestion du pool de connexions

1. **Augmenter la taille du pool** si possible
2. **Réduire le temps de vie des connexions**
3. **Implémenter un healthcheck** pour détecter les connexions mortes
4. **Ajouter des timeouts** plus stricts

### 6.3 Filtrage des médias dans les recherches

1. **Vérifier la logique de recherche** :
   - S'assurer que les recherches texte ne retournent QUE des services
   - Filtrer explicitement les résultats qui sont uniquement des médias

2. **Séparer les endpoints** :
   - `/api/search/direct` : Recherche texte → services uniquement
   - `/api/search/image` : Recherche image → médias + services

3. **Nettoyer les données retournées** :
   - Ne pas inclure les chemins de médias dans les résultats de recherche texte
   - Inclure uniquement les IDs de médias si nécessaire

### 6.4 Monitoring et logging

1. **Ajouter des métriques** :
   - Temps de réponse par type de requête
   - Nombre de connexions DB actives
   - Taux d'erreur par endpoint

2. **Améliorer le logging** :
   - Logger les requêtes SQL lentes avec EXPLAIN ANALYZE
   - Logger les tentatives de création de vidéo
   - Logger les erreurs de connexion DB avec plus de détails

### 6.5 Optimisation des recherches sans GPS

1. **Limiter les résultats** par défaut (déjà fait : LIMIT 100)
2. **Ajouter une pagination** obligatoire
3. **Suggérer un filtre GPS** à l'utilisateur
4. **Mettre en cache** les résultats de recherche fréquents

---

## 📈 7. MÉTRIQUES DE PERFORMANCE

### Temps de réponse observés

| Endpoint | Temps moyen | Temps max | Fréquence |
|----------|-------------|-----------|-----------|
| `/api/search/direct` | ~10s | 11.7s | Élevée |
| Requête SQL principale | ~2.5s | 2.85s | Élevée |
| Requête publicités | ~1.1s | 1.12s | Moyenne |
| Acquisition connexion DB | ~2.3s | 2.4s | Élevée |

### Taux d'erreur

- **Connexions DB qui crash** : ~30+ occurrences dans les logs
- **Timeouts de connexion** : ~3 occurrences
- **Erreurs TLS** : ~1 occurrence avec retry

---

## 🎯 8. PLAN D'ACTION PRIORITAIRE

### Phase 1 - Urgent (Cette semaine)
1. ✅ Créer les index manquants sur les tables critiques
2. ✅ Optimiser la requête SQL principale de recherche
3. ✅ Augmenter/configurer le pool de connexions DB
4. ✅ Ajouter des timeouts stricts

### Phase 2 - Important (Semaine prochaine)
1. ✅ Simplifier les calculs de scoring
2. ✅ Implémenter le filtrage des médias dans les recherches
3. ✅ Améliorer le logging des erreurs DB
4. ✅ Ajouter des métriques de performance

### Phase 3 - Amélioration (Mois prochain)
1. ✅ Mise en cache des résultats de recherche
2. ✅ Pagination obligatoire
3. ✅ Vues matérialisées pour les scores
4. ✅ Monitoring avancé

---

## 📝 NOTES FINALES

- Les logs analysés couvrent une période limitée
- Certains problèmes peuvent être intermittents
- Des tests de charge seraient nécessaires pour confirmer les optimisations
- La base de données Render peut avoir des limitations de performance

**Prochaine étape recommandée** : Analyser les requêtes SQL avec `EXPLAIN ANALYZE` pour identifier les goulots d'étranglement précis.

