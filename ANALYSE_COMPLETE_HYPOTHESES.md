# Analyse Complète de Toutes les Hypothèses

**Date**: 2026-02-13  
**Objectif**: Analyser systématiquement toutes les causes possibles du crash

---

## ✅ HYPOTHÈSE 1: Panic Rust non capturée (stderr)

### Vérification
- ✅ Logs stderr vérifiés dans CloudWatch
- ✅ Aucune panic Rust trouvée dans les logs
- ✅ Les logs s'arrêtent après Redis (22 événements)

### Conclusion
- ⚠️ **Pas de panic visible** dans les logs stdout/stderr
- ⚠️ Les panics peuvent être capturées par le panic hook mais ne pas apparaître dans les logs
- ⚠️ L'application crash silencieusement avant même de logger

### Action
- Ajouter des logs au tout début de `main.rs` pour capturer les panics

---

## ❌ HYPOTHÈSE 2: Variables d'environnement manquantes

### Vérification

**Variables dans la Task Definition**:
- ✅ `RUST_LOG` = `info` (directe)
- ✅ `APP_ENV` = `production` (directe)
- ✅ `DATABASE_URL` (depuis Secrets Manager)
- ✅ `REDIS_URL` (depuis Secrets Manager)
- ✅ `JWT_SECRET` (depuis Secrets Manager)
- ✅ `ENABLE_AUTO_MIGRATIONS` (depuis Secrets Manager)
- ✅ `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (depuis SSM)
- ✅ `UPLOAD_BASE_URL`, `LAUNCH_PHASE_START_DATE` (depuis SSM)

**Variables dans Secrets Manager**:
- ✅ `DATABASE_URL` = `postgresql://yukpo_admin:...@yukpo-db.../yukpo`
- ✅ `REDIS_URL` = `redis://master.yukpo-redis...`
- ✅ `JWT_SECRET` = `57ae9f6201b4d3c8`
- ✅ `PORT` = `8080`
- ✅ `HOST` = `0.0.0.0`
- ❌ **`MONGODB_URL` = MANQUANTE**

### Problème Identifié

**`MONGODB_URL` est MANQUANTE dans Secrets Manager** mais le code Rust essaie de s'y connecter !

**Code Rust** (ligne 1563):
```rust
let mongo_url = env::var("MONGODB_URL")
    .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
```

**Impact**:
- Si `MONGODB_URL` n'est pas définie, le code utilise `mongodb://localhost:27017`
- L'application essaie de se connecter à MongoDB sur localhost
- La connexion échoue (timeout ou erreur)
- **L'application peut crash si la connexion MongoDB est requise**

### Conclusion
- ❌ **`MONGODB_URL` manquante** - Utilise la valeur par défaut `mongodb://localhost:27017`
- ⚠️ **Connexion MongoDB échoue** - Timeout ou erreur de connexion
- ⚠️ **L'application peut crash** si MongoDB est requis au démarrage

### Action Requise
1. Ajouter `MONGODB_URL` dans Secrets Manager
2. OU rendre MongoDB optionnel dans le code Rust (déjà fait avec `unwrap_or_else`)
3. OU vérifier si MongoDB est vraiment requis au démarrage

---

## ✅ HYPOTHÈSE 3: Erreur de connexion PostgreSQL

### Vérification
- ✅ `DATABASE_URL` correcte (se termine par `/yukpo`)
- ✅ Format URL valide: `postgresql://user:password@host:port/database`
- ✅ Base de données `yukpo` existe
- ✅ Permissions PostgreSQL correctes
- ✅ Test de connexion depuis EC2 (à faire)

### Conclusion
- ✅ **DATABASE_URL correcte**
- ✅ **Base de données existe**
- ⚠️ **Test de connexion depuis container ECS à faire**

### Action
- Tester la connexion PostgreSQL depuis un container ECS

---

## ✅ HYPOTHÈSE 4: Erreur lors du bind (port 8080)

### Vérification
- ✅ Port 8080 configuré dans la task definition
- ✅ Container Port: 8080
- ✅ Host Port: 8080
- ✅ Protocol: tcp
- ✅ Health check configuré:
  - Command: `curl -f http://localhost:8080/health || exit 1`
  - Interval: 30s
  - Timeout: 10s
  - Start Period: 60s
  - Retries: 3
- ⚠️ Variable `PORT` non définie dans task definition (utilise 8080 par défaut)
- ✅ Variable `PORT` = `8080` dans Secrets Manager

### Conclusion
- ✅ **Port 8080 correctement configuré**
- ✅ **Health check configuré**
- ⚠️ **Variable PORT dans Secrets Manager mais pas dans task definition** (utilise la valeur par défaut)

### Action
- Vérifier que le port 8080 est disponible dans le container

---

## 🎯 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS

### Problème Critique: `MONGODB_URL` Manquante

**Impact**:
1. L'application Rust essaie de se connecter à MongoDB
2. Utilise la valeur par défaut `mongodb://localhost:27017`
3. La connexion échoue (timeout ou erreur)
4. **L'application peut crash si MongoDB est requis**

**Solution**:
1. Ajouter `MONGODB_URL` dans Secrets Manager
2. OU vérifier si MongoDB est vraiment requis au démarrage
3. OU rendre MongoDB complètement optionnel (ne pas crash si échec)

### Autres Problèmes Potentiels

1. **Panic Rust non visible**: Ajouter des logs au début de `main.rs`
2. **Connexion PostgreSQL**: Tester depuis container ECS
3. **Bind port 8080**: Vérifier que le port est disponible

---

## 🔧 ACTIONS RECOMMANDÉES

### Action Immédiate 1: Ajouter MONGODB_URL

```bash
# Récupérer le secret actuel
aws secretsmanager get-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text > secret-current.json

# Ajouter MONGODB_URL (ou laisser vide si non requis)
# Puis mettre à jour le secret
aws secretsmanager put-secret-value \
  --secret-id "yukpo/backend/secrets" \
  --secret-string file://secret-updated.json \
  --region eu-west-1
```

### Action Immédiate 2: Vérifier si MongoDB est Requis

Examiner le code Rust pour voir si MongoDB est requis au démarrage ou optionnel.

### Action Immédiate 3: Ajouter des Logs de Débogage

Modifier `backend/src/main.rs` pour ajouter des logs au tout début:

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ✅ AJOUTER CE LOG AU TOUT DÉBUT
    eprintln!("[MAIN] 🚀 Application Rust démarre...");
    log::info!("[MAIN] 🚀 Application Rust démarre...");
    
    // Vérifier les variables d'environnement
    eprintln!("[MAIN] 🔍 Vérification des variables d'environnement...");
    eprintln!("[MAIN] DATABASE_URL: {}", 
        std::env::var("DATABASE_URL").is_ok());
    eprintln!("[MAIN] MONGODB_URL: {}", 
        std::env::var("MONGODB_URL").is_ok());
    eprintln!("[MAIN] REDIS_URL: {}", 
        std::env::var("REDIS_URL").is_ok());
    
    // ... reste du code
}
```

---

## 📊 CONCLUSION

**Problème Principal Identifié**: `MONGODB_URL` manquante

**Impact**: L'application essaie de se connecter à MongoDB sur `localhost:27017` et échoue, causant probablement un crash.

**Solution**: Ajouter `MONGODB_URL` dans Secrets Manager OU rendre MongoDB complètement optionnel dans le code Rust.

