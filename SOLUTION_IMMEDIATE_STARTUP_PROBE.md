# 🚀 Solution Immédiate - Startup Probe Cloud Run

**Date**: 2026-02-16  
**Problème**: Startup probe échoue même avec timeout de 330 secondes  
**Cause probable**: Le serveur HTTP ne démarre pas assez vite

---

## 🔍 Diagnostic Requis

**AVANT d'appliquer cette solution**, consultez les logs Cloud Run pour identifier la cause exacte :

**URL des logs** :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name=yukpo-backend-00060-6wn
```

**Rechercher** :
- Dernière ligne de log avant l'échec
- Messages `[MAIN] ✅ Serveur lance` (indique que le serveur démarre)
- Erreurs PostgreSQL, migrations, panic, etc.

**Voir** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md` pour guide complet d'analyse.

---

## ✅ Solution 1: Utiliser connect_lazy() pour PostgreSQL (RECOMMANDÉ)

**Problème** : La connexion PostgreSQL avec `connect()` est bloquante et peut prendre 30+ secondes.

**Solution** : Utiliser `connect_lazy()` pour Cloud Run, qui crée le pool sans attendre la connexion.

**Fichier**: `backend/src/main.rs`

**Modification** (lignes ~290-420) :

```rust
// Détecter si on est sur Cloud Run
let is_cloud_run = env::var("CLOUD_RUN").unwrap_or_default() == "true";

let pg_pool = if is_cloud_run {
    // ✅ Cloud Run: Connexion non-bloquante (démarrage rapide)
    eprintln!("[MAIN] 🚀 Cloud Run: Utilisation connect_lazy() pour démarrage rapide");
    log::info!("🚀 Cloud Run: Utilisation connect_lazy() pour démarrage rapide");
    
    PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(0) // Pas de connexions pré-établies
        .acquire_timeout(std::time::Duration::from_secs(30))
        .idle_timeout(Some(std::time::Duration::from_secs(300)))
        .max_lifetime(Some(std::time::Duration::from_secs(600)))
        .test_before_acquire(true)
        .connect_lazy(&db_url)?
} else {
    // ✅ Autres environnements: Connexion bloquante avec retry (comportement actuel)
    // ... code existant avec connect() et retry ...
};
```

**Avantages** :
- ✅ Le serveur HTTP démarre immédiatement
- ✅ Les connexions DB sont établies à la demande (lazy)
- ✅ Le health check `/health` répond immédiatement
- ✅ Les requêtes API établiront la connexion DB au besoin

**⚠️ Risque** : Si la DB n'est pas accessible, les requêtes API échoueront, mais le health check fonctionnera.

---

## ✅ Solution 2: Désactiver Temporairement les Migrations Auto

**Problème** : Les migrations peuvent prendre beaucoup de temps, même en arrière-plan.

**Solution** : Désactiver temporairement les migrations auto et les exécuter manuellement.

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 91)

**Modification** :
```yaml
"ENABLE_AUTO_MIGRATIONS": "false",  # Désactiver temporairement
```

**Puis exécuter les migrations manuellement** :
```bash
# Via Cloud Run Job
gcloud run jobs create migrate-db \
  --image europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:latest \
  --region europe-west1 \
  --set-env-vars DATABASE_URL="..." \
  --command ./yukpomnang_backend \
  --args migrate
```

---

## ✅ Solution 3: Démarrer un Serveur HTTP Minimal Immédiatement (AVANCÉ)

**Problème** : Le serveur HTTP ne démarre qu'après toutes les initialisations.

**Solution** : Démarrer un serveur HTTP minimal avec `/health` AVANT les initialisations lourdes.

**⚠️ Complexité** : Cette solution est complexe et peut causer des problèmes de concurrence. À utiliser en dernier recours.

**Fichier**: `backend/src/main.rs`

**Modification proposée** (à implémenter si nécessaire) :

```rust
// 1. Démarrer un serveur HTTP minimal IMMÉDIATEMENT (après dotenv et logging)
eprintln!("[MAIN] 🚀 Démarrage serveur HTTP minimal pour health check...");

let port = env::var("PORT")
    .unwrap_or_else(|_| "8080".to_string())
    .parse::<u16>()
    .unwrap_or(8080);
let addr = SocketAddr::from(([0, 0, 0, 0], port));

// Serveur minimal avec juste /health
let health_app = Router::new()
    .route("/health", get(|| async { "OK" }))
    .route("/healthz", get(|| async { "OK" }));

let health_listener = tokio::net::TcpListener::bind(addr).await?;
let health_server_handle = tokio::spawn(async move {
    axum::serve(health_listener, health_app).await
});

eprintln!("[MAIN] ✅ Serveur HTTP minimal démarré sur port {}", port);

// 2. Maintenant, faire toutes les initialisations lourdes...
// (connexions DB, migrations, etc.)
// ... code existant ...

// 3. Une fois tout prêt, arrêter le serveur minimal et démarrer le serveur complet
health_server_handle.abort();

let app = build_app(app_state.clone()).with_state(app_state.clone());
let listener = tokio::net::TcpListener::bind(addr).await?;
serve(listener, app).await?;
```

---

## 📋 Plan d'Action Recommandé

### Étape 1: Analyser les Logs (PRIORITÉ 1)
1. Consulter les logs Cloud Run
2. Identifier la dernière ligne de log
3. Déterminer si c'est :
   - Erreur PostgreSQL → Solution 1
   - Erreur migrations → Solution 2
   - Serveur ne démarre pas → Solution 3

### Étape 2: Appliquer la Solution Appropriée
- **Solution 1** (connect_lazy) : Recommandé en premier
- **Solution 2** (migrations désactivées) : Si migrations sont le problème
- **Solution 3** (serveur minimal) : En dernier recours

### Étape 3: Tester le Déploiement
1. Commiter et pousser les corrections
2. Surveiller le nouveau déploiement
3. Vérifier que le startup probe réussit

---

## 🎯 Solution Recommandée (Ordre de Priorité)

1. **Solution 1** : Utiliser `connect_lazy()` pour PostgreSQL
   - ✅ Simple à implémenter
   - ✅ Résout le problème dans la plupart des cas
   - ✅ Pas de changement majeur d'architecture

2. **Solution 2** : Désactiver migrations auto
   - ✅ Très simple (changement d'une ligne)
   - ✅ Résout le problème si migrations sont la cause
   - ⚠️ Nécessite exécution manuelle des migrations

3. **Solution 3** : Serveur HTTP minimal
   - ⚠️ Complexe à implémenter
   - ⚠️ Peut causer des problèmes de concurrence
   - ✅ Garantit que `/health` répond immédiatement

---

## 🔗 Références

- **Analyse des logs** : `ANALYSE_LOGS_CLOUD_RUN_STARTUP.md`
- **Documentation complète** : `ANALYSE_PROBLEME_STARTUP_PROBE_CLOUD_RUN.md`
- **SQLx connect_lazy** : https://docs.rs/sqlx/latest/sqlx/pool/struct.PgPoolOptions.html#method.connect_lazy

---

**💡 Recommandation** : Commencer par la Solution 1 (connect_lazy), qui est la plus simple et résout le problème dans la plupart des cas.

