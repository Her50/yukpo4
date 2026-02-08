# Instructions Finales : Application du Script SQL

## ✅ Script SQL Créé

Le script SQL de correction est prêt : `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`

## ⚠️ Problème Identifié

La base de données AWS RDS est dans un VPC privé et n'est **pas accessible directement** depuis votre machine locale. De plus, les tâches ECS nécessitent des secrets SSM que le rôle d'exécution ne peut pas récupérer pour des tâches one-shot.

## 🚀 Solution Recommandée : AWS CloudShell

AWS CloudShell a accès au VPC et peut exécuter le script SQL directement.

### Étape 1 : Ouvrir AWS CloudShell

1. Connectez-vous à la console AWS
2. Cliquez sur l'icône CloudShell en haut à droite
3. Attendez que CloudShell se lance

### Étape 2 : Exécuter le Script SQL

Copiez et collez cette commande dans CloudShell :

```bash
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"

# Télécharger le script SQL (si vous avez le repo dans CloudShell)
# OU créer le script directement
cat > /tmp/fix.sql << 'EOFSQL'
-- Contenu du script SQL (voir backend/migrations/20260207_fix_all_missing_tables_and_functions.sql)
EOFSQL

# Exécuter le script
psql $DATABASE_URL -f /tmp/fix.sql
```

**OU** si vous avez accès au repository dans CloudShell :

```bash
git clone <votre-repo> || cd yukpomnang2
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"
psql $DATABASE_URL -f backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
```

## 📋 Vérification Après Application

Après avoir exécuté le script, vérifiez que tout fonctionne :

```sql
-- Vérifier la table
SELECT COUNT(*) FROM user_saved_addresses;

-- Vérifier les fonctions
SELECT proname FROM pg_proc WHERE proname IN ('calculate_best_vector_match_score', 'product_combination_exists');

-- Vérifier l'index
SELECT indexname FROM pg_indexes WHERE tablename = 'services_search_optimized_v2' AND indexname = 'idx_services_search_optimized_v2_unique';
```

## 🎯 Ce que le Script Corrige

1. ✅ Crée la table `user_saved_addresses` manquante
2. ✅ Crée la fonction `calculate_best_vector_match_score` manquante
3. ✅ Crée la fonction `product_combination_exists` manquante
4. ✅ Corrige l'index unique pour la vue matérialisée `services_search_optimized_v2`

## 📝 Notes

- Le script SQL est **idempotent** : il peut être exécuté plusieurs fois sans problème
- Les `CREATE TABLE IF NOT EXISTS` et `CREATE OR REPLACE FUNCTION` garantissent que le script ne cassera pas si certaines parties existent déjà
- Le script inclut des vérifications finales qui affichent le statut de chaque élément créé



