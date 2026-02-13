# 📊 Explication : Alarmes ECS Auto-Scaling

## ✅ C'est Normal !

Les deux alarmes que vous voyez sont **normales** et font partie du système d'**auto-scaling** d'ECS.

## 🔍 Explication des Alarmes

### Alarmes Target Tracking

Ces alarmes sont créées automatiquement par AWS ECS pour gérer l'auto-scaling :

1. **AlarmLow** : Utilisation de la mémoire < 72% pendant 15 minutes
   - **Signification** : Le service utilise peu de ressources
   - **Action** : Peut réduire le nombre de tâches (scale down) si configuré

2. **AlarmHigh** : Utilisation de la mémoire > 72% pendant 15 minutes
   - **Signification** : Le service utilise beaucoup de ressources
   - **Action** : Peut augmenter le nombre de tâches (scale up)

## 📋 État Actuel

- **État** : "En alarme" (AlarmLow)
- **Signification** : Votre service utilise **moins de 72% de mémoire**
- **C'est normal** pour :
  - Un service qui vient de démarrer
  - Un service avec peu de trafic
  - Un service optimisé

## ⚙️ Configuration Auto-Scaling

Ces alarmes sont liées à la configuration d'auto-scaling dans Terraform :

- **Min tasks** : 1 (minimum de tâches)
- **Max tasks** : 10 (maximum de tâches)
- **Target tracking** : 72% d'utilisation mémoire

## ✅ Que Faire ?

### Rien à faire si :
- ✅ Le service fonctionne correctement
- ✅ Les logs montrent que l'application démarre
- ✅ Pas d'erreurs critiques

### Si vous voulez désactiver l'auto-scaling :

Vous pouvez modifier la configuration dans `infra/aws/main.tf` pour :
- Désactiver l'auto-scaling
- Ajuster les seuils (72% → autre valeur)
- Changer le nombre de tâches désirées

## 🔍 Vérification

Pour vérifier l'état réel du service :

```bash
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,CPU:deploymentConfiguration.maximumPercent}'
```

## 📊 Métriques Utiles

Pour voir l'utilisation réelle :

1. **CloudWatch** → **Métriques** → **ECS/ContainerInsights**
2. **Sélectionnez** : `yukpo-cluster` → `yukpo-backend-service`
3. **Métriques** :
   - `MemoryUtilization` : Utilisation de la mémoire
   - `CPUUtilization` : Utilisation du CPU
   - `RunningTaskCount` : Nombre de tâches en cours

## 💡 Conclusion

**Ces alarmes sont normales** et indiquent simplement que votre service utilise peu de ressources. C'est une **bonne chose** - cela signifie que votre application est efficace et que vous ne payez pas pour des ressources inutilisées.

**Action requise** : Aucune, sauf si vous voulez ajuster les seuils d'auto-scaling.

