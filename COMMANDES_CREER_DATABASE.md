# 📋 Commandes pour Créer la Base de Données

## ✅ Une Fois Connecté via Session Manager

Exécutez ces commandes dans l'ordre :

### 1. Vérifier que PostgreSQL client est installé

```bash
psql --version
```

Vous devriez voir quelque chose comme `psql (PostgreSQL) 15.x`

### 2. Créer la base de données

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"
```

**Résultat attendu** : `CREATE DATABASE` (sans erreur)

### 3. Vérifier que la base a été créée

```bash
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

**Résultat attendu** : Vous devriez voir `yukpo` dans les résultats

### 4. (Optionnel) Lister toutes les bases de données

```bash
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "\l"
```

Cela affichera toutes les bases de données, y compris `yukpo`.

## ✅ C'est Fait !

Une fois la base créée :

1. ✅ La base `yukpo` existe maintenant sur AWS RDS
2. ✅ Vous pouvez fermer la session Session Manager
3. ✅ Redémarrez le backend ECS - il devrait maintenant démarrer correctement
4. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 🗑️ N'oubliez Pas

Une fois la base créée, supprimez l'instance EC2 temporaire pour éviter les coûts :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform destroy -target="aws_instance.temp_db_creator" -target="aws_security_group.temp_ec2" -target="aws_iam_instance_profile.temp_ec2_ssm" -target="aws_iam_role.temp_ec2_ssm" -auto-approve
```

Ou via AWS Console : EC2 → Instances → Terminate

