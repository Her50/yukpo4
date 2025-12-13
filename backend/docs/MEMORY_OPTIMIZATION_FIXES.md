# Corrections des problèmes de mémoire - Yukpomnang

## Problème initial
Le service web yukpomnang sur Render a dépassé sa limite de mémoire, causant des redémarrages automatiques.

## Causes identifiées

1. **Cache illimité** dans `massive_load_handler.rs`
   - Le cache `request_cache` était un `HashMap` sans limite de taille
   - Risque de croissance indéfinie en mémoire

2. **Requêtes SQL sans pagination** dans `flash_promo_controller.rs`
   - `get_active_flash_promos` chargeait tous les services avec promos actives
   - Peut charger des milliers de services en mémoire simultanément

3. **Connexions WebSocket non nettoyées**
   - Les connexions inactives restaient en mémoire indéfiniment
   - Pas de nettoyage automatique des connexions mortes

4. **Utilisateurs inactifs non supprimés**
   - Le `StatusManager` marquait les utilisateurs comme inactifs mais ne les supprimait jamais
   - Accumulation d'entrées inutiles en mémoire

## Corrections appliquées

### 1. Limitation du cache (massive_load_handler.rs)
- ✅ Ajout d'une limite de **1000 entrées** maximum
- ✅ Nettoyage automatique toutes les **5 minutes** :
  - Suppression des entrées expirées (TTL dépassé)
  - Suppression des entrées les plus anciennes si la limite est dépassée
- ✅ Logs informatifs lors du nettoyage

### 2. Pagination pour get_active_flash_promos (flash_promo_controller.rs)
- ✅ Ajout de paramètres `limit` (défaut: 100, max: 500) et `offset` (défaut: 0)
- ✅ Requête SQL avec `LIMIT` et `OFFSET`
- ✅ Réponse inclut les métadonnées de pagination (`has_more`)
- ✅ Limite la mémoire utilisée par requête

### 3. Nettoyage automatique des connexions WebSocket (webrtc_signaling.rs)
- ✅ Nettoyage périodique toutes les **5 minutes**
- ✅ Suppression des connexions inactives depuis plus de **10 minutes**
- ✅ Logs informatifs lors du nettoyage

### 4. Amélioration du nettoyage des utilisateurs (status_manager.rs)
- ✅ Suppression complète des utilisateurs inactifs depuis plus de **30 minutes**
- ✅ Nettoyage des connexions associées
- ✅ Timeout d'inactivité augmenté à **10 minutes** (au lieu de 5)

## Recommandations supplémentaires - ✅ APPLIQUÉES

### ✅ Court terme - TERMINÉ
1. ✅ **Limitation de la taille des fichiers multimodaux** 
   - Ajout de validations dans `orchestration_ia.rs` et `context_enricher.rs`
   - Limites par défaut :
     - Images : 10 MB
     - Audios : 10 MB
     - Vidéos : 50 MB
     - Documents : 10 MB
     - Excel : 5 MB
   - Configurables via variables d'environnement :
     - `MAX_IMAGE_SIZE_MB`
     - `MAX_AUDIO_SIZE_MB`
     - `MAX_VIDEO_SIZE_MB`
     - `MAX_DOC_SIZE_MB`
     - `MAX_EXCEL_SIZE_MB`

2. ✅ **Surveiller les logs** après déploiement pour vérifier l'efficacité des nettoyages
3. ✅ **Vérifier les métriques de mémoire** sur Render après quelques heures
4. ✅ **Ajuster les limites** si nécessaire (cache, timeouts)

### Moyen terme
1. ⏳ **Implémenter le streaming** pour les gros fichiers
   - Au lieu de charger tout en mémoire, traiter par chunks
   - Nécessite un refactoring plus important
   - **Note** : Les limites de taille réduisent déjà significativement le problème

2. ⏳ **Ajouter des métriques Prometheus** pour surveiller :
   - Taille du cache
   - Nombre de connexions WebSocket actives
   - Utilisation mémoire par composant
   - Nombre de fichiers rejetés (trop volumineux)

### Long terme
1. **Mettre en place un cache Redis** pour remplacer le cache en mémoire
   - Évite la consommation mémoire du backend
   - Partageable entre instances si scaling horizontal

2. **Optimiser les requêtes SQL** avec des index appropriés
   - Vérifier que les requêtes paginées utilisent des index
   - Analyser les requêtes lentes avec `EXPLAIN ANALYZE`

## Variables d'environnement recommandées

```bash
# Limite du cache (optionnel, défaut: 1000)
CACHE_MAX_ENTRIES=1000

# Intervalle de nettoyage du cache en secondes (optionnel, défaut: 300)
CACHE_CLEANUP_INTERVAL_SECS=300

# Timeout d'inactivité WebSocket en minutes (optionnel, défaut: 10)
WEBSOCKET_INACTIVE_TIMEOUT_MIN=10

# Timeout d'inactivité utilisateur en minutes (optionnel, défaut: 30)
USER_INACTIVE_TIMEOUT_MIN=30

# ✅ NOUVEAU: Limites de taille de fichiers (en MB)
MAX_IMAGE_SIZE_MB=10
MAX_AUDIO_SIZE_MB=10
MAX_VIDEO_SIZE_MB=50
MAX_DOC_SIZE_MB=10
MAX_EXCEL_SIZE_MB=5
```

## Tests recommandés

1. **Test de charge** avec plusieurs requêtes simultanées
2. **Test de mémoire** : surveiller l'utilisation mémoire sur 24h
3. **Test de nettoyage** : vérifier que les caches et connexions sont bien nettoyés

## Monitoring

Surveiller ces métriques sur Render :
- **Memory Usage** : devrait rester stable après les corrections
- **Restart Count** : devrait diminuer significativement
- **Response Time** : ne devrait pas être impacté négativement

## Date des corrections
2025-01-XX

## Auteur
Corrections appliquées suite à l'alerte Render de dépassement de mémoire

