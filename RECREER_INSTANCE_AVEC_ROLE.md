# 🔧 Recréer l'Instance EC2 avec le Rôle IAM

## ⚠️ Problème

L'instance EC2 actuelle n'a pas le rôle IAM attaché, et on ne peut pas le modifier via la console.

## ✅ Solution : Terminer et Recréer l'Instance

### Étape 1 : Terminer l'Instance Actuelle

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance** : `yukpo-temp-db-creator` (ID: `i-0b9ad404f8d738d04`)
3. **Actions** → **Instance State** → **Terminate Instance**
4. **Confirmez** la suppression

Attendez que l'instance soit complètement terminée (statut : "terminated").

### Étape 2 : Recréer l'Instance avec Terraform

Une fois l'instance terminée, exécutez :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform apply -target="aws_instance.temp_db_creator" -auto-approve
```

Cette fois, l'instance sera créée **avec le rôle IAM déjà attaché** dès le départ.

### Étape 3 : Vérifier Session Manager

1. **Attendez 2-3 minutes** que l'instance soit prête
2. **Allez dans EC2** → **Instances** → Sélectionnez la nouvelle instance
3. **Cliquez sur "Connect"** → **Session Manager**
4. Le statut devrait être **"En ligne"** (Online) ✅
5. **Cliquez sur "Connect"** pour vous connecter

### Étape 4 : Créer la Base de Données

Une fois connecté, exécutez :

```bash
# Vérifier que PostgreSQL client est installé
psql --version

# Créer la base de données
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

## ✅ Alternative : Utiliser AWS CLI (Si Disponible)

Si vous avez AWS CLI configuré avec les bonnes permissions :

```bash
# Terminer l'instance
aws ec2 terminate-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1

# Attendre que l'instance soit terminée
aws ec2 wait instance-terminated --instance-ids i-0b9ad404f8d738d04 --region eu-west-1

# Recréer avec Terraform
cd C:\Users\23767\yukpomnang2\infra\aws
terraform apply -target="aws_instance.temp_db_creator" -auto-approve
```

