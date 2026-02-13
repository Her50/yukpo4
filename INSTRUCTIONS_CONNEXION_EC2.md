# 🚀 Instructions : Se Connecter à l'Instance EC2 et Créer la Base

## ✅ Instance EC2 Créée avec Succès !

- **IP Publique** : `52.17.27.232`
- **Instance ID** : `i-0b9ad404f8d738d04`
- **Type** : `t3.micro` (Amazon Linux 2023)

## 📋 Étape 1 : Attendre l'Initialisation (2-3 minutes)

L'instance installe automatiquement PostgreSQL client. Attendez 2-3 minutes avant de vous connecter.

## 📋 Étape 2 : Se Connecter à l'Instance EC2

### Option A : Via AWS Systems Manager Session Manager (Recommandé - Pas besoin de clé SSH)

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance** : `yukpo-temp-db-creator`
3. **Cliquez sur "Connect"** (en haut)
4. **Onglet "Session Manager"**
5. **Cliquez sur "Connect"**

Vous serez connecté directement dans un terminal !

### Option B : Via SSH (Si vous avez une clé SSH)

```bash
ssh ec2-user@52.17.27.232
```

## 📋 Étape 3 : Créer la Base de Données

Une fois connecté à l'instance EC2, exécutez ces commandes :

```bash
# Vérifier que PostgreSQL client est installé
psql --version

# Créer la base de données
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "CREATE DATABASE yukpo;"
```

### Vérifier que la base a été créée :

```bash
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT datname FROM pg_database WHERE datname = 'yukpo';"
```

Vous devriez voir `yukpo` dans les résultats.

## 📋 Étape 4 : Supprimer l'Instance EC2

**IMPORTANT** : Une fois la base créée, supprimez l'instance pour éviter les coûts :

```bash
cd C:\Users\23767\yukpomnang2\infra\aws
terraform destroy -target=aws_instance.temp_db_creator -target=aws_security_group.temp_ec2 -auto-approve
```

Ou via AWS Console :
1. EC2 → Instances
2. Sélectionnez `yukpo-temp-db-creator`
3. Actions → Instance State → Terminate

## ✅ Prochaines Étapes

Une fois la base créée :

1. ✅ Vérifiez que `DATABASE_URL` dans AWS Secrets Manager pointe vers la base `yukpo`
2. ✅ Redémarrez le backend ECS
3. ✅ Les migrations s'appliqueront automatiquement si `ENABLE_AUTO_MIGRATIONS=true`

## 🔍 Vérification de DATABASE_URL

Le format attendu dans AWS Secrets Manager :
```
postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo
```

