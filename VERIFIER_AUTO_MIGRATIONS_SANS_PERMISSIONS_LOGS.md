# 🔍 Vérifier Auto-Migrations Sans Permissions Logs

**Problème** : Pas de permissions pour accéder aux logs CloudWatch.

**Solutions** :

---

## ✅ MÉTHODE 1 : Via la Console AWS (Recommandé)

### Vérifier les Logs dans la Console

1. **Aller dans AWS Console** → **CloudWatch** → **Logs** → **Log groups**
2. **Chercher** `/ecs/yukpo-backend-service`
3. **Cliquez** sur le log group
4. **Sélectionnez** le dernier log stream (le plus récent)
5. **Cherchez** dans les logs :
   - `ENABLE_AUTO_MIGRATIONS`
   - `raw='true', parsed=true`
   - `Exécution des migrations automatiques`

---

## ✅ MÉTHODE 2 : Vérifier la Task Definition

### Vérifier que la Révision Contient la Variable

1. **Aller dans ECS** → **Définitions de tâches** → **yukpo-backend**
2. **Cliquez** sur la **dernière révision** (probablement révision 5)
3. **Faites défiler** jusqu'à **"Variables d'environnement"**
4. **Vérifiez** que `ENABLE_AUTO_MIGRATIONS` = `true` (type: `Valeur`)

### Vérifier que le Service Utilise la Bonne Révision

1. **Aller dans ECS** → **Clusters** → **yukpo-cluster** → **Services** → **yukpo-backend-service**
2. **Dans "Aperçu du service"**, vérifiez **"Définition de la tâche"**
3. **Cliquez** sur le lien de la révision
4. **Vérifiez** que c'est la révision qui contient `ENABLE_AUTO_MIGRATIONS=true`

---

## ✅ MÉTHODE 3 : Vérifier les Erreurs PostgreSQL (Si Permissions)

Si vous avez accès aux logs PostgreSQL :

```bash
# Compter les erreurs (si vous avez les permissions)
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/yukpo-db/postgresql \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "syntax error at end of input" \
  --region eu-west-1 \
  --query 'events | length(@)' \
  --output text
```

**Résultat attendu** : Moins de 10 erreurs (au lieu de ~95)

---

## ✅ MÉTHODE 4 : Vérifier via psql (Direct)

### Vérifier que les Tables sont Créées

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
  -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -p 5432 \
  -U yukpo_admin \
  -d yukpo \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('property_views', 'property_shares', 'family_profiles', 'recipes', 'menu_plans', 'delivery_chat_messages', 'videos', 'user_preferences') ORDER BY table_name;"
```

**Si les tables sont créées** : Les auto-migrations fonctionnent ! ✅

---

## ✅ MÉTHODE 5 : Vérifier le Statut du Service

### Dans la Console ECS

1. **Aller dans ECS** → **Clusters** → **yukpo-cluster** → **Services** → **yukpo-backend-service**
2. **Onglet "Tâches"** :
   - Vérifiez qu'au moins 1 tâche est **"En cours d'exécution"**
   - Vérifiez que la tâche utilise la **bonne révision** de la task definition
3. **Onglet "Événements"** :
   - Cherchez des messages comme :
     - `Service has reached a steady state`
     - `Task started`
     - Pas d'erreurs critiques

---

## 📋 CHECKLIST DE VÉRIFICATION

- [ ] La task definition (dernière révision) contient `ENABLE_AUTO_MIGRATIONS=true`
- [ ] Le service utilise la bonne révision de la task definition
- [ ] Au moins 1 tâche est "En cours d'exécution"
- [ ] Les tables critiques sont créées dans PostgreSQL (via psql)
- [ ] Pas d'erreurs critiques dans les événements du service

---

## 🎯 RÉSULTAT ATTENDU

### Si les Auto-Migrations Fonctionnent :

1. ✅ Les tables manquantes sont créées
2. ✅ Moins d'erreurs `syntax error at end of input` dans PostgreSQL
3. ✅ Le service fonctionne normalement
4. ✅ Pas d'erreurs critiques dans les événements

### Si les Auto-Migrations ne Fonctionnent Pas :

1. ❌ Les tables manquantes ne sont pas créées
2. ❌ Beaucoup d'erreurs `syntax error at end of input`
3. ⚠️ Vérifier que la bonne révision est utilisée

---

## 💡 ASTUCE

**Le moyen le plus simple** : Vérifier via la console AWS CloudWatch (Méthode 1) ou vérifier que les tables sont créées via psql (Méthode 4).

