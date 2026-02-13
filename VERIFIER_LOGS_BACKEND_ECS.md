# 🔍 Vérifier les Logs du Backend ECS

## 📋 Comment Vérifier les Logs

### Option 1 : Via AWS Console (Recommandé)

1. **Allez dans AWS Console** → **ECS** → **Clusters** → `yukpo-cluster`
2. **Services** → `yukpo-backend-service`
3. **Onglet "Logs"** ou cliquez sur le **log group** CloudWatch
4. **Vérifiez les logs récents** (dernières 5-10 minutes)

### Option 2 : Via AWS CLI

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
```

## ✅ Ce que Vous Devriez Voir

Si tout fonctionne correctement, vous devriez voir dans les logs :

1. ✅ **Connexion Redis** (optionnel) :
   ```
   ✅ Redis (AWS ElastiCache) accessible
   ```
   ou
   ```
   ⚠️ WARNING: Redis non accessible... (l'application continuera sans cache)
   ```

2. ✅ **Connexion à la base de données** :
   ```
   🔌 Connexion à PostgreSQL...
   ✅ Pool de connexions PostgreSQL initialisé
   ```

3. ✅ **Application des migrations** (si `ENABLE_AUTO_MIGRATIONS=true`) :
   ```
   ✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...
   ```

4. ✅ **Démarrage du serveur** :
   ```
   🚀 Serveur démarré sur http://0.0.0.0:8080
   ```

## ❌ Si Vous Voyez des Erreurs

### Erreur de Connexion à la Base

Si vous voyez :
```
❌ ERREUR: Impossible de se connecter à la base de données 'yukpo'
```

**Solution** : Vérifiez que `DATABASE_URL` dans AWS Secrets Manager se termine par `/yukpo`

### Erreur de Permissions

Si vous voyez :
```
❌ ERREUR: permission denied for database yukpo
```

**Solution** : L'utilisateur `yukpo_admin` n'a pas les permissions sur la base `yukpo`. Il faut lui donner les permissions :

```sql
GRANT ALL PRIVILEGES ON DATABASE yukpo TO yukpo_admin;
\c yukpo
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yukpo_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yukpo_admin;
```

## 📊 Vérification Rapide

Pour vérifier rapidement l'état du service :

```bash
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Events:events[0:3]}'
```

