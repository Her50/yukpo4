# 🔍 Vérifier les Permissions sur la Base de Données

## ⚠️ Problème Identifié

Les tâches ECS échouent les health checks, probablement parce que l'application ne peut pas se connecter à la base `yukpo` ou n'a pas les permissions nécessaires.

## 📋 Solution : Vérifier et Donner les Permissions

### 1. Connectez-vous à l'Instance EC2 via Session Manager

1. **AWS Console** → **EC2** → **Instances**
2. Sélectionnez l'instance `yukpo-temp-db-creator`
3. **Connect** → **Session Manager** → **Connect**

### 2. Vérifiez l'Accès à la Base

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT current_database(), current_user, version();"
```

### 3. Si l'Accès Fonctionne, Donnez les Permissions Complètes

```bash
# Se connecter à la base postgres pour donner les permissions
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "GRANT ALL PRIVILEGES ON DATABASE yukpo TO yukpo_admin;"

# Se connecter à la base yukpo pour donner les permissions sur les schémas
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yukpo_admin;"

psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yukpo_admin;"

# Donner les permissions pour les futures tables
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO yukpo_admin;"

psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO yukpo_admin;"
```

### 4. Vérifiez le DATABASE_URL dans AWS Secrets Manager

Assurez-vous que `DATABASE_URL` se termine par `/yukpo` et non `/postgres` :

1. **AWS Console** → **Secrets Manager**
2. Sélectionnez le secret `yukpo/backend/secrets`
3. **Retrieve secret value**
4. Vérifiez que `DATABASE_URL` contient :
   ```
   postgresql://yukpo_admin:PASSWORD@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo
   ```

### 5. Redémarrez le Service ECS

Après avoir donné les permissions, forcez un nouveau déploiement :

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

## 🔍 Diagnostic

Si l'application ne démarre toujours pas, vérifiez les logs CloudWatch pour voir l'erreur exacte :

1. **CloudWatch** → **Log groups** → `/ecs/yukpo-backend`
2. **Sélectionnez le log stream le plus récent**
3. **Cherchez les erreurs** commençant par `❌` ou `ERROR`

