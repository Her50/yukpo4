# 🚀 Plan d'Action - Déploiement Complet des Corrections

**Date** : 2026-02-14  
**Objectif** : Déployer les améliorations du parsing SQL et tester

---

## 📋 Checklist Complète

### ✅ Étape 1 : Commiter les Modifications

**Fichiers à commiter** :
- `backend/src/migrations/auto_migrate.rs` - Améliorations du parsing SQL

**Commandes** :
```bash
cd backend
git add src/migrations/auto_migrate.rs
git commit -m "fix(migrations): Améliorer le parsing SQL pour corriger les erreurs 'syntax error at end of input'

- Ajout de fonctions helper pour détecter correctement la fin des CREATE TABLE/INDEX/VIEW
- Amélioration de la gestion des chaînes et échappements
- Changement du logging de warn! à error! pour les syntax errors
- Meilleur contexte dans les messages d'erreur

Fixes: ~95 erreurs SQL identifiées dans les logs PostgreSQL"
```

---

### ✅ Étape 2 : Pusher vers le Repository

```bash
git push origin main
# ou
git push origin master
```

---

### ✅ Étape 3 : Activer Temporairement les Auto-Migrations

**Option A : Via AWS Console**

1. Aller dans **ECS** → **Clusters** → **yukpo-cluster**
2. Sélectionner **Services** → **yukpo-backend-service**
3. Cliquer sur **Update**
4. Dans **Container Definitions**, sélectionner le conteneur
5. Dans **Environment**, ajouter/modifier :
   - **Key**: `ENABLE_AUTO_MIGRATIONS`
   - **Value**: `true`
6. Cliquer sur **Update**

**Option B : Via AWS CLI (Recommandé)**

```bash
# 1. Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].taskDefinition' \
  --output text)

echo "📋 Task Definition actuelle: $TASK_DEF"

# 2. Récupérer la définition complète
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region eu-west-1 \
  --query 'taskDefinition' > /tmp/task-def-current.json

# 3. Modifier avec jq (ajouter/modifier ENABLE_AUTO_MIGRATIONS=true)
jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "true"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json

# 4. Supprimer les champs non modifiables
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

# 5. Enregistrer la nouvelle task definition
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Nouvelle Task Definition: $NEW_TASK_DEF"

# 6. Mettre à jour le service
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment

echo "✅ Service mis à jour, déploiement en cours..."
```

---

### ✅ Étape 4 : Attendre le Déploiement

```bash
# Surveiller le déploiement
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].deployments[*].[status,desiredCount,runningCount]' \
  --output table

# Attendre que le déploiement soit stable (runningCount == desiredCount)
```

---

### ✅ Étape 5 : Vérifier les Logs PostgreSQL

**Via AWS CLI** :

```bash
# Lister les groupes de logs RDS
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/rds" \
  --region eu-west-1

# Voir les logs récents avec filtrage des erreurs
aws logs tail /aws/rds/instance/yukpo-db/postgresql \
  --since 30m \
  --region eu-west-1 \
  --filter-pattern "syntax error at end of input" \
  --format short

# Compter les erreurs
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/yukpo-db/postgresql \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "syntax error at end of input" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text
```

**Résultat attendu** :
- ✅ Moins d'erreurs `syntax error at end of input` (idéalement < 10 au lieu de ~95)
- ✅ Les erreurs restantes sont mieux loggées avec plus de contexte

---

### ✅ Étape 6 : Vérifier les Logs Backend

**Via AWS CLI** :

```bash
# Trouver le groupe de logs du backend
aws logs describe-log-groups \
  --log-group-name-prefix "/ecs/yukpo" \
  --region eu-west-1

# Voir les logs récents avec filtrage
aws logs tail /ecs/yukpo-backend-service \
  --since 30m \
  --region eu-west-1 \
  --filter-pattern "[MIGRATION]" \
  --format short

# Voir les erreurs de migration
aws logs filter-log-events \
  --log-group-name /ecs/yukpo-backend-service \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "[MIGRATION] Fragment de commande détecté" \
  --region eu-west-1 \
  --query 'events[*].message' \
  --output text
```

**Résultat attendu** :
- ✅ Les erreurs apparaissent en niveau ERROR (au lieu de WARN)
- ✅ Plus de contexte dans les messages (longueur, type, parenthèses)
- ✅ Les erreurs sont visibles dans CloudWatch

---

### ✅ Étape 7 : Vérifier les Tables Créées

**Via psql** :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
  -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -p 5432 \
  -U yukpo_admin \
  -d yukpo \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('property_views', 'property_shares', 'family_profiles', 'recipes', 'menu_plans', 'delivery_chat_messages', 'videos', 'user_preferences') ORDER BY table_name;"
```

---

### ✅ Étape 8 : Désactiver les Auto-Migrations (Après Tests)

**Important** : Désactiver après avoir vérifié que tout fonctionne

```bash
# Répéter l'étape 3 mais avec value: "false"
jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "false"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json
```

---

## 📊 Critères de Succès

### ✅ Parsing SQL Amélioré
- [ ] Moins de 10 erreurs `syntax error at end of input` dans les logs PostgreSQL
- [ ] Les erreurs restantes sont mieux loggées avec plus de contexte
- [ ] Les erreurs apparaissent en `error!` dans les logs backend

### ✅ Tables Créées
- [ ] Toutes les tables critiques sont créées
- [ ] Aucune table dupliquée
- [ ] Aucune erreur de création de table

### ✅ Index Créés
- [ ] Tous les index critiques sont créés
- [ ] Aucun index dupliqué
- [ ] Aucune erreur de création d'index

---

## 🚨 Points d'Attention

### ⚠️ Ne Pas Faire
1. **Ne pas laisser les auto-migrations activées** en production si elles causent des problèmes
2. **Ne pas ignorer les erreurs** même si elles sont "bénignes"
3. **Ne pas déployer** sans avoir testé localement d'abord

### ✅ À Faire
1. **Tester localement** avec des migrations complexes avant de déployer
2. **Vérifier les logs** après chaque correction
3. **Documenter** les changements apportés
4. **Surveiller** les logs pendant au moins 1 heure après le déploiement

---

## 📝 Commandes Rapides

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

### Compter les Erreurs Récentes
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

**Date de création** : 2026-02-14  
**Dernière mise à jour** : 2026-02-14  
**Statut** : Prêt pour exécution

