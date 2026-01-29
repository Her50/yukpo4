# 🔍 Diagnostic Migrations SQLx - Problème SQLX_OFFLINE

## ✅ ÉVOLUTIONS CONSTATÉES

### 1. Erreur PostgreSQL corrigée ✅
- **Commit** : `38ea4ef` - Correction de `block_bus_seat_manually`
- **Avant** : `error: input parameters after one with a default value must also have defaults`
- **Après** : Plus d'erreur PostgreSQL
- **Status** : ✅ Committé et pushé

### 2. Logs de diagnostic ajoutés ✅
- **Fichier** : `backend/src/main.rs`
- **Ajouts** :
  - Log de vérification SQLX_OFFLINE au runtime (ligne 364)
  - Log du working directory (ligne 365)
  - Vérification existence dossier migrations (lignes 448-456)
  - Logs avant/après `sqlx::migrate!()`
- **Status** : ⚠️ Modifications non commitées

### 3. Dockerfile amélioré ✅
- **Fichier** : `backend/Dockerfile.cloud.optimized`
- **Ajout** : Commentaire explicatif sur SQLX_OFFLINE (lignes 118-120)
- **Status** : ⚠️ Modifications non commitées

## ❌ PROBLÈME IDENTIFIÉ : SQLX_OFFLINE défini au runtime

### Cause racine

**SQLX_OFFLINE est défini dans les secrets AWS** (`infra/aws/main.tf` ligne 456) :

```terraform
SQLX_OFFLINE = "true"  # ❌ PROBLÈME : Ne devrait pas être au runtime
```

### Pourquoi c'est un problème

1. **SQLX_OFFLINE est pour la compilation uniquement**
   - Il indique à SQLx d'utiliser le cache `.sqlx/` au lieu de se connecter à la DB
   - Il ne devrait être défini que dans le stage `builder` du Dockerfile

2. **Au runtime, SQLX_OFFLINE ne devrait PAS être défini**
   - `sqlx::migrate!()` doit pouvoir fonctionner normalement
   - Même si SQLX_OFFLINE ne devrait théoriquement pas affecter le runtime, il vaut mieux l'enlever pour éviter tout comportement inattendu

3. **Impact potentiel**
   - Si SQLX_OFFLINE est défini au runtime, SQLx pourrait utiliser un comportement différent
   - Les migrations pourraient ne pas s'exécuter correctement

### Solution

**Retirer SQLX_OFFLINE des secrets AWS** :

```terraform
# infra/aws/main.tf ligne 456
# ❌ AVANT
SQLX_OFFLINE = "true"

# ✅ APRÈS
# SQLX_OFFLINE retiré (ne doit être défini qu'au build dans Dockerfile)
```

## 📊 ÉTAT ACTUEL

### Code de migration dans main.rs

✅ **Présent** (lignes 361-458) :
- Logs de diagnostic ajoutés
- Vérification existence dossier migrations
- Vérification état migrations avant exécution
- Correction préventive migration 0
- Appel `sqlx::migrate!("./migrations")`

### Dockerfile

✅ **Correctement configuré** :
- `SQLX_OFFLINE=true` défini dans le stage `builder` (ligne 13) ✅
- `SQLX_OFFLINE` **NON défini** dans le stage `runtime` ✅
- Commentaire explicatif ajouté (lignes 118-120) ✅

### Terraform AWS

❌ **Problème** :
- `SQLX_OFFLINE = "true"` défini dans les secrets AWS (ligne 456)
- Cette variable est injectée au runtime dans le conteneur ECS
- **À corriger** : Retirer cette ligne

## 🔧 ACTIONS À EFFECTUER

### 1. Retirer SQLX_OFFLINE des secrets AWS

```terraform
# infra/aws/main.tf
resource "aws_secretsmanager_secret_version" "backend_secrets" {
  secret_id = aws_secretsmanager_secret.backend_secrets.id
  secret_string = jsonencode({
    DATABASE_URL = "..."
    REDIS_URL    = "..."
    JWT_SECRET   = var.jwt_secret
    RUST_LOG     = var.rust_log_level
    PORT         = "8080"
    HOST         = "0.0.0.0"
    APP_ENV      = var.environment
    # ❌ RETIRÉ : SQLX_OFFLINE = "true"  # Ne doit être défini qu'au build
    ENABLE_AUTO_MIGRATIONS = "true"
  })
}
```

### 2. Committer les logs de diagnostic

```bash
git add backend/src/main.rs backend/Dockerfile.cloud.optimized
git commit -m "feat: Ajouter logs de diagnostic pour migrations SQLx

- Log SQLX_OFFLINE au runtime
- Log working directory
- Vérification existence dossier migrations
- Commentaire explicatif SQLX_OFFLINE dans Dockerfile"
```

### 3. Appliquer les changements Terraform

```bash
cd infra/aws
terraform plan
terraform apply
```

### 4. Redéployer l'application

Après avoir retiré SQLX_OFFLINE des secrets AWS, redéployer l'application pour que les nouveaux secrets soient pris en compte.

## 🔍 VÉRIFICATIONS POST-CORRECTION

### 1. Vérifier dans les logs AWS

Après redéploiement, vérifier dans CloudWatch que :
- ✅ `🔍 [DIAGNOSTIC] SQLX_OFFLINE au runtime: None` (ou `Some("false")`)
- ✅ `🚀 Application des migrations SQLx standard...`
- ✅ `📁 Dossier migrations trouvé: /app/migrations`
- ✅ `✅ Migrations SQLx standard appliquées avec succès`

### 2. Vérifier que les tables sont créées

Vérifier que les tables suivantes existent :
- `users`
- `services`
- `deliveries`
- `product_creation_queue`
- etc.

## 📝 NOTES

### SQLX_OFFLINE : Build vs Runtime

- **Build** : `SQLX_OFFLINE=true` dans le Dockerfile stage `builder`
  - SQLx utilise le cache `.sqlx/` pour la compilation
  - Pas besoin de connexion DB pendant le build

- **Runtime** : `SQLX_OFFLINE` **NON défini**
  - `sqlx::migrate!()` fonctionne normalement
  - Les migrations peuvent s'exécuter

### Pourquoi retirer SQLX_OFFLINE des secrets AWS

Même si SQLX_OFFLINE ne devrait théoriquement pas affecter le runtime, il vaut mieux :
1. **Éviter toute confusion** : SQLX_OFFLINE = mode offline = pas de connexion DB
2. **Garantir le bon fonctionnement** : `sqlx::migrate!()` doit fonctionner normalement
3. **Respecter les bonnes pratiques** : Variables d'environnement seulement pour ce qui est nécessaire au runtime

