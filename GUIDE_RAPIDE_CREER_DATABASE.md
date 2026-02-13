# 🚀 Guide Rapide : Créer la Base de Données 'yukpo' sur AWS RDS

## ⚠️ Problème Actuel

Le backend ne peut pas démarrer car la base de données `yukpo` n'existe pas. L'utilisateur `yukpo_admin` n'a pas les permissions SUPERUSER nécessaires pour créer des bases de données automatiquement.

## ✅ Solution Immédiate (2 minutes)

### Option 1 : Via AWS RDS Query Editor (Recommandé - Le Plus Rapide)

1. **Ouvrir AWS Console** :
   - URL : https://console.aws.amazon.com/rds/
   - Région : **eu-west-1** (Irlande)

2. **Sélectionner l'instance RDS** :
   - Instance : `yukpo-db`
   - Endpoint : `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`

3. **Ouvrir Query Editor** :
   - Cliquez sur l'instance `yukpo-db`
   - Onglet **"Connectivity & security"**
   - Cliquez sur **"Query Editor"** ou **"Query Editor v2"**

4. **Se connecter** :
   - **Username** : `yukpo_admin`
   - **Password** : `PYvHBVetTuWIKNkXgqJcFiU48D39SLwd` (depuis `infra/aws/terraform.tfvars`)
   - **Database** : `postgres` (base par défaut)

5. **Créer la base** :
   ```sql
   CREATE DATABASE "yukpo";
   ```

6. **Vérifier** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```
   Vous devriez voir `yukpo` dans les résultats.

7. **Redémarrer le backend** :
   - Le backend devrait maintenant démarrer correctement
   - Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

---

### Option 2 : Via Script PowerShell (Si psql est installé)

```powershell
# Depuis le répertoire racine du projet
.\scripts\create-database-now-simple.ps1
```

**Note** : Si le script échoue avec des erreurs de permissions, utilisez l'Option 1 (AWS Console).

---

## 🔍 Pourquoi la Base n'a pas été Créée Automatiquement ?

Terraform devrait créer la base automatiquement via le paramètre `db_name = "yukpo"` dans `infra/aws/main.tf` (ligne 301). Si elle n'existe pas, cela peut signifier :

1. **L'instance RDS a été créée avant que le paramètre `db_name` ne soit ajouté**
2. **Un problème lors de la création de l'instance RDS**
3. **La base a été supprimée manuellement**

### Vérifier l'état de l'instance RDS

```bash
aws rds describe-db-instances \
  --db-instance-identifier yukpo-db \
  --region eu-west-1 \
  --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address,MasterUsername]' \
  --output table
```

### Recréer l'instance RDS si nécessaire

Si l'instance n'a pas le paramètre `db_name`, vous pouvez :

1. **Modifier Terraform pour forcer la recréation** :
   ```bash
   cd infra/aws
   terraform taint aws_db_instance.main
   terraform apply
   ```
   ⚠️ **Attention** : Cela supprimera et recréera l'instance RDS (perte de données si pas de backup)

2. **Ou simplement créer la base manuellement** (recommandé) :
   - Utilisez l'Option 1 ci-dessus (AWS Console)

---

## ✅ Vérification Post-Création

1. **Vérifier que la base existe** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

2. **Vérifier DATABASE_URL dans AWS Secrets Manager** :
   - Format attendu : `postgresql://yukpo_admin:password@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo`
   - Vérifiez dans AWS Secrets Manager : `yukpo-backend-secrets`
   - Si nécessaire, mettez à jour le secret :
     ```bash
     aws secretsmanager update-secret \
       --secret-id yukpo-backend-secrets \
       --secret-string file://secrets.json \
       --region eu-west-1
     ```

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

3. **Vérifier les événements RDS** :
   - Dans AWS Console, allez dans l'onglet "Logs & events" de l'instance RDS
   - Vérifiez s'il y a des erreurs lors de la création

---

## 📚 Documentation Complète

- [Solution détaillée](SOLUTION_RAPIDE_CREATION_DATABASE.md)
- [Résolution d'erreurs](RESOLUTION_ERREUR_BASE_DONNEES_YUKPO.md)
- [Problèmes Terraform](PROBLEMES_DEPLOIEMENT_TERRAFORM.md)

