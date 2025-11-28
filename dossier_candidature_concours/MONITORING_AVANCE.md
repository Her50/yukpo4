# Système de Monitoring Avancé - Backend Yukpomnang

**Date**: 2025-11-28  
**Status**: ✅ Implémenté

## 📊 Composants Créés

### 1. Service QueryMonitor

**Fichier**: `backend/src/services/query_monitor.rs`

**Fonctionnalités**:
- ✅ Détection automatique des requêtes lentes (>1s par défaut)
- ✅ Collecte de métriques par requête (count, avg, min, max, slow_count)
- ✅ Logging des requêtes très lentes (>3s) avec suggestion EXPLAIN ANALYZE
- ✅ Statistiques globales de performance
- ✅ Hash des requêtes pour identification stable

**Utilisation**:
```rust
use crate::services::query_monitor::{QueryMonitor, QueryTimer};

let monitor = Arc::new(QueryMonitor::new(pool.clone()));

// Mesurer une requête
let _timer = QueryTimer::new(
    monitor.clone(),
    "SELECT * FROM services WHERE...".to_string(),
    Some("/api/search/direct".to_string()),
);
// La requête est automatiquement enregistrée à la fin du scope
```

### 2. Middleware de Monitoring Amélioré

**Fichier**: `backend/src/middlewares/monitoring.rs`

**Améliorations**:
- ✅ Détection des requêtes lentes (>1s) avec log WARN
- ✅ Détection des requêtes très lentes (>5s) avec log ERROR
- ✅ Logging détaillé avec méthode, path, status, durée

**Seuils configurés**:
- Normal: <1s (INFO)
- Lent: ≥1s (WARN)
- Très lent: ≥5s (ERROR)

### 3. Contrôleur de Performance

**Fichier**: `backend/src/controllers/performance_controller.rs`

**Endpoints prévus** (à intégrer dans les routes):
- `GET /api/performance/stats` : Statistiques globales
- `GET /api/performance/slow-queries` : Requêtes les plus lentes

## 🔧 Configuration

### Variables d'environnement

```bash
# Seuil pour requêtes lentes (en millisecondes)
DB_SLOW_QUERY_THRESHOLD=1000  # 1 seconde par défaut
```

### Intégration dans AppState (À faire)

Pour utiliser le QueryMonitor dans toute l'application, ajouter dans `AppState`:

```rust
pub struct AppState {
    // ... existing fields ...
    pub query_monitor: Arc<QueryMonitor>,
}
```

## 📈 Métriques Collectées

### Par Requête
- `execution_count`: Nombre d'exécutions
- `total_duration_ms`: Temps total cumulé
- `avg_duration_ms`: Temps moyen
- `min_duration_ms`: Temps minimum
- `max_duration_ms`: Temps maximum
- `slow_count`: Nombre de fois où la requête a été lente
- `last_executed`: Dernière exécution

### Globales
- `total_queries`: Total de requêtes exécutées
- `slow_queries`: Nombre de requêtes lentes
- `avg_query_time_ms`: Temps moyen de toutes les requêtes
- `slowest_query`: Requête la plus lente

## 🚀 Prochaines Étapes

1. ✅ **Intégrer QueryMonitor dans AppState**
2. ✅ **Ajouter routes de performance dans router**
3. ✅ **Intégrer QueryTimer dans les services critiques**
4. ⏳ **Créer dashboard de monitoring (optionnel)**
5. ⏳ **Exporter métriques vers Prometheus (optionnel)**

## 📝 Notes

- Le QueryMonitor utilise un `RwLock` pour la thread-safety
- Les métriques sont stockées en mémoire (pas de persistance)
- Le `QueryTimer` utilise `Drop` pour enregistrer automatiquement
- Les requêtes sont hashées pour éviter les doublons

## 🔍 Exemple de Logs

```
[Monitoring] POST /api/search/direct -> 200 (11697 ms)
🐌 [SlowRequest] POST /api/search/direct -> 200 (11697 ms) - Requête lente détectée
🐌 [SlowQuery] 2852ms - SELECT DISTINCT s.id, s.data... (endpoint: Some("/api/search/direct"))
⚠️ [QueryMonitor] Requête très lente détectée (>3s). Considérez analyser avec EXPLAIN ANALYZE
```

