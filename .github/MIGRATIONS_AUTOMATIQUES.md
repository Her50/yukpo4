# 🔄 Migrations Automatiques dans GitHub Actions

## 🎯 Vue d'ensemble

Les migrations de base de données sont maintenant **automatiquement exécutées** avant chaque build sur AWS. Le workflow GitHub Actions vérifie et applique les migrations manquantes directement sur AWS RDS avant de construire l'image Docker.

## 🔄 Flux d'exécution

```
1. Push sur main/master
   ↓
2. Job "run-migrations" s'exécute :
   ├─ Récupère DATABASE_URL depuis AWS SSM Parameter Store
   ├─ Vérifie l'état des migrations via sqlx migrate info
   ├─ Applique les migrations manquantes via sqlx migrate run
   └─ Continue même si certaines migrations sont déjà appliquées
   ↓
3. Job "build-and-push" s'exécute (seulement si migrations OK)
   ↓
4. Job "push-to-aws" s'exécute
   ↓
5. Job "deploy-to-ecs" s'exécute
```

## 📋 Configuration

### Variables d'environnement

Le workflow utilise ces variables (définies dans `.github/workflows/docker-build-optimized.yml`) :

- `SSM_DATABASE_URL_PATH` : Chemin du paramètre SSM pour DATABASE_URL (défaut: `/yukpomnang/production/DATABASE_URL`)
- `AWS_REGION` : Région AWS (défaut: `us-east-1`)

### Secrets GitHub requis

Les mêmes secrets que pour le déploiement ECS :
- `AWS_ACCESS_KEY_ID` : Clé d'accès AWS
- `AWS_SECRET_ACCESS_KEY` : Clé secrète AWS

## 🔧 Script Python

Le script `scripts/run_migrations_aws.py` :

1. **Récupère DATABASE_URL** depuis AWS SSM Parameter Store
2. **Vérifie sqlx-cli** et l'installe si nécessaire
3. **Vérifie l'état des migrations** via `sqlx migrate info`
4. **Applique les migrations manquantes** via `sqlx migrate run`

### Utilisation manuelle

Vous pouvez aussi exécuter le script manuellement :

```bash
# Depuis la racine du projet
export AWS_REGION=us-east-1
export SSM_DATABASE_URL_PATH=/yukpomnang/production/DATABASE_URL
python3 scripts/run_migrations_aws.py
```

### Dépendances Python

Les dépendances sont dans `scripts/requirements.txt` :
- `boto3` : Pour accéder à AWS SSM
- `psycopg2-binary` : Pour la connexion PostgreSQL (optionnel, utilisé pour vérifications)

## ✅ Avantages

1. **Automatique** : Plus besoin d'exécuter les migrations manuellement
2. **Sécurisé** : DATABASE_URL récupéré depuis SSM (chiffré)
3. **Idempotent** : Les migrations déjà appliquées sont ignorées
4. **Robuste** : Gestion d'erreur avec continuation du workflow
5. **Traçable** : Logs détaillés dans GitHub Actions

## 🔍 Vérification

### Dans GitHub Actions

1. Allez dans **Actions** > **Docker Build Optimized**
2. Cliquez sur le workflow en cours
3. Vérifiez le job **"Run Database Migrations"**
4. Les logs affichent :
   - ✅ Récupération de DATABASE_URL depuis SSM
   - ✅ Vérification de l'état des migrations
   - ✅ Application des migrations manquantes

### Logs attendus

```
🔍 Récupération de DATABASE_URL depuis SSM: /yukpomnang/production/DATABASE_URL
✅ DATABASE_URL récupérée depuis SSM
🔍 Vérification de l'état des migrations...
✅ sqlx-cli installé: sqlx-cli 0.7.3
🚀 Exécution des migrations...
✅ Migrations exécutées avec succès
```

## ⚠️ Comportement en cas d'erreur

### Migrations déjà appliquées

Si une migration est déjà appliquée, sqlx l'ignore automatiquement. Le workflow continue normalement.

### Erreur de connexion (VPC privé)

**Situation courante** : Si la base de données RDS est dans un VPC privé et non accessible depuis GitHub Actions :

- Le script détecte l'erreur de connexion après plusieurs tentatives (3 retries)
- Le script affiche un message explicatif
- **Le workflow continue normalement** (ne bloque pas le build)
- **Les migrations seront exécutées automatiquement au démarrage de l'application ECS**

**Pourquoi ?**
- GitHub Actions s'exécute sur des runners publics
- La base de données RDS est dans un VPC privé pour la sécurité
- L'application ECS a accès à la base via le VPC
- Les migrations s'exécutent déjà au démarrage de l'app (voir `main.rs`)

**Configuration** :
- `FAIL_ON_MIGRATION_ERROR=false` (par défaut) : Le build continue même si les migrations échouent
- `FAIL_ON_MIGRATION_ERROR=true` : Le build s'arrête si les migrations échouent

### Timeout

Si l'exécution des migrations prend trop de temps (> 10 minutes) :
- Le script fait 3 tentatives avec délai exponentiel
- Si toutes les tentatives échouent, le workflow continue (si `FAIL_ON_MIGRATION_ERROR=false`)
- Les migrations seront exécutées au démarrage ECS

## 🔄 Migrations automatiques (auto_migrate.rs)

**Note importante** : Les migrations SQLx standard sont exécutées par ce script. Les migrations automatiques (dans `auto_migrate.rs`) sont toujours exécutées au démarrage de l'application si `ENABLE_AUTO_MIGRATIONS=true`.

### Ordre d'exécution

1. **GitHub Actions** : Exécute les migrations SQLx standard (`backend/migrations/*.sql`)
2. **Au démarrage de l'application** : Exécute les migrations automatiques si `ENABLE_AUTO_MIGRATIONS=true`

## 📝 Notes

- Le job `run-migrations` ne s'exécute que sur les pushes vers `main` ou `master`
- Pour les pull requests, les migrations ne sont pas exécutées (sécurité)
- Le script vérifie toujours l'état avant d'appliquer les migrations
- Les migrations sont appliquées dans l'ordre chronologique (par nom de fichier)

## 🐛 Dépannage

### Le script ne trouve pas DATABASE_URL

**Vérifier** :
1. Le paramètre SSM existe : `/yukpomnang/production/DATABASE_URL`
2. Les credentials AWS sont corrects dans GitHub Secrets
3. La région AWS est correcte (`us-east-1`)

**Solution** :
```bash
# Vérifier le paramètre SSM
aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1
```

### sqlx-cli n'est pas installé

Le script installe automatiquement sqlx-cli via cargo. Si l'installation échoue :
- Vérifiez que Rust est installé dans le workflow
- Vérifiez les logs d'installation pour plus de détails

### Migrations échouent

**Vérifier** :
1. La connexion à la base de données fonctionne
2. Les migrations SQL sont valides
3. Les permissions de la base de données sont correctes

**Solution** :
- Vérifiez les logs détaillés dans GitHub Actions
- Testez les migrations localement avec `sqlx migrate run`

