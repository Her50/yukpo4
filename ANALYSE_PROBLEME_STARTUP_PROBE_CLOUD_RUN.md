# 🔍 Analyse Approfondie - Échec Startup Probe Cloud Run

**Date**: 2026-02-16  
**Problème**: `The user-provided container failed the configured startup probe checks`

---

## 📊 Configuration Actuelle du Startup Probe

D'après `.github/workflows/gcp-deploy.yml` (ligne 143) :

```yaml
--startup-probe=timeoutSeconds=5,periodSeconds=10,initialDelaySeconds=10,failureThreshold=10,httpGet.port=8080,httpGet.path=/health
```

### Calcul du Timeout Total

- **Initial Delay**: 10 secondes (avant la première tentative)
- **Timeout par tentative**: 5 secondes (max autorisé par Cloud Run)
- **Intervalle entre tentatives**: 10 secondes
- **Nombre d'échecs tolérés**: 10
- **Timeout total maximum**: 10s + (10 × 10s) = **110 secondes**

**⚠️ Problème potentiel**: Si le serveur ne démarre pas en 110 secondes, le probe échoue.

---

## 🔍 Causes Possibles de l'Échec

### 1. ⚠️ **Initialisation Bloquante Avant Démarrage du Serveur HTTP**

**Fichier**: `backend/src/main.rs`

Le serveur HTTP ne démarre qu'après de nombreuses initialisations :

1. **Vérifications variables d'environnement** (lignes 32-68)
2. **Initialisation dotenv et logging** (lignes 88-92)
3. **Connexion PostgreSQL** (lignes 108-586)
   - Création du pool avec `connect()` (bloquant)
   - Pré-chauffage du pool si `min_connections > 0`
   - **⚠️ CRITIQUE**: Même avec `min_connections=0` pour Cloud Run, la connexion initiale peut prendre du temps
4. **Connexion MongoDB** (lignes 1893-1926)
   - Même si non-bloquant pour Cloud Run, peut échouer et créer un client factice
5. **Connexion Redis** (lignes 1928-2000+)
   - Vérifications et conversions d'URL
6. **Migrations SQLx** (lignes 587-2195)
   - **⚠️ CRITIQUE**: Même si lancées en arrière-plan pour Cloud Run, il y a des vérifications bloquantes :
     - Vérification existence dossier `./migrations` (ligne 718)
     - Vérification table `_sqlx_migrations` (ligne 977)
     - Si `ENABLE_AUTO_MIGRATIONS=true`, exécution de `run_auto_migrations()` (ligne 1756)
7. **Création AppState** (lignes 2197+)
8. **Construction de l'application Axum** (ligne 2827)
9. **Bind du serveur HTTP** (lignes 2832-2848)
10. **Démarrage du serveur** (ligne 2854)

**Temps estimé**: 30-90 secondes selon la latence réseau et la complexité des migrations.

---

### 2. ⚠️ **Connexion PostgreSQL Bloquante**

**Fichier**: `backend/src/main.rs` (lignes 548-586)

Même avec `min_connections=0` pour Cloud Run, la première connexion au pool PostgreSQL peut échouer ou prendre du temps :

```rust
let pg_pool = PgPoolOptions::new()
    .max_connections(max_connections)
    .min_connections(actual_min_connections) // 0 pour Cloud Run
    .acquire_timeout(std::time::Duration::from_secs(30))
    .connect(&db_url)
    .await?; // ⚠️ Bloquant jusqu'à connexion réussie ou timeout (30s)
```

**Problème**: Si Cloud SQL n'est pas accessible immédiatement (permissions, réseau, etc.), le timeout de 30 secondes peut être atteint.

---

### 3. ⚠️ **Migrations Auto Exécutées au Démarrage**

**Fichier**: `backend/src/main.rs` (lignes 1756-2195)

Si `ENABLE_AUTO_MIGRATIONS=true` (défini dans le workflow GitHub Actions ligne 91), la fonction `run_auto_migrations()` est appelée :

```rust
if enable_auto_migrations {
    if is_cloud_run {
        // Migrations en arrière-plan
    } else {
        // ⚠️ Migrations bloquantes pour non-Cloud Run
        run_auto_migrations(&pg_pool, enable_auto_migrations).await?;
    }
}
```

**Problème**: Même en arrière-plan, `run_auto_migrations()` peut faire des vérifications bloquantes avant de lancer les migrations.

---

### 4. ⚠️ **Route /health Non Disponible Immédiatement**

**Fichier**: `backend/src/lib.rs` (lignes 130-132)

La route `/health` est simple :

```rust
async fn healthz() -> &'static str {
    "OK"
}
```

**Problème**: Cette route n'est disponible qu'après que le serveur HTTP soit démarré. Si le serveur ne démarre pas assez vite, le probe échoue.

---

### 5. ⚠️ **Script de Démarrage Cloud Run**

**Fichier**: `backend/scripts/start-cloud-run.sh`

Le script est minimal mais vérifie :
- `DATABASE_URL` (ligne 15-18) - peut bloquer si absente
- Existence de l'exécutable (ligne 21-24) - peut bloquer si absent

**Problème**: Si l'exécutable n'est pas trouvé ou n'a pas les permissions, le script échoue avant même de lancer l'application.

---

### 6. ⚠️ **Dockerfile Entrypoint**

**Fichier**: `backend/Dockerfile.cloud.optimized` (ligne 129)

```dockerfile
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/start-cloud-run.sh; else /app/start-cloud.sh; fi"]
```

**Problème**: Le script bash ajoute un délai supplémentaire avant le lancement de l'application.

---

### 7. ⚠️ **Cloud SQL Connection Socket**

**Fichier**: `.github/workflows/gcp-deploy.yml` (ligne 139)

```yaml
--add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres
```

**Problème**: Si le socket Unix Cloud SQL n'est pas monté correctement ou si les permissions sont incorrectes, la connexion PostgreSQL échoue.

---

## 🎯 Solutions Recommandées (par ordre de priorité)

### ✅ Solution 1: Augmenter le Timeout du Startup Probe

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Modification**:
```yaml
--startup-probe=timeoutSeconds=10,periodSeconds=5,initialDelaySeconds=30,failureThreshold=20,httpGet.port=8080,httpGet.path=/health
```

**Explication**:
- `timeoutSeconds=10`: Maximum autorisé par Cloud Run (10s)
- `periodSeconds=5`: Intervalle réduit pour vérifications plus fréquentes
- `initialDelaySeconds=30`: Délai initial augmenté pour laisser le temps au conteneur de démarrer
- `failureThreshold=20`: Plus de tentatives (20 × 5s = 100s supplémentaires)
- **Timeout total**: 30s + (20 × 5s) = **130 secondes**

---

### ✅ Solution 2: Démarrer le Serveur HTTP Immédiatement (Health Check Minimal)

**Fichier**: `backend/src/main.rs`

**Modification**: Démarrer le serveur HTTP AVANT toutes les initialisations lourdes, avec une route `/health` qui répond immédiatement.

**Approche**:
1. Créer un serveur HTTP minimal avec uniquement la route `/health`
2. Lancer ce serveur en parallèle avec les initialisations
3. Une fois les initialisations terminées, remplacer le serveur minimal par le serveur complet

**Code proposé**:
```rust
// Démarrer un serveur HTTP minimal IMMÉDIATEMENT
let health_app = Router::new()
    .route("/health", get(|| async { "OK" }))
    .route("/healthz", get(|| async { "OK" }));

let health_addr = SocketAddr::from(([0, 0, 0, 0], port));
let health_listener = tokio::net::TcpListener::bind(health_addr).await?;
let health_server = tokio::spawn(async move {
    axum::serve(health_listener, health_app).await
});

// Maintenant, faire toutes les initialisations lourdes...
// (connexions DB, migrations, etc.)

// Une fois tout prêt, arrêter le serveur minimal et démarrer le serveur complet
health_server.abort();
let app = build_app(app_state.clone()).with_state(app_state.clone());
serve(listener, app).await?;
```

**⚠️ Complexité**: Cette approche est complexe et peut causer des problèmes de concurrence.

---

### ✅ Solution 3: Rendre Toutes les Initialisations Non-Bloquantes

**Fichier**: `backend/src/main.rs`

**Modification**: Utiliser `connect_lazy()` au lieu de `connect()` pour PostgreSQL, et lancer toutes les initialisations en arrière-plan.

**Code proposé**:
```rust
// Utiliser connect_lazy() pour connexion non-bloquante
let pg_pool = PgPoolOptions::new()
    .max_connections(max_connections)
    .min_connections(0) // Toujours 0 pour Cloud Run
    .acquire_timeout(std::time::Duration::from_secs(30))
    .connect_lazy(&db_url)?; // ⚠️ Non-bloquant

// Lancer les migrations en arrière-plan IMMÉDIATEMENT
tokio::spawn(async move {
    // Attendre que le pool soit prêt
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    // Exécuter les migrations...
});

// Démarrer le serveur HTTP IMMÉDIATEMENT
let app = build_app(app_state.clone()).with_state(app_state.clone());
serve(listener, app).await?;
```

**⚠️ Risque**: Si la DB n'est pas accessible, les requêtes échoueront silencieusement.

---

### ✅ Solution 4: Simplifier le Script de Démarrage Cloud Run

**Fichier**: `backend/scripts/start-cloud-run.sh`

**Modification**: Supprimer toutes les vérifications non-critiques et lancer l'application immédiatement.

**Code proposé**:
```bash
#!/bin/bash
set -e

export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}

# Vérification minimale uniquement
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable non trouvé!"
    exit 1
fi

chmod +x ./yukpomnang_backend

# Lancer IMMÉDIATEMENT
exec ./yukpomnang_backend
```

---

### ✅ Solution 5: Vérifier les Logs Cloud Run

**Action immédiate**: Consulter les logs Cloud Run pour identifier la cause exacte.

**URL des logs** (fournie dans l'erreur):
```
https://console.cloud.google.com/logs/viewer?project=***&resource=cloud_run_revision/service_name/yukpo-backend/revision_name/yukpo-backend-00059-vgz&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22yukpo-backend%22%0Aresource.labels.revision_name%3D%22yukpo-backend-00059-vgz%22
```

**Rechercher**:
- Erreurs de connexion PostgreSQL
- Erreurs de connexion MongoDB/Redis
- Erreurs de migrations
- Timeouts
- Panics Rust

---

### ✅ Solution 6: Désactiver Temporairement les Migrations Auto

**Fichier**: `.github/workflows/gcp-deploy.yml`

**Modification**: Désactiver `ENABLE_AUTO_MIGRATIONS` pour le déploiement initial.

```yaml
"ENABLE_AUTO_MIGRATIONS": "false",  # Désactiver temporairement
```

**Note**: Les migrations devront être exécutées manuellement ou via un Cloud Run Job séparé.

---

## 🔧 Plan d'Action Recommandé

### Étape 1: Vérifier les Logs (IMMÉDIAT)
1. Consulter les logs Cloud Run via l'URL fournie
2. Identifier la dernière ligne de log avant l'échec
3. Rechercher les erreurs critiques (connexion DB, migrations, etc.)

### Étape 2: Augmenter le Timeout du Startup Probe (RAPIDE)
1. Modifier `.github/workflows/gcp-deploy.yml` ligne 143
2. Utiliser la configuration proposée dans Solution 1
3. Commiter et pousser pour déclencher un nouveau déploiement

### Étape 3: Simplifier le Script de Démarrage (RAPIDE)
1. Modifier `backend/scripts/start-cloud-run.sh`
2. Supprimer toutes les vérifications non-critiques
3. Lancer l'application immédiatement

### Étape 4: Optimiser les Initialisations (MOYEN TERME)
1. Utiliser `connect_lazy()` pour PostgreSQL
2. Lancer toutes les migrations en arrière-plan
3. Démarrer le serveur HTTP le plus tôt possible

### Étape 5: Créer un Health Check Avancé (LONG TERME)
1. Créer une route `/health/ready` qui vérifie DB, Redis, etc.
2. Utiliser `/health` pour le startup probe (répond immédiatement)
3. Utiliser `/health/ready` pour le liveness probe (vérifie les dépendances)

---

## 📊 Métriques à Surveiller

Après application des solutions :

1. **Temps de démarrage**: Mesurer le temps entre le démarrage du conteneur et la première réponse `/health`
2. **Taux de succès du startup probe**: Surveiller le pourcentage de déploiements réussis
3. **Latence des requêtes**: Vérifier que les optimisations n'impactent pas les performances

---

## 🔗 Références

- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start)
- [Cloud Run Startup Probe](https://cloud.google.com/run/docs/configuring/healthchecks#startup-probe)
- [SQLx connect_lazy](https://docs.rs/sqlx/latest/sqlx/pool/struct.PgPoolOptions.html#method.connect_lazy)

---

## ✅ Checklist de Vérification

- [ ] Logs Cloud Run consultés et analysés
- [ ] Timeout du startup probe augmenté
- [ ] Script de démarrage simplifié
- [ ] Connexions DB non-bloquantes (connect_lazy)
- [ ] Migrations lancées en arrière-plan uniquement
- [ ] Serveur HTTP démarre avant toutes les initialisations lourdes
- [ ] Tests de déploiement réussis
- [ ] Documentation mise à jour

---

**🎯 Objectif**: Réduire le temps de démarrage à moins de 30 secondes pour que le startup probe réussisse avec la configuration actuelle.

