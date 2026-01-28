# 🔍 Analyse du problème : Pourquoi les migrations ne s'exécutent pas dans AWS PostgreSQL

## 📋 Problème identifié

Les tables manquent toujours dans la base de données malgré :
- ✅ Configuration de `ENABLE_AUTO_MIGRATIONS = "true"` dans Terraform
- ✅ Injection dans ECS via Secrets Manager
- ✅ Code d'exécution des migrations au démarrage

## 🔍 Analyse du code

### 1. Exécution des migrations SQLx standard (main.rs:359)

```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
    }
    Err(e) => {
        // ⚠️ PROBLÈME : L'application continue même si les migrations échouent !
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        log::debug!("ℹ️ Continuation du démarrage malgré l'erreur de migration");
    }
}
```

**Problème** : Si les migrations SQLx échouent, l'application continue quand même. Les erreurs sont seulement loggées.

### 2. Exécution des migrations automatiques (main.rs:397)

```rust
if enable_auto_migrations {
    log::info!("🔄 Exécution des migrations automatiques (ENABLE_AUTO_MIGRATIONS=true)...");
    yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;
} else {
    log::info!("⏭️ Migrations automatiques désactivées");
}
```

**Problème** : Si `ENABLE_AUTO_MIGRATIONS` n'est pas correctement récupéré depuis Secrets Manager, les migrations automatiques ne s'exécutent pas.

## 🎯 Causes possibles

### Cause 1 : Les migrations SQLx échouent silencieusement

**Symptômes** :
- Les logs CloudWatch montrent : `❌ Erreur lors de l'application des migrations SQLx standard`
- L'application démarre quand même
- Les tables ne sont pas créées

**Causes possibles** :
1. **Problème de connexion à la base de données** au moment du démarrage
2. **Permissions insuffisantes** pour créer des tables
3. **Erreurs SQL** dans les fichiers de migration
4. **Timeout** lors de l'exécution des migrations
5. **Checksum mismatch** pour certaines migrations

### Cause 2 : ENABLE_AUTO_MIGRATIONS n'est pas correctement récupéré

**Symptômes** :
- Les logs montrent : `⏭️ Migrations automatiques désactivées`
- La valeur dans Secrets Manager est "true" mais n'est pas parsée correctement

**Causes possibles** :
1. **Secrets Manager non accessible** depuis ECS
2. **Format incorrect** dans Secrets Manager (espaces, guillemets, etc.)
3. **Permissions IAM insuffisantes** pour accéder à Secrets Manager
4. **Task definition non mise à jour** après modification Terraform

### Cause 3 : Les migrations automatiques échouent silencieusement

**Symptômes** :
- Les logs montrent : `🔄 Exécution des migrations automatiques`
- Mais les tables ne sont pas créées
- Pas d'erreurs visibles dans les logs

**Causes possibles** :
1. **Erreurs dans `run_auto_migrations`** qui sont catchées mais pas loggées
2. **Problèmes de connexion** pendant l'exécution
3. **Timeouts** lors de la création des tables

## 🔧 Solutions

### Solution 1 : Vérifier les logs CloudWatch au démarrage

Chercher dans les logs CloudWatch de l'application ECS :
- `🚀 Application des migrations SQLx standard...`
- `✅ Migrations SQLx standard appliquées avec succès` OU `❌ Erreur lors de l'application`
- `🔍 ENABLE_AUTO_MIGRATIONS: raw='...', parsed=...`
- `🔄 Exécution des migrations automatiques` OU `⏭️ Migrations automatiques désactivées`

### Solution 2 : Vérifier ENABLE_AUTO_MIGRATIONS dans Secrets Manager

```powershell
.\scripts\check-enable-auto-migrations.ps1
```

### Solution 3 : Vérifier les permissions IAM

Vérifier que le rôle ECS execution a les permissions :
- `secretsmanager:GetSecretValue`
- `secretsmanager:DescribeSecret`

### Solution 4 : Exécuter les migrations manuellement

Utiliser la tâche ECS one-shot créée ou exécuter directement depuis ECS Exec.

## 📊 Diagnostic recommandé

1. **Vérifier les logs CloudWatch** au démarrage de l'application
2. **Vérifier ENABLE_AUTO_MIGRATIONS** dans Secrets Manager
3. **Vérifier les permissions IAM** pour Secrets Manager
4. **Vérifier la task definition** pour confirmer que le secret est bien injecté
5. **Exécuter les migrations manuellement** pour contourner le problème

## 🎯 Action immédiate

**Vérifier les logs CloudWatch** pour voir exactement ce qui se passe au démarrage de l'application.

