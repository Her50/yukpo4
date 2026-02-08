# Résumé : Application du Script SQL de Correction

## ✅ Actions Effectuées

1. **Script SQL créé** : `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`
   - Crée la table `user_saved_addresses`
   - Crée les fonctions `calculate_best_vector_match_score` et `product_combination_exists`
   - Corrige l'index unique pour la vue matérialisée `services_search_optimized_v2`

2. **Scripts PowerShell créés** :
   - `backend/scripts/apply_fix_sql_ecs.ps1` (version complète avec caractères accentués)
   - `backend/scripts/apply_fix_sql_ecs_simple.ps1` (version simplifiée)

## ⚠️ Problème Identifié

La base de données AWS RDS est dans un VPC privé et n'est **pas accessible directement** depuis votre machine locale. Les tentatives d'exécution via `psql` direct ont échoué avec un timeout.

## 🔧 Solutions Recommandées

### Option 1 : Via AWS CloudShell (Recommandé - Le Plus Simple)

1. Ouvrir **AWS CloudShell** depuis la console AWS
2. Cloner le repository dans CloudShell :
   ```bash
   git clone <votre-repo> || cd yukpomnang2
   ```
3. Exécuter le script SQL :
   ```bash
   export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
   export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"
   psql $DATABASE_URL -f backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
   ```

### Option 2 : Via ECS Exec (Si ECS Exec est activé)

1. Se connecter à une tâche ECS en cours d'exécution :
   ```powershell
   $taskArn = aws ecs list-tasks --cluster yukpomnang-cluster --region us-east-1 --desired-status RUNNING --query 'taskArns[0]' --output text
   aws ecs execute-command --cluster yukpomnang-cluster --task $taskArn --container backend --command "/bin/bash" --interactive --region us-east-1
   ```

2. Dans le shell ECS, exécuter :
   ```bash
   export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
   psql $DATABASE_URL -f /app/backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
   ```

### Option 3 : Via Instance EC2 (Si vous avez une instance dans le même VPC)

1. Se connecter à l'instance EC2 via SSM :
   ```powershell
   aws ssm start-session --target i-xxxxxxxxxxxxx --region us-east-1
   ```

2. Sur l'instance, exécuter :
   ```bash
   export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
   psql $DATABASE_URL -f /path/to/20260207_fix_all_missing_tables_and_functions.sql
   ```

## 📋 Vérification Après Application

Après avoir appliqué le script, vérifier que tout fonctionne :

```sql
-- Vérifier la table
SELECT COUNT(*) FROM user_saved_addresses;

-- Vérifier les fonctions
SELECT proname FROM pg_proc WHERE proname IN ('calculate_best_vector_match_score', 'product_combination_exists');

-- Vérifier l'index
SELECT indexname FROM pg_indexes WHERE tablename = 'services_search_optimized_v2' AND indexname = 'idx_services_search_optimized_v2_unique';
```

## 🎯 Prochaines Étapes

Une fois le script appliqué :
1. Vérifier les logs du backend pour confirmer que les erreurs ont disparu
2. Tester les fonctionnalités concernées :
   - Sauvegarde d'adresses utilisateur
   - Recherche de produits
   - Vérification des doublons de combinaisons
   - Rafraîchissement de la vue matérialisée

## 📝 Notes

- Le script SQL est **idempotent** : il peut être exécuté plusieurs fois sans problème
- Les `CREATE TABLE IF NOT EXISTS` et `CREATE OR REPLACE FUNCTION` garantissent que le script ne cassera pas si certaines parties existent déjà
- Le script inclut des vérifications finales qui affichent le statut de chaque élément créé



