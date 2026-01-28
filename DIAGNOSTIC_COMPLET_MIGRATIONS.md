# 🔍 Diagnostic complet : Pourquoi les migrations ne s'exécutent pas

## ✅ PROBLÈME IDENTIFIÉ

### Incohérence entre Terraform et la Task Definition réelle

1. **Terraform configure** `ENABLE_AUTO_MIGRATIONS` dans **Secrets Manager** (ligne 457 de `infra/aws/main.tf`)
2. **La task definition réelle** récupère `ENABLE_AUTO_MIGRATIONS` depuis **SSM Parameter Store** (`arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/ENABLE_AUTO_MIGRATIONS`)

**Résultat** : La valeur dans Secrets Manager n'est jamais utilisée !

## 🎯 Causes racines identifiées

### Cause 1 : Les migrations SQLx peuvent échouer silencieusement

**Code dans `main.rs:359-379`** :
```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => log::info!("✅ Migrations SQLx standard appliquées avec succès"),
    Err(e) => {
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        // ⚠️ PROBLÈME : L'application continue même si les migrations échouent !
        log::debug!("ℹ️ Continuation du démarrage malgré l'erreur de migration");
    }
}
```

**Impact** : Si les migrations SQLx échouent (connexion, permissions, erreurs SQL), l'application démarre quand même sans créer les tables.

### Cause 2 : ENABLE_AUTO_MIGRATIONS peut ne pas être correctement récupéré

**Problème** : La task definition utilise SSM Parameter Store, mais Terraform configure Secrets Manager.

**Impact** : Si la valeur dans SSM n'est pas "true", les migrations automatiques ne s'exécutent pas.

### Cause 3 : Les migrations automatiques peuvent échouer silencieusement

**Code dans `main.rs:399`** :
```rust
yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;
```

**Impact** : Si `run_auto_migrations` échoue, l'erreur peut ne pas être visible dans les logs.

## 🔧 Solutions

### Solution 1 : Corriger la task definition pour utiliser Secrets Manager

La task definition doit être mise à jour pour utiliser Secrets Manager au lieu de SSM Parameter Store :

```json
{
  "name": "ENABLE_AUTO_MIGRATIONS",
  "valueFrom": "arn:aws:secretsmanager:us-east-1:846505724644:secret:yukpomnang/backend/secrets:ENABLE_AUTO_MIGRATIONS::"
}
```

### Solution 2 : S'assurer que SSM Parameter Store a la bonne valeur

Si la task definition utilise SSM, s'assurer que la valeur est "true" :

```powershell
aws ssm put-parameter `
  --name /yukpomnang/production/ENABLE_AUTO_MIGRATIONS `
  --value "true" `
  --type String `
  --region us-east-1 `
  --overwrite
```

### Solution 3 : Vérifier les logs CloudWatch au démarrage

Chercher dans les logs :
- `🚀 Application des migrations SQLx standard...`
- `✅ Migrations SQLx standard appliquées` OU `❌ Erreur lors de l'application`
- `🔍 ENABLE_AUTO_MIGRATIONS: raw='...', parsed=...`
- `🔄 Exécution des migrations automatiques` OU `⏭️ Migrations automatiques désactivées`

### Solution 4 : Exécuter les migrations manuellement

Utiliser la tâche ECS one-shot créée pour contourner le problème immédiatement.

## 📊 Actions immédiates

1. ✅ **Vérifier la valeur dans SSM Parameter Store** (déjà fait : "true")
2. ✅ **Créer/mettre à jour ENABLE_AUTO_MIGRATIONS dans SSM** (déjà fait)
3. ⏳ **Redémarrer l'application ECS** pour que la nouvelle valeur soit prise en compte
4. ⏳ **Vérifier les logs CloudWatch** pour confirmer l'exécution des migrations
5. ⏳ **Vérifier que les tables sont créées** après le redémarrage

## 🔄 Prochaines étapes

1. Redémarrer le service ECS pour prendre en compte la valeur SSM mise à jour
2. Vérifier les logs CloudWatch pour confirmer que les migrations s'exécutent
3. Si les migrations SQLx échouent toujours, vérifier les erreurs dans les logs
4. Si nécessaire, exécuter les migrations manuellement via la tâche ECS one-shot

