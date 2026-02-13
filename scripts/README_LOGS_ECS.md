# 📋 Scripts de Récupération des Logs ECS

## 📝 Scripts Disponibles

### 1. `get_ecs_logs_final.ps1` ⭐ **Recommandé**

Script le plus fiable pour récupérer les logs ECS depuis CloudWatch Logs.

**Utilisation :**
```powershell
# Récupérer les 50 dernières lignes de logs
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_final.ps1

# Récupérer les 100 dernières lignes
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_final.ps1 -Lines 100
```

**Fonctionnalités :**
- ✅ Gère correctement l'encodage UTF-8
- ✅ Écrit les logs dans un fichier texte
- ✅ Récupère automatiquement les derniers streams
- ✅ Affiche les timestamps formatés

**Sortie :**
- Les logs sont sauvegardés dans `ecs-logs-YYYYMMDD-HHmmss.txt`
- Affiche les instructions pour lire les logs

---

### 2. `get_ecs_logs_simple.ps1`

Version simplifiée qui écrit les logs dans un fichier.

**Utilisation :**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_simple.ps1 -Lines 30
```

---

### 3. `get_ecs_logs_reliable.ps1`

Version avec plus de fonctionnalités (filtrage d'erreurs, mode suivi).

**Utilisation :**
```powershell
# Logs normaux
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_reliable.ps1

# Uniquement les erreurs
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_reliable.ps1 -ErrorsOnly

# Mode suivi (comme tail -f)
powershell -ExecutionPolicy Bypass -File scripts/get_ecs_logs_reliable.ps1 -Follow
```

---

## 🔍 Afficher les Logs Récupérés

Une fois les logs récupérés dans un fichier :

```powershell
# Afficher tous les logs
Get-Content ecs-logs-*.txt -Encoding UTF8

# Afficher uniquement les erreurs
Get-Content ecs-logs-*.txt -Encoding UTF8 | Select-String -Pattern '(?i)(error|exception|failed|panic|fatal)'

# Afficher les 50 dernières lignes
Get-Content ecs-logs-*.txt -Encoding UTF8 | Select-Object -Last 50
```

---

## 🐛 Dépannage

### Problème : "Aucun log trouvé"

**Causes possibles :**
1. Les logs n'existent pas encore (tâche très récente)
2. Le log group n'existe pas
3. Problème de permissions IAM

**Solutions :**
1. Attendre quelques minutes après le démarrage de la tâche
2. Vérifier que le log group existe :
   ```powershell
   aws logs describe-log-groups --log-group-name-prefix /ecs/yukpo --region eu-west-1
   ```
3. Vérifier les permissions IAM pour CloudWatch Logs

### Problème : "Erreur d'encodage"

Les scripts `get_ecs_logs_final.ps1` et `get_ecs_logs_simple.ps1` gèrent correctement l'encodage en écrivant dans des fichiers. Utilisez ces scripts si vous rencontrez des problèmes d'encodage.

---

## 📊 Vérifier l'État du Service ECS

Avant de récupérer les logs, vérifiez l'état du service :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check_ecs_health.ps1
```

---

## 🔗 Liens Utiles

- **CloudWatch Logs Console** : https://console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups
- **ECS Console** : https://console.aws.amazon.com/ecs/v2/clusters/yukpo-cluster/services/yukpo-backend-service

---

## 📝 Notes

- Les logs sont stockés dans CloudWatch Logs avec le log group `/ecs/yukpo-backend`
- Le format des streams est généralement : `backend/backend/{task-id}`
- Les logs peuvent prendre quelques minutes à apparaître après le démarrage d'une tâche

