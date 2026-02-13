# 🚀 Créer la Base de Données via AWS CloudShell

## ⚠️ Problème

Le Query Editor AWS ne fonctionne qu'avec Aurora Serverless, pas avec RDS PostgreSQL standard. Votre instance `yukpo-db` est une instance RDS PostgreSQL standard.

## ✅ Solution : Utiliser AWS CloudShell

### Étape 1 : Ouvrir AWS CloudShell

1. Dans la console AWS, cliquez sur l'icône **CloudShell** (icône de terminal) en haut à droite de la barre de navigation
2. Ou allez directement sur : https://console.aws.amazon.com/cloudshell/

### Étape 2 : Installer PostgreSQL Client

Une fois CloudShell ouvert, exécutez :

```bash
# Installer PostgreSQL client
sudo yum install postgresql15 -y
```

### Étape 3 : Se Connecter et Créer la Base

```bash
# Définir le mot de passe
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'

# Se connecter à la base de données
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres
```

### Étape 4 : Créer la Base de Données

Une fois connecté dans psql, exécutez :

```sql
CREATE DATABASE yukpo;
```

### Étape 5 : Vérifier

```sql
SELECT datname FROM pg_database WHERE datname = 'yukpo';
```

Vous devriez voir `yukpo` dans les résultats.

### Étape 6 : Quitter

```sql
\q
```

## ✅ Alternative : Script Complet en Une Commande

Si vous préférez tout faire en une seule fois :

```bash
# Installer PostgreSQL client
sudo yum install postgresql15 -y

# Créer la base de données directement
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"

# Vérifier
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

## 📝 Prochaines Étapes

Une fois la base créée :

1. ✅ Vérifiez que `DATABASE_URL` dans AWS Secrets Manager pointe vers la base `yukpo`
2. ✅ Redémarrez le backend ECS
3. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 🔍 Vérification de DATABASE_URL

Le format attendu dans AWS Secrets Manager :
```
postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo
```

