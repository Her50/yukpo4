# 🔧 Commandes de Vérification Backend AWS - Nouveau Compte

**Date**: 2026-02-14  
**Exécuter ces commandes pour vérifier et mettre à jour les variables backend**

---

## 📋 1. Vérifier le Bucket S3

```powershell
# Vérifier si le bucket existe
aws s3 ls s3://yukpo-backend-media --region eu-west-1

# Si le bucket n'existe pas, le créer
aws s3 mb s3://yukpo-backend-media --region eu-west-1
```

---

## 📋 2. Mettre à Jour les Variables SSM

```powershell
# S3_BUCKET
aws ssm put-parameter `
    --name "/yukpo/production/S3_BUCKET" `
    --value "yukpo-backend-media" `
    --type "String" `
    --region eu-west-1 `
    --overwrite

# S3_REGION
aws ssm put-parameter `
    --name "/yukpo/production/S3_REGION" `
    --value "eu-west-1" `
    --type "String" `
    --region eu-west-1 `
    --overwrite

# UPLOAD_BASE_URL
aws ssm put-parameter `
    --name "/yukpo/production/UPLOAD_BASE_URL" `
    --value "https://yukpo-backend-media.s3.eu-west-1.amazonaws.com" `
    --type "String" `
    --region eu-west-1 `
    --overwrite
```

---

## 📋 3. Vérifier les Variables SSM Existantes

```powershell
# Lister toutes les variables SSM pour yukpo/production
aws ssm get-parameters-by-path `
    --path "/yukpo/production" `
    --region eu-west-1 `
    --query 'Parameters[*].[Name,Type,Value]' `
    --output table
```

---

## 📋 4. Vérifier la Distribution CloudFront

```powershell
# Lister les distributions CloudFront
aws cloudfront list-distributions `
    --region eu-west-1 `
    --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' `
    --output table

# Vérifier si une distribution pointe vers yukpo-backend-media
aws cloudfront list-distributions `
    --region eu-west-1 `
    --query 'DistributionList.Items[?contains(Origins.Items[0].DomainName, `yukpo-backend-media`)][*].[Id,DomainName,Origins.Items[0].DomainName]' `
    --output table
```

---

## 📋 5. Vérifier l'URL du Backend (api.yukpomnang.com)

### Test de Connectivité

```powershell
# Tester la connectivité
Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET

# Vérifier les headers
$response = Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET
$response.Headers
```

### Vérifier le DNS

```powershell
# Résolution DNS
nslookup api.yukpomnang.com

# Ou via dig (si disponible)
dig api.yukpomnang.com
```

### Vérifier via Route53 (si vous utilisez Route53)

```powershell
# Lister les zones hébergées
aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]'

# Récupérer l'ID de la zone (remplacer ZONE_ID)
aws route53 list-resource-record-sets `
    --hosted-zone-id ZONE_ID `
    --query "ResourceRecordSets[?Name=='api.yukpomnang.com.']"
```

### Vérifier le Load Balancer

```powershell
# Lister les Load Balancers
aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --query 'LoadBalancers[*].[LoadBalancerName,DNSName,State.Code,LoadBalancerArn]' `
    --output table

# Vérifier les Target Groups
aws elbv2 describe-target-groups `
    --region eu-west-1 `
    --query 'TargetGroups[*].[TargetGroupName,HealthCheckPath,TargetType,HealthCheckProtocol]' `
    --output table
```

---

## 📋 6. Vérifier le Service ECS

```powershell
# Vérifier le statut du service
aws ecs describe-services `
    --cluster yukpo-cluster `
    --services yukpo-backend-service `
    --region eu-west-1 `
    --query 'services[0].[status,runningCount,desiredCount,deployments[0].status]' `
    --output table

# Lister les tâches en cours d'exécution
aws ecs list-tasks `
    --cluster yukpo-cluster `
    --service-name yukpo-backend-service `
    --region eu-west-1 `
    --desired-status RUNNING
```

---

## 📋 7. Redémarrer le Service ECS (après mise à jour des variables SSM)

```powershell
# Forcer un redéploiement pour charger les nouvelles variables
aws ecs update-service `
    --cluster yukpo-cluster `
    --service yukpo-backend-service `
    --region eu-west-1 `
    --force-new-deployment
```

---

## 📋 8. Vérifier les Logs ECS

```powershell
# Récupérer l'ARN de la tâche
$TASK_ARN = aws ecs list-tasks `
    --cluster yukpo-cluster `
    --service-name yukpo-backend-service `
    --region eu-west-1 `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text

# Voir les logs
aws logs tail /ecs/yukpo-backend `
    --region eu-west-1 `
    --follow
```

---

## ✅ Checklist de Vérification

Exécutez ces commandes dans l'ordre:

1. [ ] Vérifier/créer le bucket S3 (`yukpo-backend-media`)
2. [ ] Mettre à jour les variables SSM (S3_BUCKET, S3_REGION, UPLOAD_BASE_URL)
3. [ ] Vérifier les variables SSM existantes
4. [ ] Vérifier la distribution CloudFront (si utilisée)
5. [ ] Tester la connectivité vers `https://api.yukpomnang.com/health`
6. [ ] Vérifier le DNS de `api.yukpomnang.com`
7. [ ] Vérifier le Load Balancer (si activé)
8. [ ] Vérifier le statut du service ECS
9. [ ] Redémarrer le service ECS (si variables SSM modifiées)
10. [ ] Vérifier les logs ECS pour confirmer que les nouvelles variables sont chargées

---

## 🚨 Problèmes Potentiels et Solutions

### Problème: Bucket S3 n'existe pas

**Solution**: Exécuter `aws s3 mb s3://yukpo-backend-media --region eu-west-1`

### Problème: Variables SSM non mises à jour

**Solution**: Exécuter les commandes de mise à jour SSM ci-dessus, puis redémarrer le service ECS

### Problème: api.yukpomnang.com ne répond pas

**Vérifier**:
1. Le DNS pointe vers le bon compte AWS
2. Le Load Balancer est actif (si utilisé)
3. Le service ECS est en cours d'exécution
4. Le Security Group autorise le trafic HTTP/HTTPS

### Problème: Backend utilise encore l'ancien bucket

**Solution**: 
1. Vérifier que les variables SSM sont mises à jour
2. Redémarrer le service ECS avec `--force-new-deployment`

---

## 📚 Références

- Document de vérification: `VERIFICATION_BACKEND_NOUVEAU_COMPTE_AWS.md`
- Configuration S3: `CONFIGURER_S3_AWS_POUR_MEDIAS.md`
- Configuration Backend: `CONFIGURATION_BACKEND_AWS.md`


