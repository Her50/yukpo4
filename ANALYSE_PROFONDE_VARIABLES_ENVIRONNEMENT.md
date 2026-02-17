# 🔍 ANALYSE PROFONDE : Variables d'Environnement et Problème de Démarrage

**Date** : 2026-02-17  
**Problème** : Rust ne démarre jamais sur Cloud Run

---

## 📍 OÙ VOIR LES VARIABLES D'ENVIRONNEMENT DANS GCP

### 1. Console Cloud Run

**URL** : https://console.cloud.google.com/run?project=yukpo-project

**Étapes** :
1. Aller sur Cloud Run
2. Cliquer sur le service `yukpo-backend`
3. Onglet **"Variables d'environnement et secrets"** (ou **"ENVIRONMENT VARIABLES & SECRETS"**)
4. Section **"Variables d'environnement"** : Liste toutes les variables définies comme variables
5. Section **"Secrets"** : Liste tous les secrets (DATABASE_URL, JWT_SECRET, etc.)

### 2. Via gcloud CLI

```bash
# Voir toutes les variables d'environnement
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].env)" \
  --project yukpo-project

# Voir tous les secrets
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].envFrom)" \
  --project yukpo-project
```

### 3. Secret Manager

**URL** : https://console.cloud.google.com/security/secret-manager?project=yukpo-project

Les secrets référencés dans Cloud Run sont stockés dans Secret Manager :
- `database-url`
- `jwt-secret`
- `redis-url`
- `mongodb-url`

---

## 🔍 ANALYSE DU CODE : CHARGEMENT DES VARIABLES

### 1. Dans Rust (`backend/src/main.rs`)

#### Ordre de chargement :

```rust
// Ligne 28-68 : Vérification IMMÉDIATE des variables critiques (AVANT dotenv)
eprintln!("[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint");
let db_url_ok = std::env::var("DATABASE_URL").is_ok();  // ← Vérifie directement
let mongo_url_ok = std::env::var("MONGODB_URL").is_ok();
let redis_url_ok = std::env::var("REDIS_URL").is_ok();
let jwt_secret_ok = std::env::var("JWT_SECRET").is_ok();

// Ligne 100-103 : Initialisation dotenv (APRÈS vérification)
// dotenv() charge les variables depuis .env si le fichier existe
// Mais sur Cloud Run, les variables viennent de l'environnement, pas de .env

// Ligne 241-272 : Récupération et nettoyage de DATABASE_URL
let mut db_url = env::var("DATABASE_URL").map_err(|e| {
    eprintln!("[MAIN] ❌ ERREUR CRITIQUE: DATABASE_URL manquante ou invalide: {}", e);
    e
})?;

// Nettoyage des retours à la ligne
db_url = db_url.trim().to_string();
db_url = db_url.replace("\r\n", "").replace("\n", "").replace("\r", "");
```

**⚠️ PROBLÈME POTENTIEL** : Rust vérifie les variables **AVANT** `dotenv()`, ce qui est correct pour Cloud Run (les variables viennent de l'environnement, pas de `.env`).

### 2. Dans le Wrapper (`backend/scripts/startup-wrapper.sh`)

#### Ordre d'exécution :

```bash
# Ligne 8 : Démarrage wrapper
echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# Ligne 12-14 : Démarrage serveur Python
python3 /app/health-server-python.py &
HEALTH_PID=$!

# Ligne 17-22 : Attente (10 secondes total)
sleep 5
sleep 5

# Ligne 25-32 : Arrêt Python et libération port
kill $HEALTH_PID
sleep 5

# Ligne 46-58 : Vérification binaire Rust
if [ ! -f /app/yukpomnang_backend ]; then
    exit 1
fi

# Ligne 63-88 : Vérification et nettoyage DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    # Détecte retours à la ligne
    # Nettoie DATABASE_URL
    export DATABASE_URL
fi

# Ligne 94-114 : Test exécution binaire
if /app/yukpomnang_backend --version >/dev/null 2>&1; then
    echo "✅ [WRAPPER] Binaire peut s'exécuter"
else
    exit 1
fi

# Ligne 122 : Démarrage Rust avec exec
exec /app/yukpomnang_backend 2>&1
```

**⚠️ PROBLÈME IDENTIFIÉ** : Le wrapper nettoie `DATABASE_URL` et fait `export DATABASE_URL`, mais **`exec` remplace le processus**, donc les variables exportées dans le wrapper devraient être héritées par Rust.

### 3. Dans le Dockerfile (`backend/Dockerfile.cloud.optimized`)

#### ENTRYPOINT et CMD :

```dockerfile
# Ligne 135 : ENTRYPOINT vérifie CLOUD_RUN
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/startup-wrapper.sh; else /app/start-cloud.sh; fi"]
CMD ["./yukpomnang_backend"]
```

**⚠️ PROBLÈME CRITIQUE** : 
- L'ENTRYPOINT exécute `/bin/bash -c "if ... then startup-wrapper.sh; fi"`
- Le wrapper utilise `exec /app/yukpomnang_backend`
- Mais le CMD `["./yukpomnang_backend"]` n'est **JAMAIS exécuté** car l'ENTRYPOINT prend le contrôle

**✅ CORRECTION NÉCESSAIRE** : Le CMD est ignoré, donc le wrapper doit utiliser `exec` (ce qui est déjà fait).

### 4. Dans le Workflow GitHub Actions (`.github/workflows/gcp-deploy.yml`)

#### Définition des secrets :

```yaml
# Ligne 245 : Secrets définis comme secrets (pas variables)
--update-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,MONGODB_URL=mongodb-url:latest"
```

**⚠️ PROBLÈME POTENTIEL** : Les secrets sont référencés comme `database-url:latest`, mais il faut vérifier que ces secrets existent dans Secret Manager avec ces noms exacts.

#### Variables d'environnement :

```yaml
# Ligne 244 : Variables définies comme variables (pas secrets)
--set-env-vars="$ENV_VARS"
```

Les variables excluent explicitement les secrets :
- `CLOUD_RUN=true`
- `ENABLE_AUTO_MIGRATIONS=true`
- `SQLX_OFFLINE=true`
- `HOST=0.0.0.0`
- `RUST_LOG=info`
- etc.

---

## 🔴 PROBLÈMES IDENTIFIÉS

### Problème 1 : Rust ne démarre jamais

**Symptôme** : Aucun log `[MAIN]` dans les logs Cloud Run.

**Causes possibles** :

1. **Le binaire n'existe pas** :
   - Dockerfile ligne 102 : `COPY --from=builder /app/bin/yukpomnang_backend /app/yukpomnang_backend`
   - Mais le builder copie dans `/app/bin/yukpomnang_backend` (ligne 66)
   - Le runtime copie depuis `/app/bin/yukpomnang_backend` vers `/app/yukpomnang_backend` ✅

2. **Le binaire n'est pas exécutable** :
   - Dockerfile ligne 67 : `chmod +x /app/bin/yukpomnang_backend` ✅
   - Dockerfile ligne 102 : `--chown=appuser:appuser` (permissions préservées) ✅

3. **Le binaire crash immédiatement** :
   - Si le binaire crash avant le premier `eprintln!`, on ne verra aucun log
   - Le wrapper devrait capturer l'erreur avec `exec /app/yukpomnang_backend 2>&1`

4. **Cloud Run tue le processus** :
   - Si le processus principal (PID 1) n'est pas Rust mais le wrapper, Cloud Run peut tuer le wrapper
   - `exec` devrait résoudre ce problème

### Problème 2 : Variables d'environnement non héritées

**Symptôme** : Rust ne voit pas les variables d'environnement.

**Causes possibles** :

1. **Les secrets ne sont pas montés** :
   - Cloud Run monte les secrets comme fichiers dans `/etc/secrets/` ou comme variables
   - Il faut vérifier que les secrets sont bien montés comme variables, pas comme fichiers

2. **Le wrapper exporte mais exec remplace** :
   - Le wrapper fait `export DATABASE_URL` mais `exec` devrait hériter les variables
   - Vérifier que les variables sont bien dans l'environnement du wrapper

### Problème 3 : ENTRYPOINT complexe

**Symptôme** : Le wrapper peut ne pas être exécuté correctement.

**Cause** :
- L'ENTRYPOINT utilise `/bin/bash -c "if ... then ... fi"`
- Si `CLOUD_RUN` n'est pas défini ou mal défini, le wrapper ne sera pas exécuté

---

## ✅ SOLUTIONS PROPOSÉES

### Solution 1 : Simplifier l'ENTRYPOINT

**Avant** :
```dockerfile
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/startup-wrapper.sh; else /app/start-cloud.sh; fi"]
```

**Après** :
```dockerfile
# Si CLOUD_RUN=true, utiliser startup-wrapper.sh directement
# Sinon, utiliser start-cloud.sh
ENTRYPOINT ["/bin/bash", "/app/startup-wrapper.sh"]
```

Ou mieux, créer un script d'entrée unique qui gère les deux cas.

### Solution 2 : Vérifier les secrets dans Secret Manager

Vérifier que les secrets existent avec les noms exacts :
- `database-url` (pas `DATABASE_URL`)
- `jwt-secret`
- `redis-url`
- `mongodb-url`

### Solution 3 : Ajouter des logs de diagnostic dans le wrapper

Le wrapper devrait logger :
- Les variables d'environnement présentes (sans afficher les valeurs)
- Le résultat de `exec`
- Les erreurs de démarrage de Rust

### Solution 4 : Vérifier que CLOUD_RUN est défini

Le workflow définit `CLOUD_RUN=true` dans `env-vars.json`, mais il faut vérifier qu'il est bien passé au conteneur.

---

## 🔧 COMMANDES DE DIAGNOSTIC

### 1. Vérifier les variables dans Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].env)" \
  --project yukpo-project
```

### 2. Vérifier les secrets dans Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].envFrom)" \
  --project yukpo-project
```

### 3. Vérifier les secrets dans Secret Manager

```bash
gcloud secrets list --project yukpo-project
gcloud secrets versions access latest --secret="database-url" --project yukpo-project
```

### 4. Tester le binaire localement

```bash
# Dans le conteneur
docker run -it --rm \
  -e CLOUD_RUN=true \
  -e DATABASE_URL="postgresql://..." \
  yukpo-backend:latest \
  /app/startup-wrapper.sh
```

---

## 📊 CHECKLIST DE VÉRIFICATION

- [ ] Les secrets existent dans Secret Manager avec les noms corrects
- [ ] Les secrets sont référencés correctement dans le workflow (`database-url:latest`)
- [ ] La variable `CLOUD_RUN=true` est définie dans Cloud Run
- [ ] Le binaire `/app/yukpomnang_backend` existe dans l'image Docker
- [ ] Le binaire est exécutable (`chmod +x`)
- [ ] Le wrapper utilise `exec` pour remplacer le processus
- [ ] Les variables d'environnement sont héritées par Rust après `exec`
- [ ] Les logs du wrapper apparaissent dans Cloud Run
- [ ] Les logs Rust `[MAIN]` apparaissent dans Cloud Run

---

**Date d'analyse** : 2026-02-17

