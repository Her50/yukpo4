# 🚀 Solution Rapide : Créer la Base de Données 'yukpo'

## ⚠️ Problème Actuel

Le backend ne peut pas démarrer car la base de données `yukpo` n'existe pas sur AWS RDS. L'utilisateur `yukpo_admin` n'a pas les permissions SUPERUSER nécessaires pour créer des bases de données.

## ✅ Solution Immédiate (2 minutes)

### Option 1 : Via AWS RDS Query Editor (Recommandé)

1. **Ouvrir AWS Console** :
   - https://console.aws.amazon.com/rds/
   - Région : `eu-west-1` (Irlande)

2. **Sélectionner l'instance RDS** :
   - Instance : `yukpo-db`
   - Endpoint : `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`

3. **Ouvrir Query Editor** :
   - Cliquez sur l'instance `yukpo-db`
   - Onglet "Connectivity & security"
   - Cliquez sur "Query Editor" ou "Query Editor v2"

4. **Se connecter** :
   - Username : `yukpo_admin`
   - Password : Récupérer depuis `infra/aws/terraform.tfvars` (variable `rds_password`)
   - Database : `postgres` (base par défaut)

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

---

### Option 2 : Via Script PowerShell (Windows)

Si vous avez `psql` installé sur Windows :

```powershell
# 1. Récupérer les informations depuis terraform.tfvars
$rdsPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"  # Depuis terraform.tfvars
$rdsEndpoint = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$rdsUsername = "yukpo_admin"

# 2. Construire DATABASE_URL pour la base 'postgres'
$adminDbUrl = "postgresql://${rdsUsername}:${rdsPassword}@${rdsEndpoint}:5432/postgres"

# 3. Exécuter le script
$env:DATABASE_URL = $adminDbUrl
.\scripts\create_database_aws_rds.ps1
```

**Note** : Si le script échoue avec des erreurs de permissions, utilisez l'Option 1 (AWS Console) qui utilise l'utilisateur master.

---

### Option 3 : Via AWS CLI (Si vous avez accès)

```bash
# Récupérer les informations de connexion
aws rds describe-db-instances \
  --db-instance-identifier yukpo-db \
  --region eu-west-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Se connecter via psql (depuis une instance EC2 dans le même VPC)
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"
```

---

## 🔍 Pourquoi la Base n'a pas été Créée Automatiquement ?

Terraform devrait créer la base automatiquement via le paramètre `db_name = "yukpo"` dans `infra/aws/main.tf` (ligne 292). Si elle n'existe pas, cela peut signifier :

1. **Terraform n'a pas été appliqué correctement** :
   ```bash
   cd infra/aws
   terraform plan
   terraform apply
   ```

2. **La base a été supprimée manuellement** :
   - Vérifiez les logs CloudWatch de RDS
   - Vérifiez les snapshots RDS

3. **Problème lors de la création de l'instance RDS** :
   - Vérifiez les événements RDS dans AWS Console
   - Vérifiez que l'instance est dans l'état "available"

---

## ✅ Vérification Post-Création

1. **Vérifier que la base existe** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

2. **Vérifier DATABASE_URL dans AWS Secrets Manager** :
   - Format attendu : `postgresql://yukpo_admin:password@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo`
   - Vérifiez dans AWS Secrets Manager : `yukpo-backend-secrets`

3. **Vérifier les logs du backend** :
   ```bash
   aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
   ```

---

## 📝 Prochaines Étapes

Une fois la base créée :

1. ✅ Le backend devrait démarrer automatiquement
2. ✅ Les migrations s'appliqueront si `ENABLE_AUTO_MIGRATIONS=true`
3. ✅ Vérifiez les logs pour confirmer le démarrage réussi

---

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

---

## 📚 Documentation Complète

- [Guide détaillé](GUIDE_CREATION_DATABASE_AWS_RDS.md)
- [Résolution d'erreurs](RESOLUTION_ERREUR_BASE_DONNEES_YUKPO.md)
- [Problèmes Terraform](PROBLEMES_DEPLOIEMENT_TERRAFORM.md)

