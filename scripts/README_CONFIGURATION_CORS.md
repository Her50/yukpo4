# 🔧 Guide d'Utilisation des Scripts de Configuration CORS

## 📋 Prérequis

1. **AWS CLI installé** :
   ```powershell
   # Vérifier l'installation
   aws --version
   
   # Si non installé, télécharger depuis:
   # https://aws.amazon.com/cli/
   ```

2. **AWS CLI configuré** :
   ```powershell
   # Configurer AWS CLI
   aws configure
   
   # Entrer:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1
   # - Default output format: json
   ```

3. **Permissions AWS requises** :
   - `ecs:DescribeTaskDefinition`
   - `ecs:RegisterTaskDefinition`
   - `ecs:UpdateService`
   - `ecs:DescribeServices`
   - `elbv2:DescribeLoadBalancers`
   - `ec2:DescribeSecurityGroups`
   - `ec2:AuthorizeSecurityGroupIngress` (optionnel, pour ajouter des règles)

## 🚀 Utilisation

### Option 1: Script Combiné (Recommandé)

Exécutez le script combiné qui fait tout automatiquement :

```powershell
.\scripts\configure-cors-and-verify-sg.ps1
```

Ce script :
1. ✅ Configure CORS dans ECS (ajoute `ALLOWED_ORIGINS=*`)
2. ✅ Vérifie les Security Groups de l'ALB
3. ✅ Affiche un résumé des actions effectuées

### Option 2: Scripts Individuels

#### 1. Configurer CORS dans ECS

```powershell
.\scripts\configure-cors-ecs.ps1
```

**Ce que fait le script** :
- Récupère la dernière révision de la task definition
- Ajoute ou met à jour la variable `ALLOWED_ORIGINS=*`
- Crée une nouvelle révision de la task definition
- Met à jour le service ECS avec la nouvelle révision
- Force un nouveau déploiement

**Durée estimée** : 5 minutes

#### 2. Vérifier Security Groups

```powershell
.\scripts\verify-security-groups.ps1
```

**Ce que fait le script** :
- Trouve l'ALB associé
- Liste tous les Security Groups
- Vérifie que HTTPS (443) est autorisé depuis 0.0.0.0/0
- Vérifie que HTTP (80) est autorisé (optionnel)
- Affiche un rapport détaillé

**Durée estimée** : 2 minutes

## 📊 Résultats Attendus

### Après Configuration CORS

```
✅ ALLOWED_ORIGINS configuré: *
✅ Nouvelle révision: yukpomnang-backend-task:XX
✅ Service ECS mis à jour
```

### Après Vérification Security Groups

```
✅ HTTPS (443) autorisé
✅ HTTP (80) autorisé (optionnel)
✅ Tous les Security Groups sont correctement configurés!
```

## ⚠️ Dépannage

### Erreur: "AWS CLI n'est pas installé"

**Solution** :
1. Télécharger AWS CLI depuis https://aws.amazon.com/cli/
2. Installer
3. Redémarrer PowerShell
4. Réessayer

### Erreur: "AWS CLI n'est pas configuré"

**Solution** :
```powershell
aws configure
```

Entrer vos identifiants AWS.

### Erreur: "Task definition non trouvée"

**Solution** :
Vérifier que le nom de la task definition est correct dans le script :
```powershell
# Modifier dans configure-cors-ecs.ps1
$TASK_DEFINITION_FAMILY = "votre-nom-de-task-definition"
```

### Erreur: "ALB non trouvé"

**Solution** :
Vérifier que le DNS de l'ALB est correct dans le script :
```powershell
# Modifier dans verify-security-groups.ps1
$ALB_DNS = "votre-alb-dns.amazonaws.com"
```

### Erreur: "Permission denied"

**Solution** :
Vérifier que votre utilisateur AWS a les permissions requises :
- `ecs:DescribeTaskDefinition`
- `ecs:RegisterTaskDefinition`
- `ecs:UpdateService`
- `elbv2:DescribeLoadBalancers`
- `ec2:DescribeSecurityGroups`

## 🔍 Vérification Manuelle

### Vérifier que CORS est configuré

```powershell
aws ecs describe-task-definition `
  --task-definition yukpomnang-backend-task `
  --region us-east-1 `
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`ALLOWED_ORIGINS`]'
```

### Vérifier l'état du service ECS

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region us-east-1 `
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}'
```

### Tester la connectivité backend

```powershell
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health
```

## 📝 Notes Importantes

1. **Déploiement** : Après la mise à jour du service ECS, le déploiement peut prendre 5-10 minutes. Surveillez le service avec :
   ```powershell
   aws ecs describe-services --cluster yukpomnang-cluster --services yukpomnang-backend-service --region us-east-1
   ```

2. **ALLOWED_ORIGINS=*** : Cette configuration autorise toutes les origines. Pour plus de sécurité en production, utilisez :
   ```
   ALLOWED_ORIGINS=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com,https://yukpomnang.com,capacitor://localhost,ionic://localhost
   ```

3. **Security Groups** : Si HTTPS (443) n'est pas autorisé, le script vous donnera la commande pour l'ajouter manuellement.

## 🎯 Prochaines Étapes

Après avoir exécuté les scripts :

1. ✅ Attendre que le service ECS se déploie (5-10 minutes)
2. ✅ Tester la connectivité backend
3. ✅ Tester depuis le mobile
4. ✅ Vérifier les logs backend pour confirmer que les requêtes arrivent




