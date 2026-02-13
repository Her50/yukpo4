# 🔧 Guide : Créer la Base de Données 'yukpo' sur AWS RDS

## ⚠️ Problème

Le backend ne peut pas démarrer car la base de données `yukpo` n'existe pas sur l'instance RDS. Le script de démarrage tente de la créer automatiquement, mais l'utilisateur RDS (`yukpo_admin`) n'a pas les permissions SUPERUSER nécessaires pour créer des bases de données.

## ✅ Solution : Créer la Base de Données Manuellement

### Option 1 : Via AWS RDS Query Editor (Recommandé - Plus Simple)

1. **Accéder à AWS Console** :
   - Allez sur https://console.aws.amazon.com/rds/
   - Sélectionnez votre région (eu-west-1)

2. **Ouvrir Query Editor** :
   - Cliquez sur votre instance RDS : `yukpo-db`
   - Dans l'onglet "Connectivity & security", cherchez "Query Editor" ou "Query Editor v2"
   - Si disponible, cliquez dessus

3. **Se connecter** :
   - Utilisez les identifiants de votre instance RDS :
     - Username: `yukpo_admin`
     - Password: (depuis `terraform.tfvars` ou AWS Secrets Manager)
   - Database: `postgres` (base par défaut)

4. **Créer la base de données** :
   ```sql
   CREATE DATABASE yukpo;
   ```

5. **Vérifier** :
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'yukpo';
   ```

### Option 2 : Via psql depuis une Instance EC2 (Si Query Editor non disponible)

Si votre RDS est dans un VPC privé et que Query Editor n'est pas disponible :

1. **Se connecter à une instance EC2** dans le même VPC :
   ```bash
   ssh -i votre-key.pem ec2-user@[IP-EC2]
   ```

2. **Installer psql** :
   ```bash
   sudo yum install postgresql15 -y
   # ou
   sudo apt-get install postgresql-client -y
   ```

3. **Récupérer les informations de connexion** :
   ```bash
   # Depuis terraform.tfvars ou AWS Secrets Manager
   DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
   DB_USER="yukpo_admin"
   DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"  # ⚠️ À récupérer depuis Secrets Manager
   ```

4. **Se connecter et créer la base** :
   ```bash
   PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE yukpo;"
   ```

5. **Vérifier** :
   ```bash
   PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
   ```

### Option 3 : Via ECS Task (Si vous avez déjà un service ECS)

1. **Identifier la tâche ECS** :
   ```bash
   aws ecs list-tasks --cluster yukpo-cluster --region eu-west-1
   ```

2. **Exécuter une commande dans le conteneur** :
   ```bash
   aws ecs execute-command \
     --cluster yukpo-cluster \
     --task <task-id> \
     --container yukpomnang-backend \
     --command "/bin/bash" \
     --interactive \
     --region eu-west-1
   ```

3. **Dans le conteneur, créer la base** :
   ```bash
   # Extraire les composants de DATABASE_URL
   DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
   DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
   DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
   
   # Se connecter à la base postgres et créer yukpo
   PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE yukpo;"
   ```

## 🔍 Vérification

Après avoir créé la base de données, vérifiez que tout fonctionne :

1. **Vérifier que la base existe** :
   ```sql
   SELECT datname, datowner FROM pg_database WHERE datname = 'yukpo';
   ```

2. **Vérifier les permissions** :
   ```sql
   \c yukpo
   SELECT current_database();
   ```

3. **Redémarrer le backend** :
   - Le script `start-cloud.sh` devrait maintenant détecter que la base existe
   - Les migrations devraient s'appliquer automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 📝 Notes Importantes

- ⚠️ **Sécurité** : Ne partagez jamais les mots de passe en clair. Utilisez AWS Secrets Manager.
- ✅ **Terraform** : Normalement, Terraform devrait créer la base automatiquement via le paramètre `db_name`. Si ce n'est pas le cas, vérifiez que Terraform a bien été appliqué.
- 🔄 **Migrations** : Une fois la base créée, les migrations devraient s'appliquer automatiquement au démarrage du backend si `ENABLE_AUTO_MIGRATIONS=true`.

## 🚨 Si le Problème Persiste

Si après avoir créé la base, le backend ne démarre toujours pas :

1. **Vérifier DATABASE_URL** :
   ```bash
   # Depuis AWS Secrets Manager ou SSM Parameter Store
   aws secretsmanager get-secret-value \
     --secret-id yukpo-backend-secrets \
     --region eu-west-1 \
     --query SecretString \
     --output text | jq -r .DATABASE_URL
   ```

2. **Vérifier que DATABASE_URL pointe vers la bonne base** :
   - Format attendu : `postgresql://yukpo_admin:password@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo`

3. **Vérifier les logs ECS** :
   ```bash
   aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
   ```

## 📚 Références

- [AWS RDS Query Editor](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html)
- [PostgreSQL CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html)

