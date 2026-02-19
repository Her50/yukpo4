# 🔍 Vérification Backend - Nouveau Compte AWS

**Date**: 2026-02-14  
**Objectif**: Vérifier que le backend et toutes les variables pointent vers le nouveau compte AWS

---

## 📋 Informations du Nouveau Compte

- **Account ID**: `108964700972`
- **Région**: `eu-west-1` (Irlande)
- **Cluster ECS**: `yukpo-cluster`
- **Service ECS**: `yukpo-backend-service`
- **Bucket S3**: `yukpo-backend-media`
- **URL Backend**: `https://api.yukpomnang.com`

---

## ✅ Vérifications Effectuées

### 1. Variables SSM Backend

Le script `scripts/verifier-et-mettre-a-jour-variables-aws-backend.ps1` vérifie et met à jour:

- ✅ `S3_BUCKET` → `yukpo-backend-media`
- ✅ `S3_REGION` → `eu-west-1`
- ✅ `UPLOAD_BASE_URL` → `https://yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- ⚠️ `S3_ACCESS_KEY` et `S3_SECRET_KEY` (à vérifier si utilisés)

### 2. Bucket S3

**Vérification**: Le bucket `yukpo-backend-media` doit exister dans `eu-west-1`

**Commande de vérification**:
```powershell
aws s3 ls s3://yukpo-backend-media --region eu-west-1
```

**Si le bucket n'existe pas**, le script le crée automatiquement.

### 3. Distribution CloudFront

**Vérification**: Les distributions CloudFront doivent pointer vers le nouveau bucket S3

**Commande de vérification**:
```powershell
aws cloudfront list-distributions --region eu-west-1 --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' --output table
```

**Vérifier que**:
- L'origine pointe vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- La distribution est active

### 4. URL Backend: `api.yukpomnang.com`

**⚠️ IMPORTANT**: Vérifier que `api.yukpomnang.com` pointe vers le **nouveau compte AWS**

#### Comment Vérifier

**Option 1: Vérifier via DNS (Route53)**

```powershell
# Vérifier l'enregistrement DNS
nslookup api.yukpomnang.com

# Ou via AWS Route53
aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]'
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> --query "ResourceRecordSets[?Name=='api.yukpomnang.com.']"
```

**Option 2: Vérifier via Load Balancer**

Si un Load Balancer est configuré:

```powershell
# Lister les Load Balancers
aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[*].[LoadBalancerName,DNSName,LoadBalancerArn]' --output table

# Vérifier que le DNS du Load Balancer correspond à api.yukpomnang.com
```

**Option 3: Vérifier via Test de Connectivité**

```powershell
# Tester la connectivité
Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET

# Vérifier les headers pour identifier le compte AWS
$response = Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET
$response.Headers
```

#### Configuration Attendue

**Si Load Balancer activé**:
- `api.yukpomnang.com` → CNAME vers le DNS du Load Balancer (ex: `yukpo-backend-alb-xxxxx.eu-west-1.elb.amazonaws.com`)
- Load Balancer → Target Group → Service ECS `yukpo-backend-service`

**Si IP publique directe** (non recommandé pour production):
- `api.yukpomnang.com` → A record vers l'IP publique ECS (change à chaque redémarrage)

**⚠️ Problème Potentiel**:
- Si `api.yukpomnang.com` pointe encore vers l'ancien compte (`846505724644`), il faut mettre à jour le DNS.

---

## 🔧 Actions à Effectuer

### Étape 1: Exécuter le Script de Vérification

```powershell
cd scripts
.\verifier-et-mettre-a-jour-variables-aws-backend.ps1
```

Ce script va:
1. ✅ Vérifier/créer le bucket S3
2. ✅ Vérifier les variables SSM existantes
3. ✅ Mettre à jour `S3_BUCKET`, `S3_REGION`, `UPLOAD_BASE_URL`
4. ✅ Vérifier les distributions CloudFront
5. ✅ Tester la connectivité vers `api.yukpomnang.com`

### Étape 2: Vérifier le DNS de `api.yukpomnang.com`

**Si vous utilisez Route53**:

1. Aller dans AWS Console → Route53
2. Trouver la zone hébergée `yukpomnang.com`
3. Vérifier l'enregistrement `api.yukpomnang.com`
4. S'assurer qu'il pointe vers:
   - Le Load Balancer du nouveau compte (si ALB activé)
   - Ou l'IP publique du service ECS (temporaire)

**Si vous utilisez un autre fournisseur DNS**:

1. Vérifier que l'enregistrement CNAME ou A pointe vers le nouveau compte
2. Mettre à jour si nécessaire

### Étape 3: Vérifier le Load Balancer (si activé)

```powershell
# Vérifier si un Load Balancer existe
aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`) || contains(LoadBalancerName, `backend`)][*].[LoadBalancerName,DNSName,State.Code]' --output table

# Si un Load Balancer existe, vérifier les Target Groups
aws elbv2 describe-target-groups --region eu-west-1 --query 'TargetGroups[?contains(TargetGroupName, `yukpo`) || contains(TargetGroupName, `backend`)][*].[TargetGroupName,HealthCheckPath,TargetType]' --output table
```

### Étape 4: Redémarrer le Service ECS (si variables SSM modifiées)

Après avoir mis à jour les variables SSM, redémarrer le service ECS pour qu'il charge les nouvelles variables:

```powershell
aws ecs update-service `
    --cluster yukpo-cluster `
    --service yukpo-backend-service `
    --region eu-west-1 `
    --force-new-deployment
```

---

## 📊 Résumé des Vérifications

| Élément | Statut | Action Requise |
|---------|--------|----------------|
| **Bucket S3** | ⏳ À vérifier | Exécuter le script de vérification |
| **Variables SSM** | ⏳ À mettre à jour | Exécuter le script de vérification |
| **CloudFront** | ⏳ À vérifier | Vérifier manuellement ou via script |
| **DNS api.yukpomnang.com** | ⏳ À vérifier | Vérifier dans Route53 ou DNS provider |
| **Load Balancer** | ⏳ À vérifier | Vérifier si activé et configuré |

---

## 🚨 Problèmes Potentiels

### Problème 1: `api.yukpomnang.com` pointe vers l'ancien compte

**Symptôme**: Les requêtes vers `api.yukpomnang.com` échouent ou pointent vers l'ancien backend

**Solution**:
1. Vérifier le DNS dans Route53 ou votre fournisseur DNS
2. Mettre à jour l'enregistrement pour pointer vers le nouveau compte
3. Attendre la propagation DNS (peut prendre jusqu'à 48h, généralement quelques minutes)

### Problème 2: Bucket S3 n'existe pas

**Symptôme**: Erreurs lors des uploads de médias

**Solution**:
1. Exécuter le script de vérification (crée le bucket automatiquement)
2. Ou créer manuellement:
```powershell
aws s3 mb s3://yukpo-backend-media --region eu-west-1
```

### Problème 3: Variables SSM non mises à jour

**Symptôme**: Le backend utilise encore l'ancien bucket S3

**Solution**:
1. Exécuter le script de vérification (met à jour les variables)
2. Redémarrer le service ECS pour charger les nouvelles variables

---

## ✅ Checklist Finale

- [ ] Exécuter le script `verifier-et-mettre-a-jour-variables-aws-backend.ps1`
- [ ] Vérifier que le bucket S3 existe
- [ ] Vérifier que les variables SSM sont mises à jour
- [ ] Vérifier que `api.yukpomnang.com` pointe vers le nouveau compte
- [ ] Vérifier la distribution CloudFront (si utilisée)
- [ ] Redémarrer le service ECS après mise à jour des variables SSM
- [ ] Tester la connectivité vers `https://api.yukpomnang.com/health`
- [ ] Tester un upload de média pour vérifier S3

---

## 📚 Références

- Script de vérification: `scripts/verifier-et-mettre-a-jour-variables-aws-backend.ps1`
- Configuration S3: `CONFIGURER_S3_AWS_POUR_MEDIAS.md`
- Configuration Backend: `CONFIGURATION_BACKEND_AWS.md`
- Mise à jour variables mobile: `MISE_A_JOUR_VARIABLES_AWS_NOUVEAU_COMPTE.md`



