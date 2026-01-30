# 📋 Résumé des Actions pour Exécuter les Migrations

## ✅ Actions effectuées

1. **Diagnostic complet** : Identifié pourquoi aucune tâche ECS ne démarre
2. **Permissions IAM corrigées** : Créé et attaché la politique `yukpomnang-ecs-ssm-access` au rôle `yukpomnang-ecs-execution-role`
3. **Service redéployé** : Forcé un nouveau déploiement du service ECS

## ❌ Problèmes restants

### Problème 1 : Target Group manquant

Le service ECS essaie de s'enregistrer auprès d'un target group qui n'existe plus :

```
Service deployment rolled back because of invalid networking configuration. 
The target group arn:aws:elasticloadbalancing:eu-west-1:846505724644:targetgroup/yukpomnang-backend-tg/11d9855e79144cc4 does not exist.
```

**Solution** : 
- Soit créer le target group manquant
- Soit modifier le service pour ne pas utiliser de load balancer (pour les migrations uniquement)

### Problème 2 : Tâches ne démarrent toujours pas

Même avec les permissions corrigées, les tâches ne démarrent pas à cause du problème de target group.

## 🚀 Solutions pour exécuter les migrations

### Option A : Créer le target group manquant

```powershell
# Récupérer les informations du VPC
$vpcId = aws ec2 describe-vpcs `
    --filters "Name=tag:Name,Values=yukpomnang-vpc" `
    --region eu-west-1 `
    --query "Vpcs[0].VpcId" `
    --output text

# Créer le target group
aws elbv2 create-target-group `
    --name yukpomnang-backend-tg `
    --protocol HTTP `
    --port 8080 `
    --vpc-id $vpcId `
    --target-type ip `
    --health-check-path /health `
    --region eu-west-1
```

### Option B : Modifier temporairement le service pour retirer le load balancer

```powershell
# Mettre à jour le service sans load balancer
aws ecs update-service `
    --cluster yukpomnang-cluster `
    --service yukpomnang-backend-service `
    --load-balancers [] `
    --region eu-west-1
```

**Note** : Cette option nécessite de modifier la configuration du service, ce qui peut ne pas être possible si le service a été créé avec Terraform.

### Option C : Exécuter les migrations via une tâche one-shot (sans service)

Créer une tâche one-shot qui :
- N'utilise pas de service ECS
- N'a pas besoin de load balancer
- Exécute uniquement les migrations

**Limitation** : Nécessite de contourner le problème des secrets SSM (déjà résolu avec les permissions IAM).

## 📝 Prochaines étapes recommandées

1. **Créer le target group manquant** (Option A) - Solution la plus propre
2. **Vérifier que les tâches démarrent** après la création du target group
3. **Surveiller les logs CloudWatch** pour confirmer l'exécution des migrations
4. **Vérifier dans la base de données** que les tables ont été créées

## 🔍 Vérification

Une fois les tâches démarrées, vérifier les logs :

```powershell
aws logs tail /ecs/yukpomnang-backend `
    --region eu-west-1 `
    --since 10m `
    --format short `
    --filter-pattern "Migrations"
```

Chercher :
- `✅ Migrations SQLx standard appliquées avec succès`
- `✅ Tables de base (users, services) vérifiées après migrations SQLx`



