# ✅ Activation Migrations SQLx sur Cloud Run

**Date**: 2026-02-15  
**Statut**: ✅ **Code modifié et prêt**

---

## ✅ Modification du Code

### Changement Effectué

**Fichier** : `backend/src/main.rs` (ligne ~596)

**Avant** :
```rust
if !is_cloud_run {
    // Migrations SQLx standard
    sqlx::migrate!("./migrations").run(&pg_pool).await
}
```

**Après** :
```rust
let enable_sqlx_migrations = env::var("ENABLE_SQLX_MIGRATIONS")
    .unwrap_or_else(|_| "false".to_string())
    .parse::<bool>()
    .unwrap_or(false);

let should_run_sqlx_migrations = !is_cloud_run || enable_sqlx_migrations;

if should_run_sqlx_migrations {
    if is_cloud_run && enable_sqlx_migrations {
        log::info!("🚀 Cloud Run: Application des migrations SQLx standard (ENABLE_SQLX_MIGRATIONS=true)...");
    } else {
        log::info!("🚀 Application des migrations SQLx standard...");
    }
    // ... exécution des migrations
}
```

---

## 🔧 Activation sur Cloud Run

### Étape 1 : Ajouter la Variable d'Environnement

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="ENABLE_SQLX_MIGRATIONS=true" \
  --project=yukpo-project
```

### Étape 2 : Vérifier les Logs

Après le déploiement, vérifier les logs pour confirmer l'exécution :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'Migrations SQLx\|migration appliquee'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
🚀 Cloud Run: Application des migrations SQLx standard (ENABLE_SQLX_MIGRATIONS=true)...
✅ Migrations SQLx standard appliquées avec succès
```

---

## ⚠️ Important

### Première Exécution

**Les migrations SQLx doivent être exécutées au moins une fois pour créer les tables de base.**

1. **Activer temporairement** `ENABLE_SQLX_MIGRATIONS=true`
2. **Déployer** le service Cloud Run
3. **Vérifier** que les migrations ont été appliquées
4. **Optionnel** : Désactiver après la première exécution (les migrations automatiques prendront le relais)

### Comportement

- **Développement local** : Migrations SQLx toujours exécutées (indépendamment de la variable)
- **Cloud Run avec `ENABLE_SQLX_MIGRATIONS=true`** : Migrations SQLx exécutées
- **Cloud Run avec `ENABLE_SQLX_MIGRATIONS=false` ou non défini** : Migrations SQLx désactivées (comportement par défaut)

### Sécurité

- Les migrations SQLx sont **idempotentes** (peuvent être exécutées plusieurs fois)
- SQLx vérifie automatiquement quelles migrations ont déjà été appliquées
- Seules les nouvelles migrations seront exécutées

---

## 📋 Checklist

- [x] **Code modifié** : `backend/src/main.rs`
- [x] **Variable d'environnement** : `ENABLE_SQLX_MIGRATIONS` ajoutée
- [ ] **Variable configurée** : À ajouter dans Cloud Run
- [ ] **Première exécution** : À tester après déploiement
- [ ] **Vérification** : Tables créées dans Cloud SQL

---

## 🚀 Prochaines Étapes

1. **Ajouter la variable dans Cloud Run** :
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="ENABLE_SQLX_MIGRATIONS=true" \
  --project=yukpo-project
```

2. **Déployer le code modifié** (via GitHub Actions ou manuellement)

3. **Vérifier les logs** pour confirmer l'exécution des migrations

4. **Vérifier le schéma** :
```bash
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```
Puis dans psql :
```sql
\i scripts/verifier-schema-postgres-sql.sql
```

---

**✅ Code modifié et prêt !**

Les migrations SQLx peuvent maintenant s'exécuter sur Cloud Run en définissant `ENABLE_SQLX_MIGRATIONS=true`.



