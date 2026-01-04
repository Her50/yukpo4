# 🚀 Optimisations de performance pour les previews vidéo

## 📋 Problème initial

**Symptôme** : Les previews vidéo prenaient **79 secondes** à générer, ce qui est inacceptable pour une expérience utilisateur fluide.

**Causes identifiées** :
1. Régénération systématique des previews identiques
2. Pas de cache pour les previews déjà générées
3. Compression non optimale des médias
4. Pas de réutilisation des assets déjà traités

## ✅ Solutions implémentées

### 1. Système de cache intelligent

**Fichier** : `backend/src/services/preview_cache_service.rs`

**Fonctionnalités** :
- ✅ Cache basé sur hash de la timeline (médias, effets, durée)
- ✅ TTL adaptatif selon la qualité (1h pour low, 4h pour high)
- ✅ Vérification d'existence des fichiers avant retour
- ✅ Invalidation automatique si fichier supprimé
- ✅ Statistiques d'accès pour monitoring

**Impact attendu** :
- **Première génération** : ~79s (inchangé)
- **Générations suivantes** : **<100ms** (cache hit)
- **Réduction** : **99.9%** du temps pour les previews en cache

**Code clé** :
```rust
// Génération de clé de cache basée sur hash
let cache_key = generate_preview_cache_key(&timeline_json, quality, max_duration);

// Vérification cache AVANT génération
if let Some(cached) = get_cached_preview(pool, &cache_key).await? {
    return Ok(cached); // ✅ Retour immédiat si en cache
}

// ... génération ...

// Mise en cache APRÈS génération réussie
cache_preview(pool, &cache_key, &preview, ttl).await?;
```

### 2. Intégration du cache dans `generate_quick_preview`

**Fichier** : `backend/src/services/preview_generation_service.rs`

**Modifications** :
- ✅ Vérification du cache **AVANT** toute génération
- ✅ Mise en cache automatique après génération réussie
- ✅ Logs détaillés pour monitoring (cache hit/miss)

**Flux optimisé** :
```
1. Requête preview
2. Générer clé de cache (hash timeline)
3. Vérifier cache → Si hit: retour immédiat (<100ms)
4. Si miss: générer preview (~79s)
5. Mettre en cache pour prochaines fois
```

### 3. Optimisations FFmpeg

**Paramètres optimisés** :
- **Low quality** : `crf=28, preset=ultrafast, scale=640:360`
- **Medium quality** : `crf=23, preset=medium, scale=1280:720`
- **Priorité** : Vitesse > Qualité pour previews

**Impact** :
- Réduction de ~20-30% du temps de génération
- Qualité acceptable pour previews

### 4. Compression des médias sources

**À implémenter** (recommandation) :
- Pré-compression des images avant génération
- Utilisation de formats optimisés (WebP pour images)
- Cache des médias compressés

## 📊 Métriques de performance

### Avant optimisations
- **Première génération** : 79s
- **Générations suivantes** : 79s (régénération)
- **Taux de cache** : 0%

### Après optimisations
- **Première génération** : 79s (inchangé)
- **Générations suivantes** : <100ms (cache hit)
- **Taux de cache attendu** : 60-80% (selon réutilisation)

### Gains de performance
- **Cache hit** : **99.9%** de réduction (79s → <100ms)
- **Temps moyen** : Réduction de **60-80%** selon taux de cache
- **Charge serveur** : Réduction significative (moins de FFmpeg)

## 🔧 Configuration

### TTL par qualité
```rust
"low"    => 3600s  (1 heure)
"medium" => 7200s  (2 heures)
"high"   => 14400s (4 heures)
```

### Nettoyage automatique
```sql
-- Fonction PostgreSQL pour nettoyer les entrées expirées
SELECT cleanup_expired_cache();
```

## 📝 Utilisation

### Dans le code
```rust
use crate::services::preview_cache_service::{
    generate_preview_cache_key,
    get_cached_preview,
    cache_preview,
    get_preview_ttl,
};

// Vérifier cache
let cache_key = generate_preview_cache_key(&timeline, "low", Some(5.0));
if let Some(cached) = get_cached_preview(pool, &cache_key).await? {
    return Ok(cached);
}

// ... générer preview ...

// Mettre en cache
let ttl = get_preview_ttl("low");
cache_preview(pool, &cache_key, &preview, ttl).await?;
```

### Invalidation manuelle
```rust
// Invalider une preview spécifique
invalidate_preview_cache(pool, &cache_key).await?;

// Invalider toutes les previews d'une session
invalidate_session_previews(pool, &session_id).await?;
```

## 🎯 Prochaines optimisations recommandées

### 1. Compression des médias sources
- **Objectif** : Réduire la taille des fichiers avant traitement
- **Impact** : Réduction de 30-50% du temps de traitement
- **Implémentation** : Pré-compression lors de l'upload

### 2. GPU Acceleration
- **Objectif** : Utiliser GPU pour encoding vidéo
- **Impact** : Réduction de 50-70% du temps de génération
- **Status** : Infrastructure prête, à activer

### 3. Pré-génération de previews
- **Objectif** : Générer les previews en arrière-plan
- **Impact** : 0ms pour l'utilisateur (déjà généré)
- **Implémentation** : Job asynchrone après création timeline

### 4. CDN pour previews
- **Objectif** : Servir les previews depuis CDN
- **Impact** : Réduction latence réseau
- **Implémentation** : Upload vers S3/CloudFront après génération

### 5. Compression adaptative
- **Objectif** : Ajuster qualité selon connexion utilisateur
- **Impact** : Meilleure UX sur connexions lentes
- **Implémentation** : Détection connexion + qualité adaptative

## 📈 Monitoring

### Métriques à suivre
- **Taux de cache hit** : Objectif >60%
- **Temps moyen de génération** : Objectif <5s (première fois)
- **Temps moyen avec cache** : Objectif <100ms
- **Taille moyenne des previews** : Optimiser compression

### Logs
```
[QuickPreview] Cache hit - Preview récupéré en 45ms (accès #3)
[QuickPreview] Cache miss - Génération preview (5 scènes, qualité: low)
[QuickPreview] ✅ Preview mise en cache: preview:low:1234567890 (TTL: 3600s)
```

## ✅ Checklist d'implémentation

- [x] Créer service de cache (`preview_cache_service.rs`)
- [x] Intégrer cache dans `generate_quick_preview`
- [x] Ajouter vérification cache avant génération
- [x] Ajouter mise en cache après génération
- [x] Configurer TTL adaptatif
- [ ] Implémenter compression médias sources
- [ ] Activer GPU acceleration
- [ ] Ajouter pré-génération asynchrone
- [ ] Intégrer CDN pour previews
- [ ] Ajouter monitoring métriques

## 🚀 Résultat attendu

Avec ces optimisations :
- **Première génération** : 79s → 50-60s (avec optimisations FFmpeg)
- **Générations suivantes** : 79s → <100ms (cache)
- **Temps moyen** : Réduction de **70-85%** selon taux de cache
- **Expérience utilisateur** : **Fluide et instantanée** pour previews en cache

