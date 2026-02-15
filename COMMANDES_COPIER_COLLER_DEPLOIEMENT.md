# 📋 COMMANDES À COPIER-COLLER - Déploiement Complet

## ✅ ÉTAPE 1 : Activer les Auto-Migrations dans ECS

```bash
TASK_DEF=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text)

aws ecs describe-task-definition --task-definition "$TASK_DEF" --region eu-west-1 --query 'taskDefinition' > /tmp/task-def-current.json

jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "true"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json

jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-final.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text)

aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition "$NEW_TASK_DEF" --region eu-west-1 --force-new-deployment
```

---

## 📊 ÉTAPE 2 : Surveiller le Déploiement

```bash
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].deployments[*].[status,desiredCount,runningCount]' --output table
```

---

## 📋 ÉTAPE 3 : Vérifier les Logs PostgreSQL (Compter les Erreurs)

```bash
aws logs filter-log-events --log-group-name /aws/rds/instance/yukpo-db/postgresql --start-time $(date -u -d '30 minutes ago' +%s)000 --filter-pattern "syntax error at end of input" --region eu-west-1 --query 'events | length(@)' --output text
```

---

## 📋 ÉTAPE 4 : Voir les Erreurs PostgreSQL Récentes

```bash
aws logs tail /aws/rds/instance/yukpo-db/postgresql --since 30m --region eu-west-1 --filter-pattern "syntax error at end of input" --format short
```

---

## 📋 ÉTAPE 5 : Voir les Logs Backend en Temps Réel

```bash
aws logs tail /ecs/yukpo-backend-service --follow --region eu-west-1 --filter-pattern "[MIGRATION]"
```

---

## 📋 ÉTAPE 6 : Compter les Erreurs de Migration dans les Logs Backend

```bash
aws logs filter-log-events --log-group-name /ecs/yukpo-backend-service --start-time $(date -u -d '30 minutes ago' +%s)000 --filter-pattern "[MIGRATION] Fragment de commande détecté" --region eu-west-1 --query 'events | length(@)' --output text
```

---

## 📋 ÉTAPE 7 : Voir les Erreurs de Migration avec Contexte

```bash
aws logs filter-log-events --log-group-name /ecs/yukpo-backend-service --start-time $(date -u -d '30 minutes ago' +%s)000 --filter-pattern "[MIGRATION] Fragment de commande détecté" --region eu-west-1 --query 'events[*].message' --output text
```

---

## ✅ ÉTAPE 8 : Vérifier les Tables Critiques Créées

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('property_views', 'property_shares', 'family_profiles', 'recipes', 'menu_plans', 'delivery_chat_messages', 'videos', 'user_preferences') ORDER BY table_name;"
```

---

## ⚠️ ÉTAPE 9 : Désactiver les Auto-Migrations (Après Tests)

```bash
TASK_DEF=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text)

aws ecs describe-task-definition --task-definition "$TASK_DEF" --region eu-west-1 --query 'taskDefinition' > /tmp/task-def-current.json

jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "false"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json

jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-final.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text)

aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition "$NEW_TASK_DEF" --region eu-west-1 --force-new-deployment
```

---

## 🔍 COMMANDES DE VÉRIFICATION RAPIDE

### Vérifier le Statut du Service
```bash
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].[status,runningCount,desiredCount]' --output table
```

### Compter Toutes les Erreurs PostgreSQL (1 heure)
```bash
aws logs filter-log-events --log-group-name /aws/rds/instance/yukpo-db/postgresql --start-time $(date -u -d '1 hour ago' +%s)000 --filter-pattern "syntax error at end of input" --region eu-west-1 --query 'events | length(@)' --output text
```

### Voir les Derniers Logs Backend (100 dernières lignes)
```bash
aws logs tail /ecs/yukpo-backend-service --since 10m --region eu-west-1 --format short | tail -100
```

---

## 📝 NOTES IMPORTANTES

1. **Attendre 5-10 minutes** après l'activation des auto-migrations avant de vérifier les logs
2. **Résultat attendu** : Moins de 10 erreurs `syntax error at end of input` (au lieu de ~95)
3. **Désactiver les auto-migrations** après avoir vérifié que tout fonctionne
4. **Surveiller les logs** pendant au moins 1 heure après le déploiement


