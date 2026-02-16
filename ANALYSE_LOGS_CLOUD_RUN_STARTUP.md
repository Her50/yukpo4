# 🔍 Analyse des Logs Cloud Run - Startup Probe Échoué

**Date**: 2026-02-16  
**Problème**: Startup probe échoue même avec timeout de 330 secondes  
**Revision**: `yukpo-backend-00060-6wn`

---

## 📊 Configuration Actuelle

- **Timeout total**: 330 secondes (30s initial + 20 × 15s)
- **Endpoint health check**: `/health`
- **Port**: 8080

**⚠️ Si le probe échoue avec 330 secondes, le problème est probablement :**
1. Le serveur HTTP ne démarre jamais
2. Le serveur démarre mais `/health` ne répond pas
3. Erreur fatale avant le démarrage du serveur

---

## 🔍 Étapes d'Analyse des Logs

### 1. Accéder aux Logs Cloud Run

**URL directe** (remplacer `***` par votre project ID) :
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name=yukpo-backend-00060-6wn
```

**OU via Console GCP** :
1. Aller sur https://console.cloud.google.com/run
2. Sélectionner le projet
3. Cliquer sur `yukpo-backend`
4. Onglet "Logs"
5. Filtrer par revision : `yukpo-backend-00060-6wn`

---

### 2. Rechercher les Indicateurs Clés

#### ✅ Signes de Démarrage Réussi

Rechercher dans les logs :
- `[MAIN] 🚀 Application Rust démarre`
- `[MAIN] ✅ Serveur lance sur http://0.0.0.0:8080`
- `[MAIN] ✅ Bind réussi, démarrage du serveur HTTP...`
- `✅ Serveur lance sur http://0.0.0.0:8080`

**Si ces messages apparaissent** : Le serveur démarre, mais `/health` ne répond peut-être pas correctement.

---

#### ❌ Erreurs Critiques à Rechercher

**A. Erreurs de Connexion PostgreSQL** :
```
❌ ERREUR CRITIQUE: DATABASE_URL manquante
password authentication failed
connection refused
timeout
acquire timeout
```

**B. Erreurs de Migrations** :
```
❌ [MIGRATIONS] Erreur
migration failed
table does not exist
```

**C. Erreurs de Panic Rust** :
```
panic
thread panicked
PANIC détecté
```

**D. Erreurs de Port/Bind** :
```
❌ ERREUR CRITIQUE: Impossible de bind sur
Address already in use
Permission denied
```

**E. Erreurs d'Exécutable** :
```
❌ ERREUR: Exécutable non trouvé
exec format error
```

---

### 3. Timeline d'Analyse

**Ordre chronologique attendu** :

1. **0-5s** : Démarrage du conteneur
   - `🚀 Démarrage Yukpomnang Backend - Cloud Run...`
   - `🚀 Lancement immédiat sur port 8080...`

2. **5-10s** : Démarrage Rust
   - `[MAIN] 🚀 Application Rust démarre`
   - `[MAIN] 🔍 Vérification des variables d'environnement...`

3. **10-30s** : Initialisation
   - Connexion PostgreSQL
   - Connexion MongoDB/Redis
   - Vérifications migrations

4. **30-60s** : Démarrage serveur HTTP
   - `[MAIN] ✅ Bind réussi`
   - `✅ Serveur lance sur http://0.0.0.0:8080`

5. **60s+** : Health check devrait répondre
   - Requêtes GET `/health` devraient retourner `OK`

**⚠️ Si les logs s'arrêtent avant l'étape 4** : Le serveur HTTP ne démarre jamais.

---

## 🔧 Solutions Selon les Erreurs Trouvées

### Solution A: Erreur de Connexion PostgreSQL

**Symptômes** :
- `password authentication failed`
- `connection refused`
- `timeout`

**Solutions** :

1. **Vérifier DATABASE_URL** :
   ```bash
   # Vérifier le secret GitHub
   gh secret list --repo Her50/yukpo4 | grep DATABASE_URL
   ```

2. **Vérifier le format Cloud SQL Unix Socket** :
   ```
   postgresql://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE
   ```

3. **Vérifier les permissions Cloud SQL** :
   - Le service account Cloud Run doit avoir le rôle `Cloud SQL Client`
   - Vérifier : https://console.cloud.google.com/iam-admin/iam

4. **Tester la connexion manuellement** :
   ```bash
   gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db
   ```

---

### Solution B: Erreur de Migrations Bloquantes

**Symptômes** :
- Logs s'arrêtent après `[MIGRATIONS]`
- Timeout pendant migrations

**Solutions** :

1. **Désactiver temporairement les migrations auto** :
   **Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 91)
   ```yaml
   "ENABLE_AUTO_MIGRATIONS": "false",
   ```

2. **Exécuter les migrations via Cloud Run Job** :
   ```bash
   gcloud run jobs create migrate-db \
     --image europe-west1-docker.pkg.dev/yukpo-project/yukpo-backend/yukpo-backend:latest \
     --region europe-west1 \
     --set-env-vars DATABASE_URL="..." \
     --command ./yukpomnang_backend \
     --args migrate
   ```

---

### Solution C: Serveur HTTP Ne Démarre Pas

**Symptômes** :
- Pas de message `✅ Serveur lance sur http://0.0.0.0:8080`
- Logs s'arrêtent avant le bind

**Solutions** :

1. **Vérifier que le port est correct** :
   - Variable `PORT=8080` doit être définie
   - Vérifier dans les logs : `Port: 8080`

2. **Vérifier les permissions** :
   - Le conteneur doit pouvoir bind sur `0.0.0.0:8080`
   - Cloud Run gère cela automatiquement, mais vérifier les logs

3. **Créer un health check minimal plus tôt** :
   Voir Solution D ci-dessous.

---

### Solution D: Health Check Ne Répond Pas

**Symptômes** :
- Serveur démarre (`✅ Serveur lance`)
- Mais `/health` retourne 404 ou timeout

**Solutions** :

1. **Vérifier que la route `/health` existe** :
   **Fichier**: `backend/src/lib.rs` (ligne 322-323)
   ```rust
   .route("/healthz", get(healthz))
   .route("/health", get(healthz)) // ✅ Doit exister
   ```

2. **Tester localement** :
   ```bash
   # Après démarrage local
   curl http://localhost:8080/health
   # Devrait retourner: OK
   ```

3. **Créer un health check encore plus simple** :
   Démarrer un serveur HTTP minimal AVANT toutes les initialisations (voir Solution E).

---

### Solution E: Démarrer le Serveur HTTP Immédiatement (Solution Radicale)

**Problème** : Le serveur HTTP ne démarre qu'après toutes les initialisations (DB, migrations, etc.).

**Solution** : Démarrer un serveur HTTP minimal avec `/health` AVANT les initialisations lourdes.

**Fichier**: `backend/src/main.rs`

**Modification proposée** (à implémenter si nécessaire) :

```rust
// 1. Démarrer un serveur HTTP minimal IMMÉDIATEMENT
let health_app = Router::new()
    .route("/health", get(|| async { "OK" }))
    .route("/healthz", get(|| async { "OK" }));

let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse::<u16>().unwrap_or(8080);
let health_addr = SocketAddr::from(([0, 0, 0, 0], port));
let health_listener = tokio::net::TcpListener::bind(health_addr).await?;

let health_server_handle = tokio::spawn(async move {
    axum::serve(health_listener, health_app).await
});

// 2. Maintenant, faire toutes les initialisations lourdes...
// (connexions DB, migrations, etc.)

// 3. Une fois tout prêt, arrêter le serveur minimal et démarrer le serveur complet
health_server_handle.abort();

let app = build_app(app_state.clone()).with_state(app_state.clone());
let listener = tokio::net::TcpListener::bind(health_addr).await?;
serve(listener, app).await?;
```

**⚠️ Complexité** : Cette approche est complexe et peut causer des problèmes de concurrence. À utiliser en dernier recours.

---

## 📋 Checklist d'Analyse

- [ ] Logs Cloud Run consultés
- [ ] Dernière ligne de log identifiée
- [ ] Type d'erreur identifié (PostgreSQL, migrations, panic, etc.)
- [ ] Solution appropriée appliquée
- [ ] Nouveau déploiement testé
- [ ] Si échec : Solution suivante appliquée

---

## 🎯 Plan d'Action Recommandé

### Étape 1: Analyser les Logs (IMMÉDIAT)
1. Accéder aux logs via l'URL fournie
2. Identifier la dernière ligne de log
3. Rechercher les erreurs critiques listées ci-dessus

### Étape 2: Appliquer la Solution Appropriée
- Si erreur PostgreSQL → Solution A
- Si erreur migrations → Solution B
- Si serveur ne démarre pas → Solution C
- Si health check ne répond pas → Solution D

### Étape 3: Tester le Déploiement
1. Commiter et pousser les corrections
2. Surveiller le nouveau déploiement
3. Vérifier les logs du nouveau déploiement

### Étape 4: Si Nécessaire, Solution Radicale
- Implémenter Solution E (serveur HTTP minimal immédiat)

---

## 🔗 Références

- **Logs Cloud Run** : https://console.cloud.google.com/logs?project=yukpo-project
- **Cloud Run Troubleshooting** : https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
- **Cloud SQL Connection** : https://cloud.google.com/sql/docs/postgres/connect-run

---

**💡 Important** : Les logs Cloud Run contiennent la réponse exacte. Consultez-les en priorité pour identifier la cause spécifique de l'échec.

