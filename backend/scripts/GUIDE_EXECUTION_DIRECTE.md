# 🚀 Guide : Exécution Directe des Scripts sur AWS

## ✅ Solution la Plus Simple : AWS CloudShell

AWS CloudShell a **automatiquement accès au VPC** et peut se connecter à RDS.

### Étapes :

1. **Ouvrir AWS CloudShell** :
   - Allez sur https://console.aws.amazon.com/cloudshell/home
   - Ou dans la console AWS, cliquez sur l'icône CloudShell en haut à droite

2. **Dans CloudShell, exécutez** :

```bash
# Cloner le repo (remplacez par votre URL)
git clone <votre-repo-url> ~/yukpomnang2
cd ~/yukpomnang2/backend/scripts

# OU téléchargez directement les scripts SQL
# wget https://raw.githubusercontent.com/.../diagnostic_migrations_aws.sql
# wget https://raw.githubusercontent.com/.../fix_migrations_aws.sql

# Installer PostgreSQL client si nécessaire
sudo yum install -y postgresql15 || sudo apt-get update && sudo apt-get install -y postgresql-client

# Exécuter les scripts
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"

# Diagnostic
psql "$DATABASE_URL" -f diagnostic_migrations_aws.sql

# Correction (après vérification)
psql "$DATABASE_URL" -f fix_migrations_aws.sql

# Vérification finale
psql "$DATABASE_URL" -f diagnostic_migrations_aws.sql
```

**OU** utilisez le script automatique :

```bash
chmod +x execute_in_cloudshell.sh
./execute_in_cloudshell.sh
```

## 🔧 Alternative : Via ECS Exec (si ECS Exec est activé)

Si votre service ECS a ECS Exec activé :

```powershell
# Depuis votre machine locale
cd backend/scripts
.\execute_sql_via_ecs.ps1 -AutoConfirm
```

## 📋 Informations de Connexion

- **Endpoint RDS** : `yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com`
- **Port** : `5432`
- **Database** : `yukpomnang`
- **Username** : `yukpo_db_user`
- **Password** : `SztViedrXvuBDyj16TWaIAs25FfUColh`
- **URL complète** : `postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require`

## ⚠️ Notes Importantes

1. **CloudShell** est la solution la plus simple car il a automatiquement accès au VPC
2. **Backup** : Faites un backup avant d'exécuter les scripts de correction
3. **Security Groups** : Vérifiez que le Security Group de RDS autorise les connexions depuis CloudShell (normalement automatique)

## 🐛 Dépannage

### Erreur "Connection timed out" dans CloudShell

**Cause** : Le Security Group de RDS bloque les connexions

**Solution** : Vérifiez que le Security Group de RDS autorise les connexions depuis le VPC (normalement automatique pour CloudShell)

### Erreur "psql: command not found"

**Solution** : Installez PostgreSQL client dans CloudShell :
```bash
sudo yum install -y postgresql15
```




