# 🔍 Vérifier l'État du Service ECS

## 📋 Vérification Rapide

### 1. Vérifier l'État du Service

Dans AWS Console :
1. **ECS** → **Clusters** → `yukpo-cluster`
2. **Services** → `yukpo-backend-service`
3. **Onglet "Deployments"** : Vérifiez que le statut est "Running"
4. **Onglet "Tasks"** : Vérifiez que les tâches sont en état "Running"

### 2. Vérifier les Logs en Temps Réel

1. **Cliquez sur une tâche** dans l'onglet "Tasks"
2. **Onglet "Logs"** → **View logs in CloudWatch**
3. **Actualisez** pour voir les logs les plus récents

### 3. Vérifier les Logs via AWS CLI

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
```

## 🔍 Ce que Vous Devriez Voir

Si l'application démarre correctement, vous devriez voir dans les logs (après Redis) :

1. **Connexion PostgreSQL** :
   ```
   🔌 Connexion à PostgreSQL...
   ✅ Connexion PostgreSQL établie (pool: max=100, min=5, acquire_timeout=30s)
   ```

2. **Migrations** (si activées) :
   ```
   ✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...
   ```

3. **Démarrage du serveur** :
   ```
   🚀 Serveur démarré sur http://0.0.0.0:8080
   ```

## ❌ Si Vous Ne Voyez Rien Après Redis

Cela peut signifier que l'application est bloquée lors de la connexion à PostgreSQL. Vérifiez :

1. **Les logs RDS** pour voir s'il y a des tentatives de connexion
2. **Les métriques CloudWatch** pour voir l'utilisation CPU/Mémoire
3. **L'état de la tâche** : Si elle est en "Stopped", vérifiez la raison

## 🔧 Solution si l'Application est Bloquée

Si l'application ne démarre pas après plusieurs minutes, il peut y avoir un problème de connexion. Vérifiez depuis votre terminal Session Manager EC2 :

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT current_database(), current_user, version();"
```

Si cette commande fonctionne, la base est accessible et le problème vient peut-être de la configuration du pool de connexions.

