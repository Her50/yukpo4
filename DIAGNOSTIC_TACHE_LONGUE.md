# ⏱️ Diagnostic : Tâche de Migration qui Prend du Temps

## 📊 Situation Actuelle

**Temps d'exécution** : Plus de 15 minutes
**Statut** : RUNNING (en cours)

## ⏱️ Temps d'Exécution Normal

### Étapes de la Tâche

1. **Démarrage du conteneur** : ~30 secondes
2. **Installation de Rust** : **5-10 minutes** ⏱️
   - Téléchargement de Rust (~100-200 MB)
   - Compilation des outils Rust
   - **Peut être plus long sur Fargate avec peu de CPU**
3. **Installation de sqlx-cli** : **5-10 minutes** ⏱️
   - Compilation de sqlx-cli depuis les sources
   - Dépendances Rust à compiler
4. **Exécution des migrations** : **2-5 minutes**
   - 299 migrations à appliquer
   - Chaque migration peut prendre quelques secondes

**TOTAL ATTENDU** : **12-25 minutes** ⏱️

## ✅ C'est Normal si...

- ✅ La tâche est toujours `RUNNING` après 15-20 minutes
- ✅ Les logs montrent "Installing Rust..." ou "Compiling sqlx-cli..."
- ✅ Pas d'erreurs dans les logs CloudWatch

## ⚠️ Il y a un Problème si...

- ❌ La tâche dépasse **30 minutes** sans progression
- ❌ Les logs montrent des erreurs répétées
- ❌ La tâche est `STOPPED` avec `exitCode != 0`
- ❌ Pas de nouveaux logs depuis plus de 10 minutes

## 🔍 Comment Vérifier

### 1. Vérifier le Statut

```powershell
aws ecs describe-tasks `
    --cluster yukpomnang-cluster `
    --tasks arn:aws:ecs:eu-west-1:846505724644:task/yukpomnang-cluster/3c5f933647534475b769dd1d6df34cf2 `
    --region eu-west-1 `
    --query "tasks[0].{lastStatus:lastStatus,startedAt:startedAt,containers:containers[0].{exitCode:exitCode}}" `
    --output json
```

### 2. Vérifier les Logs CloudWatch

```powershell
# Lister les derniers log streams
aws logs describe-log-streams `
    --log-group-name /ecs/yukpomnang-backend `
    --region eu-west-1 `
    --order-by LastEventTime `
    --descending `
    --max-items 3

# Voir les logs du dernier stream
aws logs get-log-events `
    --log-group-name /ecs/yukpomnang-backend `
    --log-stream-name <STREAM_NAME> `
    --region eu-west-1 `
    --limit 50 `
    --query "events[*].message" `
    --output text
```

### 3. Chercher des Indicateurs de Progression

**Dans les logs, cherchez** :
- ✅ `Installing Rust...` ou `rustup install`
- ✅ `Compiling sqlx-cli...`
- ✅ `Running migrations...`
- ✅ `Migrations completed successfully`

**Signes de problème** :
- ❌ `error:`, `Error:`, `ERROR:`
- ❌ `Connection refused`
- ❌ `Permission denied`
- ❌ Pas de nouveaux logs depuis longtemps

## 🎯 Recommandations

### Si < 25 minutes

**✅ Attendez encore** - C'est normal, surtout l'installation de Rust sur Fargate.

### Si > 25-30 minutes

1. **Vérifiez les logs CloudWatch** en détail
2. **Vérifiez le statut** de la tâche
3. **Si bloquée** : Arrêtez la tâche et relancez-en une nouvelle

### Si la Tâche Échoue

1. **Notez l'erreur** dans `stoppedReason`
2. **Vérifiez les logs** pour plus de détails
3. **Corrigez le problème** et relancez

## 💡 Optimisations Possibles

Si les tâches prennent toujours trop de temps :

1. **Pré-installer sqlx-cli dans l'image Docker**
   - Modifier le Dockerfile pour inclure sqlx-cli
   - Évite l'installation à chaque exécution

2. **Utiliser une image avec Rust pré-installé**
   - Utiliser `rust:latest` comme image de base
   - Plus rapide mais image plus lourde

3. **Augmenter les ressources CPU**
   - Plus de CPU = compilation plus rapide
   - Coût plus élevé

## 📝 Actions Immédiates

1. ✅ **Vérifier le statut** de la tâche (commande ci-dessus)
2. ✅ **Vérifier les logs** CloudWatch pour voir la progression
3. ⏳ **Attendre encore 5-10 minutes** si < 25 minutes
4. 🔍 **Investiguer** si > 30 minutes sans progression

## 🔄 Alternative : Vérifier si les Migrations Sont Déjà Appliquées

Même si la tâche est toujours en cours, il est possible que les migrations aient déjà été appliquées par une exécution précédente de l'application.

**Vérification** :
- Connectez-vous à la base de données
- Exécutez : `SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true;`
- Si > 0, certaines migrations sont déjà appliquées







