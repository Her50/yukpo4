# 📊 Statut de l'exécution des migrations ECS

## ✅ Tâche ECS one-shot créée

**ARN de la tâche** : `arn:aws:ecs:us-east-1:846505724644:task/yukpomnang-cluster/984251e434e64fbb9f9659de48bd4ee2`

**Statut actuel** : `RUNNING` (en cours d'exécution)

## 🔍 Vérification du statut

### Via AWS Console
1. Aller dans **ECS Console** → **Clusters** → `yukpomnang-cluster`
2. Onglet **Tasks** → Filtrer par `984251e434e64fbb9f9659de48bd4ee2`
3. Vérifier le statut et les logs

### Via AWS CLI
```powershell
# Vérifier le statut
aws ecs describe-tasks `
  --cluster yukpomnang-cluster `
  --tasks arn:aws:ecs:us-east-1:846505724644:task/yukpomnang-cluster/984251e434e64fbb9f9659de48bd4ee2 `
  --region us-east-1 `
  --query 'tasks[0].{lastStatus:lastStatus,containers:containers[0].exitCode}' `
  --output json

# Vérifier les logs (si la tâche est terminée)
aws logs get-log-events `
  --log-group-name /ecs/yukpomnang-backend `
  --log-stream-name backend/backend/984251e434e64fbb9f9659de48bd4ee2 `
  --region us-east-1 `
  --limit 100 `
  --query 'events[*].message' `
  --output text
```

## ⏱️ Temps d'exécution attendu

- **Installation de sqlx-cli** : ~5-10 minutes (première fois)
- **Exécution des migrations** : ~1-2 minutes
- **Total** : ~6-12 minutes

## 📋 Ce que fait la tâche

1. Se connecte à la base de données (via `DATABASE_URL` dans l'environnement ECS)
2. Installe `sqlx-cli` si nécessaire (peut prendre du temps)
3. Exécute `sqlx migrate info` pour vérifier l'état
4. Exécute `sqlx migrate run` pour appliquer toutes les migrations SQLx standard

## ✅ Après l'exécution

Une fois la tâche terminée avec `exitCode: 0` :

1. **Vérifier que les tables ont été créées** :
   - Les tables créées par les migrations SQLx standard devraient maintenant exister
   - Vérifier les logs CloudWatch de l'application pour confirmer

2. **Vérifier ENABLE_AUTO_MIGRATIONS** :
   ```powershell
   .\scripts\check-enable-auto-migrations.ps1
   ```

3. **Redémarrer l'application** pour exécuter les migrations automatiques :
   ```powershell
   aws ecs update-service `
     --cluster yukpomnang-cluster `
     --service yukpomnang-backend-service `
     --force-new-deployment `
     --region us-east-1
   ```

## 🔄 Si la tâche échoue

Si `exitCode` n'est pas `0`, vérifier les logs pour identifier l'erreur :

```powershell
aws logs get-log-events `
  --log-group-name /ecs/yukpomnang-backend `
  --log-stream-name backend/backend/984251e434e64fbb9f9659de48bd4ee2 `
  --region us-east-1 `
  --limit 200 `
  --query 'events[*].message' `
  --output text | Select-Object -Last 50
```

## 📝 Note importante

Les migrations SQLx sont **idempotentes** : si elles ont déjà été appliquées, elles seront ignorées. Il est donc sûr de relancer la tâche si nécessaire.

