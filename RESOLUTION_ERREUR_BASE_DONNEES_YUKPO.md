# 🔧 Résolution : Erreur "Impossible de créer la base 'yukpo'"

## 📋 Problème

Le backend ne peut pas démarrer car la base de données `yukpo` n'existe pas sur l'instance AWS RDS. Le script de démarrage tente de la créer automatiquement, mais échoue avec l'erreur :

```
❌ ERREUR: Impossible de créer la base 'yukpo' (permissions?)
```

## 🔍 Cause

Sur AWS RDS, l'utilisateur créé par Terraform (`yukpo_admin`) n'a pas les privilèges SUPERUSER nécessaires pour créer des bases de données. Seul l'utilisateur master (créé lors de l'initialisation de l'instance RDS) peut créer des bases de données.

**Note** : Normalement, Terraform devrait créer la base de données automatiquement lors de la création de l'instance RDS via le paramètre `db_name`. Si la base n'existe pas, cela peut signifier :
- Terraform n'a pas été appliqué correctement
- La base a été supprimée manuellement
- Il y a eu un problème lors de la création de l'instance RDS

## ✅ Solution Rapide

### Méthode 1 : Via AWS RDS Query Editor (Recommandé - 2 minutes)

1. **Ouvrir AWS Console** :
   - https://console.aws.amazon.com/rds/
   - Région : `eu-west-1` (Irlande)

2. **Sélectionner l'instance RDS** :
   - Instance : `yukpo-db`
   - Endpoint : `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`

3. **Ouvrir Query Editor** :
   - Onglet "Connectivity & security"
   - Cliquez sur "Query Editor" ou "Query Editor v2"

4. **Se connecter** :
   - Username : `yukpo_admin`
   - Password : (récupérer depuis `terraform.tfvars` ou AWS Secrets Manager)
   - Database : `postgres`

5. **Créer la base** :
   ```sql
   CREATE DATABASE yukpo;
   ```

6. **Vérifier** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

7. **Redémarrer le backend** :
   - Le backend devrait maintenant démarrer correctement
   - Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

### Méthode 2 : Via Script Automatique

Si vous avez accès à une instance EC2 dans le même VPC :

```bash
# Récupérer DATABASE_URL depuis AWS Secrets Manager
DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id yukpo-backend-secrets \
  --region eu-west-1 \
  --query SecretString \
  --output text | jq -r .DATABASE_URL)

# Exécuter le script
./scripts/create_database_aws_rds.sh "$DATABASE_URL"
```

### Méthode 3 : Via PowerShell (Windows)

```powershell
# Récupérer DATABASE_URL
$env:DATABASE_URL = "postgresql://yukpo_admin:password@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/postgres"

# Exécuter le script
.\scripts\create_database_aws_rds.ps1
```

## 🔍 Vérification Post-Création

1. **Vérifier que la base existe** :
   ```sql
   \l
   -- ou
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

2. **Vérifier DATABASE_URL** :
   - Format attendu : `postgresql://yukpo_admin:password@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo`
   - Vérifiez dans AWS Secrets Manager ou SSM Parameter Store

3. **Vérifier les logs du backend** :
   ```bash
   aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
   ```

## 📝 Fichiers Créés

- ✅ `GUIDE_CREATION_DATABASE_AWS_RDS.md` - Guide détaillé avec toutes les méthodes
- ✅ `scripts/create_database_aws_rds.sh` - Script bash pour créer la base
- ✅ `scripts/create_database_aws_rds.ps1` - Script PowerShell pour créer la base
- ✅ `backend/scripts/start-cloud.sh` - Amélioré avec messages d'erreur plus clairs

## 🚨 Si le Problème Persiste

1. **Vérifier que Terraform a bien créé l'instance RDS** :
   ```bash
   aws rds describe-db-instances --db-instance-identifier yukpo-db --region eu-west-1
   ```

2. **Vérifier les paramètres Terraform** :
   - `infra/aws/terraform.tfvars` : `rds_database_name = "yukpo"`
   - `infra/aws/main.tf` : Le paramètre `db_name` devrait créer la base automatiquement

3. **Recréer l'instance RDS si nécessaire** :
   ```bash
   cd infra/aws
   terraform destroy -target=aws_db_instance.main
   terraform apply
   ```

## 📚 Documentation

- [Guide complet](GUIDE_CREATION_DATABASE_AWS_RDS.md)
- [Problèmes Terraform](PROBLEMES_DEPLOIEMENT_TERRAFORM.md)

