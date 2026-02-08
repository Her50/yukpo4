# 📋 Résumé : Exécution des Scripts de Diagnostic/Correction AWS

## 🔍 Situation Actuelle

✅ **URL de la base de données AWS trouvée** :
- **Endpoint** : `yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com`
- **Port** : `5432`
- **Database** : `yukpomnang`
- **Username** : `yukpo_db_user`
- **Password** : Récupéré depuis `infra/aws/terraform.tfvars`

❌ **Problème** : La base de données est dans un **VPC privé** et n'est **pas accessible depuis votre machine locale**.

## 🚀 Solutions Disponibles

### Option 1 : Exécuter depuis une Instance EC2 (Recommandé)

Les scripts doivent être exécutés depuis une instance EC2 dans le même VPC.

**Fichiers créés** :
- `backend/scripts/execute_diagnostic_fix_aws_ec2.sh` - Script bash pour EC2
- `backend/scripts/EXECUTER_SUR_EC2.md` - Guide détaillé

**Étapes** :
1. Se connecter à une instance EC2 via SSH ou SSM
2. Cloner/mettre à jour le repo
3. Exécuter le script bash

### Option 2 : Via AWS Systems Manager Session Manager

Exécuter les scripts depuis votre machine en se connectant à une instance EC2 via SSM.

**Fichier créé** :
- `backend/scripts/execute_via_ssm.ps1` - Script PowerShell pour SSM

**Étapes** :
```powershell
# Trouver une instance EC2
aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=*yukpomnang*"

# Se connecter via SSM
aws ssm start-session --target <instance-id> --region us-east-1

# Dans la session, exécuter les scripts
cd /tmp/yukpomnang2/backend/scripts
./execute_diagnostic_fix_aws_ec2.sh
```

### Option 3 : Via ECS Task One-Shot

Si vous avez un service ECS, créer une task one-shot pour exécuter les scripts.

## 📝 Scripts Disponibles

1. **`diagnostic_migrations_aws.sql`** - Script de diagnostic
2. **`fix_migrations_aws.sql`** - Script de correction
3. **`execute_diagnostic_fix_aws_ec2.sh`** - Script bash pour EC2
4. **`run_diagnostic_fix.ps1`** - Script PowerShell (nécessite accès direct)
5. **`execute_via_ssm.ps1`** - Script PowerShell pour SSM

## 🔧 Configuration DATABASE_URL

L'URL complète de la base de données AWS est :

```
postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang
```

**Note** : Cette URL doit être utilisée uniquement depuis une instance EC2 dans le même VPC.

## ⚠️ Prochaines Étapes

1. **Choisir une méthode** (EC2, SSM, ou ECS)
2. **Se connecter à l'instance** appropriée
3. **Exécuter les scripts** de diagnostic et correction
4. **Vérifier les résultats** et tester les fonctionnalités

## 📚 Documentation

- `EXECUTER_SUR_EC2.md` - Guide complet pour exécuter sur EC2
- `GUIDE_EXECUTION_DIAGNOSTIC_FIX_AWS.md` - Guide général
- `DIAGNOSTIC_MIGRATIONS_AWS_2026_01_30.md` - Détails des problèmes identifiés






