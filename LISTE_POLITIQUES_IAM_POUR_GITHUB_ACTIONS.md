# 📋 Liste des Politiques IAM pour GitHub Actions

## ✅ Politiques à Attacher à l'Utilisateur IAM

Lors de la création de l'utilisateur `github-actions-yukpo`, attachez ces **12 politiques** :

**⚠️ Mise à jour :** 
- Ajout de S3 et CloudFront pour le stockage vidéo et CDN
- Ajout d'API Gateway pour WebSocket (si vous utilisez API Gateway WebSocket API)
- Ajout de Load Balancer pour WebSocket/WebRTC

**Note MongoDB :** Votre application utilise MongoDB externe (pas AWS DocumentDB), donc **pas besoin** de `AmazonDocDBFullAccess`. Si vous migrez vers DocumentDB plus tard, ajoutez cette politique.

**Note Email/SMS :** Votre application utilise SendGrid (email) et Twilio (SMS), donc **pas besoin** de `AmazonSESFullAccess` ou `AmazonSNSFullAccess`. Si vous migrez vers AWS SES/SNS plus tard, ajoutez ces politiques.

**✅ Analyse complète effectuée :** Toutes les politiques nécessaires sont dans cette liste. Aucune politique supplémentaire requise.

---

### 1. **AmazonEC2ContainerRegistryPowerUser**
**Pourquoi :** Permet de push/pull des images Docker vers ECR
**Actions :** `ecr:*` (toutes les actions ECR)

---

### 2. **AmazonECS_FullAccess**
**Pourquoi :** Permet de déployer et gérer les services ECS
**Actions :** `ecs:*` (créer clusters, services, tasks, etc.)

---

### 3. **AmazonSSMFullAccess**
**Pourquoi :** Permet de stocker/récupérer les secrets dans Parameter Store
**Actions :** `ssm:*` (GetParameter, PutParameter, etc.)
**Utilisé pour :** Stocker `DATABASE_URL` de manière sécurisée

---

### 4. **AmazonRDSFullAccess**
**Pourquoi :** Permet de gérer la base de données PostgreSQL
**Actions :** `rds:*` (créer, modifier, supprimer les instances RDS)

---

### 5. **AmazonElastiCacheFullAccess**
**Pourquoi :** Permet de gérer Redis (ElastiCache)
**Actions :** `elasticache:*` (créer, modifier, supprimer les clusters Redis)

---

### 6. **AmazonVPCFullAccess**
**Pourquoi :** Permet de gérer le réseau (VPC, sous-réseaux, etc.)
**Actions :** `ec2:*` (pour VPC, subnets, security groups, etc.)
**Note :** Nécessaire pour créer l'infrastructure réseau

---

### 7. **CloudWatchLogsFullAccess**
**Pourquoi :** Permet d'écrire les logs de l'application
**Actions :** `logs:*` (CreateLogGroup, CreateLogStream, PutLogEvents)

---

### 8. **IAMFullAccess**
**Pourquoi :** Permet de créer les rôles IAM nécessaires pour ECS
**Actions :** `iam:*` (créer les rôles ECS task execution, etc.)
**Note :** Nécessaire pour que Terraform puisse créer les rôles ECS

---

### 9. **AmazonS3FullAccess**
**Pourquoi :** Permet de stocker les vidéos et fichiers dans S3
**Actions :** `s3:*` (créer buckets, upload/download fichiers, etc.)
**Utilisé pour :** Stockage des vidéos créées, images, fichiers utilisateurs

---

### 10. **CloudFrontFullAccess**
**Pourquoi :** Permet de configurer le CDN pour distribuer le contenu (vidéos, images)
**Actions :** `cloudfront:*` (créer distributions CDN, invalider le cache, etc.)
**Utilisé pour :** CDN pour livraison rapide du contenu vers l'Afrique

---

### 11. **AmazonAPIGatewayAdministrator** (Optionnel mais Recommandé)
**Pourquoi :** Permet de créer/gérer API Gateway (pour WebSocket API si vous migrez vers API Gateway)
**Actions :** `apigateway:*` (créer APIs, WebSocket APIs, routes, etc.)
**Note :** Actuellement vos WebSockets passent par ECS/ALB, mais cette politique permet de migrer vers API Gateway si besoin

---

### 12. **ElasticLoadBalancingFullAccess** OU **ElasticLoadBalancingV2FullAccess**
**Pourquoi :** Permet de gérer l'Application Load Balancer (ALB) qui gère les connexions WebSocket
**Actions :** `elasticloadbalancing:*` (créer/modifier ALB, listeners, target groups, etc.)
**Utilisé pour :** ALB qui route les connexions WebSocket vers ECS

**⚠️ Noms possibles à chercher :**
- `ElasticLoadBalancingFullAccess` (sans "Amazon" au début)
- `ElasticLoadBalancingV2FullAccess` (pour ALB/NLB version 2 - recommandé)
- `ElasticLoadBalancing` (chercher ce terme)

**Note :** Si vous ne trouvez pas cette politique, `AmazonVPCFullAccess` peut suffire car il inclut certaines permissions ELB, mais pour une gestion complète de l'ALB, cette politique est recommandée.

---

## 🔍 Comment Chercher les Politiques

### Méthode 1 : Recherche par Nom

1. Dans la liste des politiques, utilisez la **barre de recherche** en haut
2. Tapez le nom exact ou un mot-clé :
   - `ECR` → Trouve `AmazonEC2ContainerRegistryPowerUser`
   - `ECS` → Trouve `AmazonECS_FullAccess`
   - `SSM` → Trouve `AmazonSSMFullAccess`
   - `RDS` → Trouve `AmazonRDSFullAccess`
   - `ElastiCache` → Trouve `AmazonElastiCacheFullAccess`
   - `VPC` → Trouve `AmazonVPCFullAccess`
   - `CloudWatch` → Trouve `CloudWatchLogsFullAccess`
   - `IAM` → Trouve `IAMFullAccess`
   - `S3` → Trouve `AmazonS3FullAccess`
   - `CloudFront` → Trouve `CloudFrontFullAccess`
   - `API Gateway` → Trouve `AmazonAPIGatewayAdministrator`
   - `Load Balancer` ou `ELB` ou `ElasticLoadBalancing` → Trouve `ElasticLoadBalancingFullAccess` ou `ElasticLoadBalancingV2FullAccess`

### Méthode 2 : Filtrer par Type

1. Utilisez le filtre **"Type"** : Sélectionnez **"AWS managed"**
2. Toutes les politiques AWS gérées apparaîtront
3. Recherchez dans la liste

---

## ✅ Checklist de Vérification

Avant de cliquer sur "Suivant", vérifiez :

- [ ] Option "Attacher directement des politiques" sélectionnée
- [ ] `AmazonEC2ContainerRegistryPowerUser` cochée
- [ ] `AmazonECS_FullAccess` cochée
- [ ] `AmazonSSMFullAccess` cochée
- [ ] `AmazonRDSFullAccess` cochée
- [ ] `AmazonElastiCacheFullAccess` cochée
- [ ] `AmazonVPCFullAccess` cochée
- [ ] `CloudWatchLogsFullAccess` cochée
- [ ] `IAMFullAccess` cochée
- [ ] `AmazonS3FullAccess` cochée
- [ ] `CloudFrontFullAccess` cochée
- [ ] `AmazonAPIGatewayAdministrator` cochée
- [ ] `ElasticLoadBalancingFullAccess` OU `ElasticLoadBalancingV2FullAccess` cochée
- [ ] **Total : 12 politiques cochées**

---

## ⚠️ Note sur la Sécurité

**Ces politiques donnent des permissions larges.** C'est acceptable pour démarrer, mais pour la production, vous devriez :

1. **Créer des politiques personnalisées** avec permissions limitées
2. **Limiter par ressource** (seulement les ressources du projet)
3. **Limiter par région** (seulement la région utilisée)

**Pour l'instant, ces politiques sont suffisantes pour que tout fonctionne.**

---

## 📝 Après l'Attachement

Une fois les 12 politiques cochées :

1. ✅ Cliquez sur **"Suivant" (Next)**
2. ✅ Sur la page "Vérifier et créer", vérifiez que tout est correct
   - Vérifiez que **12 politiques** sont listées
3. ✅ Cliquez sur **"Créer un utilisateur" (Create user)**
4. ✅ **Ensuite**, créez les Access Keys (étape suivante)

---

## 🆘 Si Vous Ne Trouvez Pas une Politique

**Vérifiez :**
- ✅ Vous êtes dans la bonne région (peu importe, les politiques sont globales)
- ✅ Vous utilisez le bon filtre (AWS managed)
- ✅ Vous avez tapé le bon nom dans la recherche

**Si une politique n'existe pas :**
- Vérifiez le nom exact (les noms peuvent varier légèrement)
- Certaines politiques peuvent avoir des noms différents selon la région/langue

**Alternative :** Vous pouvez créer l'utilisateur avec les politiques disponibles et ajouter les autres plus tard.

---

## 🎯 Résumé

**Action :** Sélectionner "Attacher directement des politiques" et cocher les **12 politiques** listées ci-dessus (incluant S3, CloudFront, API Gateway et Load Balancer pour WebSocket/WebRTC).

**Résultat :** L'utilisateur aura toutes les permissions nécessaires pour que GitHub Actions puisse déployer sur AWS.

