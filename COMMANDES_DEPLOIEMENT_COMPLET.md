# 🚀 Commandes de Déploiement Complet

**Date** : 2026-02-14  
**Statut** : ✅ Commit et push effectués

---

## ✅ Étape 1 : Commit et Push (TERMINÉ)

```bash
✅ Commit créé : ea3bf26
✅ Push vers origin/master : SUCCÈS
```

---

## 🔧 Étape 2 : Activer les Auto-Migrations

### Option A : Via Script (Recommandé)

```bash
cd scripts
chmod +x activer_auto_migrations_ecs.sh
./activer_auto_migrations_ecs.sh
```

### Option B : Via AWS CLI Manuellement

```bash
# 1. Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text)

# 2. Récupérer la définition complète
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region eu-west-1 \
  --query 'taskDefinition' > /tmp/task-def-current.json

# 3. Modifier avec jq
jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "true"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json

jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

# 4. Enregistrer la nouvelle task definition
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# 5. Mettre à jour le service
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment
```

---

## 📊 Étape 3 : Surveiller le Déploiement

```bash
# Vérifier le statut du service
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].deployments[*].[status,desiredCount,runningCount]' \
  --output table

# Attendre que runningCount == desiredCount
```

---

## 📋 Étape 4 : Vérifier les Logs PostgreSQL

```bash
# Compter les erreurs "syntax error at end of input" dans les dernières 30 minutes
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/yukpo-db/postgresql \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "syntax error at end of input" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text

# Voir les erreurs récentes
aws logs tail /aws/rds/instance/yukpo-db/postgresql \
  --since 30m \
  --region eu-west-1 \
  --filter-pattern "syntax error at end of input" \
  --format short
```

**Résultat attendu** : Moins de 10 erreurs (au lieu de ~95)

---

## 📋 Étape 5 : Vérifier les Logs Backend

```bash
# Voir les logs de migration en temps réel
aws logs tail /ecs/yukpo-backend-service \
  --follow \
  --region eu-west-1 \
  --filter-pattern "[MIGRATION]"

# Compter les erreurs de fragments
aws logs filter-log-events \
  --log-group-name /ecs/yukpo-backend-service \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "[MIGRATION] Fragment de commande détecté" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text

# Voir les erreurs avec contexte
aws logs filter-log-events \
  --log-group-name /ecs/yukpo-backend-service \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "[MIGRATION] Fragment de commande détecté" \
  --region eu-west-1 \
  --query 'events[*].message' \
  --output text
```

**Résultat attendu** :
- ✅ Les erreurs apparaissent en niveau ERROR
- ✅ Plus de contexte dans les messages (longueur, type, parenthèses)

---

## ✅ Étape 6 : Vérifier les Tables Créées

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
  -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -p 5432 \
  -U yukpo_admin \
  -d yukpo \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('property_views', 'property_shares', 'family_profiles', 'recipes', 'menu_plans', 'delivery_chat_messages', 'videos', 'user_preferences') ORDER BY table_name;"
```

---

## ⚠️ Étape 7 : Désactiver les Auto-Migrations (Après Tests)

### Option A : Via Script

```bash
cd scripts
chmod +x desactiver_auto_migrations_ecs.sh
./desactiver_auto_migrations_ecs.sh
```

### Option B : Via AWS CLI

```bash
# Répéter l'étape 2 mais avec value: "false"
jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "false"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json
```

---

## 📊 Résumé des Commandes Rapides

### Vérifier le Statut du Service
```bash
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].[status,runningCount,desiredCount]' \
  --output table
```

### Voir les Logs en Temps Réel
```bash
aws logs tail /ecs/yukpo-backend-service \
  --follow \
  --region eu-west-1 \
  --filter-pattern "[MIGRATION]"
```

### Compter les Erreurs Récentes (PostgreSQL)
```bash
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/yukpo-db/postgresql \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --filter-pattern "syntax error at end of input" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text
```

---

## ✅ Checklist de Vérification

- [ ] Commit et push effectués
- [ ] Auto-migrations activées
- [ ] Service redéployé
- [ ] Logs PostgreSQL vérifiés (moins d'erreurs)
- [ ] Logs backend vérifiés (erreurs mieux loggées)
- [ ] Tables critiques créées
- [ ] Auto-migrations désactivées après tests

---

**Date de création** : 2026-02-14  
**Dernière mise à jour** : 2026-02-14  
**Statut** : Prêt pour exécution


