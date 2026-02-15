# ✅ Exécuter les Migrations SQLx Maintenant

**Date**: 2026-02-15  
**Objectif**: Exécuter les migrations SQLx au moins une fois pour créer les tables de base dans Cloud SQL

---

## ✅ Configuration Actuelle

- **Instance Cloud SQL** : `yukpo-postgres`
- **Database** : `yukpo_db`
- **User** : `yukpo_user`
- **IP Publique** : `34.79.199.41`
- **ENABLE_SQLX_MIGRATIONS** : `true` (déjà configuré dans Cloud Run)

---

## 🚀 Méthode 1 : Via cargo sqlx migrate run (Recommandé)

### Étape 1 : Installer sqlx-cli (si nécessaire)

```powershell
cargo install sqlx-cli --version 0.8.6 --no-default-features --features postgres --locked
```

**Note** : Cela peut prendre 5-10 minutes la première fois.

### Étape 2 : Configurer DATABASE_URL

```powershell
$env:DATABASE_URL="postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@34.79.199.41:5432/yukpo_db?sslmode=require"
```

**Important** : Remplacez `VOTRE_MOT_DE_PASSE` par le mot de passe réel.

### Étape 3 : Exécuter les migrations

```powershell
cd backend
cargo sqlx migrate run
```

**Résultat attendu** :
```
Applied migration 00000001_create_extensions
Applied migration 00000002_create_base_tables
Applied migration 00000003_create_utility_tables
...
✅ Migrations appliquées avec succès
```

---

## 🚀 Méthode 2 : Via gcloud sql connect (Alternative)

### Étape 1 : Se connecter à Cloud SQL

```bash
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```

### Étape 2 : Exécuter les migrations principales

Dans psql, exécutez les migrations dans l'ordre :

```sql
-- Vérifier l'état actuel
SELECT COUNT(*) FROM _sqlx_migrations;

-- Si la table est vide, exécuter les migrations principales
\i backend/migrations/00000001_create_extensions.sql
\i backend/migrations/00000002_create_base_tables.sql
\i backend/migrations/00000003_create_utility_tables.sql
\i backend/migrations/00000004_create_payment_tables.sql
\i backend/migrations/00000005_create_autocomplete_tables.sql
\i backend/migrations/00000006_create_product_tables.sql
\i backend/migrations/00000007_create_review_tables.sql
\i backend/migrations/00000008_create_delivery_tables.sql
\i backend/migrations/00000009_create_specialized_services_tables.sql
\i backend/migrations/00000010_create_functions.sql
\i backend/migrations/00000011_create_indexes_and_optimizations.sql
```

**Note** : Il y a 362 fichiers de migration. Vous pouvez exécuter les principales d'abord, puis laisser les migrations automatiques gérer le reste.

---

## ✅ Vérification

### Vérifier que les migrations ont été appliquées

```sql
-- Compter les migrations appliquées
SELECT COUNT(*) FROM _sqlx_migrations;

-- Voir les dernières migrations
SELECT version, description, installed_on 
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;
```

### Vérifier que les tables principales existent

```sql
-- Lister toutes les tables
\dt

-- Vérifier les tables critiques
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'services', 'deliveries', 'orders', 'products')
ORDER BY table_name;
```

---

## ⚠️ Important

### Autorisation IP Publique

**Avant d'exécuter les migrations**, assurez-vous que votre IP publique est autorisée dans Cloud SQL :

1. **Récupérer votre IP publique** :
```powershell
Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing | Select-Object -ExpandProperty Content
```

2. **Autoriser l'IP dans Cloud SQL** :
```bash
gcloud sql instances patch yukpo-postgres \
  --authorized-networks=VOTRE_IP_PUBLIQUE/32 \
  --project=yukpo-project
```

---

## 📋 Checklist

- [ ] **sqlx-cli installé** : `cargo sqlx --version`
- [ ] **IP publique autorisée** : Dans Cloud SQL authorized networks
- [ ] **DATABASE_URL configurée** : Avec mot de passe correct
- [ ] **Migrations exécutées** : `cargo sqlx migrate run`
- [ ] **Vérification** : Tables créées dans Cloud SQL
- [ ] **ENABLE_SQLX_MIGRATIONS** : `true` dans Cloud Run (déjà fait)

---

## 🚀 Après l'Exécution

Une fois les migrations exécutées :

1. **Vérifier les logs Cloud Run** pour confirmer que les migrations ne sont plus nécessaires
2. **Optionnel** : Désactiver `ENABLE_SQLX_MIGRATIONS` après la première exécution
3. **Les migrations automatiques** prendront le relais pour les futures migrations

---

**✅ Prêt à exécuter les migrations !**

Utilisez la **Méthode 1** (cargo sqlx migrate run) pour une exécution automatique de toutes les migrations.


