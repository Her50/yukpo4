# Diagnostic du Problème Réel - ECS Health Checks

**Date**: 2026-02-13  
**Problème**: Les tâches ECS échouent les health checks (Exit Code 137)

---

## 🔍 PROBLÈME IDENTIFIÉ

### Symptômes
1. ✅ Les tâches échouent les health checks (Exit Code 137 = SIGKILL)
2. ✅ Les logs s'arrêtent après Redis (22 événements seulement)
3. ✅ Le service redémarre continuellement les tâches
4. ✅ Health Check: `curl -f http://localhost:8080/health`
5. ✅ Start Period: 60 secondes
6. ✅ Grace Period: 120 secondes

### Configuration Actuelle
- **Health Check Command**: `curl -f http://localhost:8080/health || exit 1`
- **Health Check Interval**: 30 secondes
- **Health Check Timeout**: 10 secondes
- **Health Check Retries**: 3
- **Start Period**: 60 secondes
- **Grace Period**: 120 secondes

---

## 🎯 CAUSES POSSIBLES

### 1. L'Application Rust Crash au Démarrage (PROBABLE)

**Indices**:
- Les logs s'arrêtent après Redis (22 événements)
- Aucun message de démarrage du serveur HTTP
- Exit Code 137 (SIGKILL) = l'application a été tuée

**Vérifications nécessaires**:
- Examiner les logs complets pour voir s'il y a des erreurs après Redis
- Vérifier si l'application tente de se connecter à la base de données
- Vérifier si les migrations s'exécutent
- Vérifier si le serveur HTTP démarre

### 2. Problème de Connexion à la Base de Données (PROBABLE)

**Indices**:
- Le script `start-cloud.sh` continue malgré le message d'avertissement
- L'application Rust pourrait échouer lors de la connexion à la base

**Code concerné** (`main.rs` lignes 94-200):
```rust
log::info!("🔌 Connexion à la base de données PostgreSQL...");
// Création du pool PostgreSQL avec retry logic
```

**Vérifications nécessaires**:
- Vérifier si `DATABASE_URL` est correct
- Vérifier si la connexion à la base réussit
- Vérifier les erreurs de pool de connexions

### 3. Les Migrations Échouent (POSSIBLE)

**Indices**:
- Si `ENABLE_AUTO_MIGRATIONS=true`, les migrations s'exécutent au démarrage
- Si les migrations échouent, l'application peut crash

**Vérifications nécessaires**:
- Vérifier l'état des migrations dans la base
- Vérifier les erreurs de migration dans les logs

### 4. Le Serveur HTTP ne Démarre Pas (POSSIBLE)

**Indices**:
- L'endpoint `/health` existe bien dans le code
- Mais le serveur pourrait ne pas démarrer sur le port 8080

**Code concerné** (`main.rs` lignes 2000+):
```rust
// Démarrage du serveur Axum
let addr = SocketAddr::from(([0, 0, 0, 0], port));
serve(listener, app).await
```

**Vérifications nécessaires**:
- Vérifier si le serveur démarre
- Vérifier si le port 8080 est disponible
- Vérifier les erreurs de bind

### 5. Timeout du Health Check (POSSIBLE)

**Indices**:
- Start Period: 60 secondes
- Si l'application prend plus de 60 secondes à démarrer, le health check échoue

**Vérifications nécessaires**:
- Vérifier le temps de démarrage de l'application
- Augmenter le Start Period si nécessaire

---

## 🔧 ACTIONS RECOMMANDÉES

### 1. Examiner les Logs Complets Après Redis

Récupérer TOUS les logs d'une tâche pour voir ce qui se passe après Redis:

```powershell
# Récupérer tous les logs d'un stream
$streamName = "backend/backend/<task-id>"
aws logs get-log-events --log-group-name "/ecs/yukpo-backend" --log-stream-name $streamName --region eu-west-1 --limit 1000 --output json > logs-complets.json
```

### 2. Vérifier les Erreurs de Connexion à la Base

Examiner les logs pour voir si l'application tente de se connecter:

```bash
# Chercher dans les logs
grep -i "connexion\|connection\|database\|postgres\|sqlx" logs-complets.json
```

### 3. Vérifier l'État des Migrations

Vérifier si les migrations sont à jour:

```sql
-- Se connecter à la base
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo

-- Vérifier la table _sqlx_migrations
SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 10;
```

### 4. Augmenter le Start Period

Si l'application prend du temps à démarrer, augmenter le Start Period:

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --health-check-grace-period-seconds 180 \
  --region eu-west-1
```

### 5. Vérifier la Configuration du Health Check

Vérifier que le health check est correctement configuré:

```bash
aws ecs describe-task-definition --task-definition yukpo-backend --region eu-west-1 --query 'taskDefinition.containerDefinitions[0].healthCheck'
```

---

## 📊 CONCLUSION

**Le problème n'est PAS l'image Docker**, mais probablement:

1. **L'application Rust crash au démarrage** après Redis
2. **Problème de connexion à la base de données** (malgré les vérifications)
3. **Les migrations échouent** silencieusement
4. **Le serveur HTTP ne démarre pas** dans les 60 secondes

**Action immédiate**: Examiner les logs complets pour voir exactement où l'application échoue.

