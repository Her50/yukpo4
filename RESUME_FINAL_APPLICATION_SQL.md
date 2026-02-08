# Résumé Final : Application du Script SQL

## ✅ Ce qui a été fait

1. **Script SQL créé** : `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`
2. **Session Manager Plugin installé** : Le plugin est maintenant disponible
3. **enableExecuteCommand activé** : Le service ECS a `enableExecuteCommand` activé

## ❌ Problèmes rencontrés

1. **CloudShell** : Ne peut pas se connecter à la base de données (Security Groups/VPC)
2. **Tâches ECS one-shot** : Échouent car elles tentent de récupérer les secrets SSM au démarrage
3. **ECS Exec** : Nécessite une session interactive, ne peut pas être automatisé complètement

## 🚀 Solution : Exécution Manuelle via ECS Exec

### Étape 1 : Récupérer une tâche ECS

```powershell
$taskArn = aws ecs list-tasks `
    --cluster yukpomnang-cluster `
    --service-name yukpomnang-backend-service `
    --region us-east-1 `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text
```

### Étape 2 : Se connecter à la tâche

```powershell
aws ecs execute-command `
    --cluster yukpomnang-cluster `
    --task $taskArn `
    --container backend `
    --command "bash" `
    --interactive `
    --region us-east-1
```

### Étape 3 : Dans le shell ECS, exécuter le script SQL

**Option A : Si le fichier est dans le conteneur**

```bash
psql $DATABASE_URL -f /app/backend/migrations/20260207_fix_all_missing_tables_and_functions.sql
```

**Option B : Copier-coller le script SQL**

```bash
psql $DATABASE_URL << 'EOFSQL'
[coller ici le contenu complet du fichier backend/migrations/20260207_fix_all_missing_tables_and_functions.sql]
EOFSQL
```

**Option C : Utiliser base64 (si vous avez le script encodé)**

```bash
printf '%s' '[BASE64_ENCODED_SCRIPT]' | base64 -d | psql $DATABASE_URL
```

## 📋 Vérification

Après l'exécution, vérifiez que tout fonctionne :

```bash
# Vérifier que la table existe
psql $DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_addresses') as table_exists;"

# Vérifier que les fonctions existent
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname IN ('calculate_best_vector_match_score', 'product_combination_exists');"

# Vérifier l'index de la vue matérialisée
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'services_search_optimized_v2' AND indexname = 'idx_services_search_optimized_v2_unique';"
```

## 🎯 Conclusion

Le script SQL doit être exécuté manuellement via ECS Exec car :
- CloudShell n'a pas accès à la base de données (Security Groups)
- Les tâches ECS one-shot échouent à cause des secrets SSM
- ECS Exec nécessite une session interactive

Une fois le script exécuté, tous les problèmes identifiés seront résolus.



