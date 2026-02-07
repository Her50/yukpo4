# 🚀 Guide Actions Immédiates - Configuration CORS et Security Groups

## 📋 Vue d'ensemble

Ce guide vous permet de configurer automatiquement :
1. ✅ CORS dans ECS (ajouter `ALLOWED_ORIGINS=*`)
2. ✅ Vérifier les Security Groups de l'ALB

## 🎯 Option 1: Script Automatique (Recommandé)

### Exécuter le script combiné

```powershell
.\scripts\configure-cors-and-verify-sg.ps1
```

**Durée** : ~7 minutes  
**Ce que fait le script** :
- Configure CORS dans ECS
- Vérifie les Security Groups
- Affiche un résumé complet

## 🎯 Option 2: Scripts Individuels

### 1. Configurer CORS (5 minutes)

```powershell
.\scripts\configure-cors-ecs.ps1
```

### 2. Vérifier Security Groups (2 minutes)

```powershell
.\scripts\verify-security-groups.ps1
```

## 📋 Prérequis

### 1. AWS CLI installé

```powershell
# Vérifier
aws --version

# Si non installé, télécharger:
# https://aws.amazon.com/cli/
```

### 2. AWS CLI configuré

```powershell
aws configure

# Entrer:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region: us-east-1
# - Default output format: json
```

## 🔍 Vérification Après Exécution

### Vérifier que CORS est configuré

```powershell
aws ecs describe-task-definition `
  --task-definition yukpomnang-backend-task `
  --region us-east-1 `
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`ALLOWED_ORIGINS`]'
```

**Résultat attendu** :
```json
[
    {
        "name": "ALLOWED_ORIGINS",
        "value": "*"
    }
]
```

### Vérifier l'état du service ECS

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region us-east-1 `
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

**Résultat attendu** :
```json
{
    "Status": "ACTIVE",
    "Running": 1,
    "Desired": 1
}
```

### Tester la connectivité backend

```powershell
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health
```

**Résultat attendu** : Status 200 OK

## ⚠️ Dépannage

### Erreur: "AWS CLI n'est pas installé"

**Solution** :
1. Télécharger depuis https://aws.amazon.com/cli/
2. Installer
3. Redémarrer PowerShell

### Erreur: "Permission denied"

**Solution** : Vérifier que votre utilisateur AWS a les permissions :
- `ecs:DescribeTaskDefinition`
- `ecs:RegisterTaskDefinition`
- `ecs:UpdateService`
- `elbv2:DescribeLoadBalancers`
- `ec2:DescribeSecurityGroups`

### Erreur: "Task definition non trouvée"

**Solution** : Vérifier le nom dans le script ou modifier :
```powershell
# Dans configure-cors-ecs.ps1
$TASK_DEFINITION_FAMILY = "votre-nom-de-task-definition"
```

## 📝 Notes Importantes

1. **Déploiement** : Le service ECS peut prendre 5-10 minutes pour se déployer après la mise à jour.

2. **ALLOWED_ORIGINS=*** : Autorise toutes les origines. Pour plus de sécurité :
   ```
   ALLOWED_ORIGINS=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com,https://yukpomnang.com,capacitor://localhost
   ```

3. **Security Groups** : Si HTTPS (443) n'est pas autorisé, le script vous donnera la commande pour l'ajouter.

## 🎯 Prochaines Étapes

Après exécution des scripts :

1. ✅ Attendre le déploiement ECS (5-10 minutes)
2. ✅ Tester la connectivité backend
3. ✅ Tester depuis le mobile
4. ✅ Vérifier les logs backend

## 📚 Documentation Complète

Voir `scripts/README_CONFIGURATION_CORS.md` pour plus de détails.


