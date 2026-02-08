# 🔧 Instructions pour Appliquer le Script SQL sur AWS RDS

## ⚠️ Problème Identifié

La base de données AWS RDS n'est **pas accessible directement depuis votre machine locale** car elle est dans un VPC privé. Le timeout de connexion confirme cela.

## ✅ Solutions Disponibles

### Option 1 : Exécuter depuis une Instance EC2 (RECOMMANDÉ)

Si vous avez une instance EC2 dans le même VPC que RDS :

```powershell
# 1. Se connecter à l'instance EC2 via SSM Session Manager
aws ssm start-session --target i-xxxxxxxxxxxxx --region us-east-1

# 2. Sur l'instance EC2, télécharger le script
cd /tmp
# Copier le script depuis votre machine locale ou depuis S3

# 3. Exécuter le script
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
psql $DATABASE_URL -f /tmp/20260207_fix_all_missing_tables_and_functions.sql
```

### Option 2 : Utiliser AWS ECS Task (Si disponible)

```powershell
# Exécuter une tâche ECS avec le script
aws ecs run-task \
    --cluster yukpomnang-cluster \
    --task-definition migration-task \
    --overrides '{
        "containerOverrides": [{
            "name": "backend",
            "command": ["bash", "-c", "psql $DATABASE_URL -f /app/backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"]
        }]
    }'
```

### Option 3 : Utiliser AWS Systems Manager (SSM) Document

Créer un document SSM qui exécute le script :

```powershell
# Créer un document SSM
aws ssm create-document \
    --name "ApplyFixMissingTables" \
    --document-type "Command" \
    --content file://ssm-document.json \
    --region us-east-1

# Exécuter sur une instance EC2
aws ssm send-command \
    --instance-ids "i-xxxxxxxxxxxxx" \
    --document-name "ApplyFixMissingTables" \
    --region us-east-1
```

### Option 4 : Utiliser un Tunnel SSH/Bastion

Si vous avez un bastion host :

```powershell
# Créer un tunnel SSH
ssh -L 5432:yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432 ec2-user@bastion-host

# Dans un autre terminal, utiliser localhost
$env:DATABASE_URL = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@localhost:5432/yukpomnang?sslmode=require"
psql $env:DATABASE_URL -f backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
```

### Option 5 : Utiliser AWS RDS Query Editor (Si activé)

1. Aller dans AWS Console → RDS → Query Editor
2. Se connecter à la base de données
3. Copier-coller le contenu du script SQL
4. Exécuter

## 📋 Contenu du Script à Exécuter

Le fichier à exécuter est : `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`

Ce script va :
1. ✅ Créer la table `user_saved_addresses`
2. ✅ Créer la fonction `calculate_best_vector_match_score`
3. ✅ Créer la fonction `product_combination_exists`
4. ✅ Corriger l'index unique pour `services_search_optimized_v2`

## 🔍 Vérification Après Exécution

Après avoir exécuté le script, vérifier avec :

```sql
-- Vérifier la table
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_saved_addresses'
);

-- Vérifier les fonctions
SELECT proname FROM pg_proc 
WHERE proname IN ('calculate_best_vector_match_score', 'product_combination_exists');

-- Vérifier l'index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'services_search_optimized_v2' 
AND indexname = 'idx_services_search_optimized_v2_unique';
```

## 🚀 Solution Rapide : Script PowerShell pour EC2

J'ai créé un script qui peut être exécuté sur EC2. Voulez-vous que je le crée ?



