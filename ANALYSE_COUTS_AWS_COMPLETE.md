# 💰 Analyse Complète des Coûts AWS - Yukpomnang

**Date** : 2026-02-05  
**Contexte** : Backend et PostgreSQL migrés vers AWS, coûts élevés en phase de test

---

## 🔍 1. RESSOURCES AWS DÉPLOYÉES

### Infrastructure Réseau
- ✅ **VPC** : Gratuit
- ✅ **Internet Gateway** : Gratuit
- ⚠️ **NAT Gateway** : **~$35-45/mois** (coût fixe + transfert de données)
- ⚠️ **Elastic IP (NAT)** : **~$3-5/mois** (si NAT Gateway actif)
- ✅ **Subnets** : Gratuit
- ✅ **Route Tables** : Gratuit
- ✅ **Security Groups** : Gratuit

### Base de Données
- ⚠️ **RDS PostgreSQL db.t3.medium** : **~$60-80/mois**
  - Instance : ~$50-65/mois
  - Storage (20 GB gp3) : ~$2/mois
  - Backups (7 jours) : ~$3-5/mois
  - Performance Insights (si activé) : **~$10-15/mois** ⚠️
  - Transfert de données : Variable

### Cache
- ⚠️ **ElastiCache Redis cache.t3.small** : **~$15-20/mois**
  - Instance : ~$12-15/mois
  - Storage : ~$1-2/mois
  - Transfert : Variable

### Conteneurs (ECS Fargate)
- ⚠️ **ECS Fargate** : **~$60-80/mois** (2 tasks × 1 vCPU × 2GB)
  - CPU : ~$0.04/heure × 2 tasks × 730h = **~$58/mois**
  - Mémoire : ~$0.004/GB/heure × 2GB × 2 tasks × 730h = **~$12/mois**
  - Total : **~$70/mois**

### Load Balancer
- ⚠️ **Application Load Balancer (ALB)** : **~$20-25/mois**
  - Coût fixe : ~$16/mois
  - LCU (Load Balancer Capacity Units) : ~$4-9/mois selon trafic

### Monitoring & Logs
- ⚠️ **CloudWatch Logs** : **~$5-15/mois**
  - Ingestion : ~$0.50/GB
  - Stockage : ~$0.03/GB/mois
  - Retention 7 jours : Variable selon volume
- ⚠️ **CloudWatch Container Insights** : **~$5-10/mois** (si activé)
  - Métriques détaillées : ~$0.10/container/mois
  - Logs supplémentaires : Variable

### Stockage (S3/Wasabi)
- ✅ **S3** : Variable selon utilisation (probablement <$5/mois pour tests)
- ✅ **ECR (Docker Registry)** : Gratuit jusqu'à 500MB, puis ~$0.10/GB/mois

### Autres Services
- ✅ **Secrets Manager** : **~$0.40/secret/mois** (1 secret = ~$0.40/mois)
- ✅ **IAM** : Gratuit

---

## 💰 2. ESTIMATION DES COÛTS TOTAUX

### Configuration Actuelle (Production-like)

| Service | Coût Mensuel | Détails |
|---------|--------------|---------|
| **NAT Gateway** | $35-45 | Coût fixe + transfert |
| **Elastic IP** | $3-5 | Si NAT Gateway actif |
| **RDS db.t3.medium** | $60-80 | Instance + storage + backups |
| **Performance Insights** | $10-15 | ⚠️ Si activé (coût caché !) |
| **ElastiCache cache.t3.small** | $15-20 | Instance + storage |
| **ECS Fargate (2 tasks)** | $60-80 | CPU + mémoire |
| **ALB** | $20-25 | Fixe + LCU |
| **CloudWatch Logs** | $5-15 | Ingestion + stockage |
| **Container Insights** | $5-10 | ⚠️ Si activé (coût caché !) |
| **Secrets Manager** | $0.40 | 1 secret |
| **S3/ECR** | $1-5 | Stockage minimal |
| **Transfert de données** | $5-20 | Variable selon trafic |
| **TOTAL** | **~$224-330/mois** | **~€200-300/mois** |

### ⚠️ Coûts Cachés Identifiés

1. **Performance Insights RDS** (~$10-15/mois)
   - Activé si `performance_insights_enabled = true` dans Terraform
   - Ligne 307 de `main.tf` : `performance_insights_enabled = var.environment == "production"`

2. **Container Insights** (~$5-10/mois)
   - Activé si `enable_container_insights = true`
   - Ligne 496 de `main.tf` : Activé par défaut dans variables

3. **Transfert de données NAT Gateway** (~$0.045/GB)
   - Coût additionnel si beaucoup de trafic sortant

4. **Backups RDS** (~$3-5/mois)
   - 7 jours de retention = stockage supplémentaire

---

## 🎯 3. CONFIGURATION OPTIMISÉE POUR TESTS

### Configuration Recommandée (Réduction ~60%)

| Service | Avant | Après | Économie |
|---------|-------|-------|----------|
| **NAT Gateway** | $35-45 | $0 (désactivé) | **-$35-45** |
| **Elastic IP** | $3-5 | $0 | **-$3-5** |
| **RDS** | $60-80 | $15-20 (db.t3.micro) | **-$45-60** |
| **Performance Insights** | $10-15 | $0 (désactivé) | **-$10-15** |
| **ElastiCache** | $15-20 | $5-8 (cache.t3.micro) | **-$10-12** |
| **ECS Fargate** | $60-80 | $30-40 (1 task, 0.5 vCPU, 1GB) | **-$30-40** |
| **ALB** | $20-25 | $20-25 | $0 (nécessaire) |
| **CloudWatch Logs** | $5-15 | $2-5 (3 jours retention) | **-$3-10** |
| **Container Insights** | $5-10 | $0 (désactivé) | **-$5-10** |
| **TOTAL** | **$224-330** | **$87-123** | **~-$137-207/mois** |

### Nouveau Total Optimisé : **~$87-123/mois** (~€80-110/mois)

**Économie** : **~60% de réduction** (de $224-330 → $87-123/mois)

---

## 🔴 4. SOURCES DE COÛTS ÉLEVÉS IDENTIFIÉES

### Priorité 1 : Coûts Fixes Élevés

1. **NAT Gateway** (~$35-45/mois)
   - **Problème** : Coût fixe même si peu utilisé
   - **Solution** : Désactiver pour tests (ECS peut utiliser IPs publiques)
   - **Impact** : Économie immédiate de $35-45/mois

2. **RDS db.t3.medium** (~$60-80/mois)
   - **Problème** : Sur-dimensionné pour phase de tests
   - **Solution** : Passer à db.t3.micro (~$15-20/mois)
   - **Impact** : Économie de $45-60/mois

3. **ECS 2 Tasks** (~$60-80/mois)
   - **Problème** : 2 tâches en parallèle inutiles pour tests
   - **Solution** : Réduire à 1 task avec moins de ressources
   - **Impact** : Économie de $30-40/mois

### Priorité 2 : Coûts Cachés

4. **Performance Insights RDS** (~$10-15/mois)
   - **Problème** : Activé automatiquement en production
   - **Solution** : Désactiver pour tests
   - **Impact** : Économie de $10-15/mois

5. **Container Insights** (~$5-10/mois)
   - **Problème** : Activé par défaut dans variables
   - **Solution** : Désactiver pour tests
   - **Impact** : Économie de $5-10/mois

6. **ElastiCache cache.t3.small** (~$15-20/mois)
   - **Problème** : Sur-dimensionné
   - **Solution** : Passer à cache.t3.micro (~$5-8/mois)
   - **Impact** : Économie de $10-12/mois

### Priorité 3 : Coûts Variables

7. **CloudWatch Logs** (~$5-15/mois)
   - **Problème** : Beaucoup de logs générés, retention 7 jours
   - **Solution** : Réduire retention à 3 jours
   - **Impact** : Économie de $3-10/mois

8. **Transfert de données** (~$5-20/mois)
   - **Problème** : Variable selon trafic
   - **Solution** : Optimiser requêtes, réduire logs
   - **Impact** : Variable

---

## 🚀 5. PLAN D'ACTION IMMÉDIAT

### Étape 1 : Vérifier Configuration Actuelle

```powershell
# Vérifier l'état actuel des ressources
cd infra/aws

# Vérifier RDS
aws rds describe-db-instances \
  --db-instance-identifier yukpomnang-db \
  --region eu-west-1 \
  --query 'DBInstances[0].[DBInstanceClass,PerformanceInsightsEnabled,BackupRetentionPeriod]'

# Vérifier ECS
aws ecs describe-services \
  --cluster yukpomnang-cluster \
  --services yukpomnang-backend-service \
  --region eu-west-1 \
  --query 'services[0].[desiredCount,runningCount]'

# Vérifier NAT Gateway
aws ec2 describe-nat-gateways \
  --region eu-west-1 \
  --filter "Name=tag:Name,Values=yukpomnang-nat-gateway" \
  --query 'NatGateways[0].[State,NatGatewayId]'

# Vérifier Container Insights
aws ecs describe-clusters \
  --clusters yukpomnang-cluster \
  --region eu-west-1 \
  --include SETTINGS \
  --query 'clusters[0].settings'
```

### Étape 2 : Appliquer Configuration Optimisée

Votre fichier `terraform.tfvars` contient déjà une configuration optimisée. Vérifiez qu'elle est bien appliquée :

```powershell
cd infra/aws

# Vérifier la configuration actuelle
cat terraform.tfvars

# Si nécessaire, appliquer les changements
terraform plan
terraform apply
```

### Étape 3 : Désactiver Performance Insights (si activé)

```powershell
# Désactiver Performance Insights sur RDS
aws rds modify-db-instance \
  --db-instance-identifier yukpomnang-db \
  --no-enable-performance-insights \
  --apply-immediately \
  --region eu-west-1
```

### Étape 4 : Vérifier les Coûts Réels

```powershell
# Vérifier les coûts des 7 derniers jours
$startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
$endDate = (Get-Date).ToString("yyyy-MM-dd")

aws ce get-cost-and-usage \
  --time-period Start=$startDate,End=$endDate \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region eu-west-1
```

---

## 📊 6. COMPARAISON AVANT/APRÈS

### Avant Optimisation

```
Total mensuel : ~$224-330/mois (~€200-300/mois)
```

**Ressources** :
- NAT Gateway : ✅ Actif
- RDS : db.t3.medium
- ECS : 2 tasks × 1 vCPU × 2GB
- ElastiCache : cache.t3.small
- Performance Insights : ✅ Activé
- Container Insights : ✅ Activé
- CloudWatch : 7 jours retention

### Après Optimisation

```
Total mensuel : ~$87-123/mois (~€80-110/mois)
Économie : ~$137-207/mois (~60% de réduction)
```

**Ressources** :
- NAT Gateway : ❌ Désactivé
- RDS : db.t3.micro
- ECS : 1 task × 0.5 vCPU × 1GB
- ElastiCache : cache.t3.micro
- Performance Insights : ❌ Désactivé
- Container Insights : ❌ Désactivé
- CloudWatch : 3 jours retention

---

## ⚠️ 7. POINTS D'ATTENTION

### Limitations de la Configuration Optimisée

1. **db.t3.micro** :
   - ⚠️ Limité en CPU (burst credits)
   - ⚠️ 1 GB RAM seulement
   - ✅ Suffisant pour tests légers

2. **ECS 1 Task** :
   - ⚠️ Pas de haute disponibilité
   - ⚠️ Downtime lors des déploiements
   - ✅ Acceptable pour tests

3. **Pas de NAT Gateway** :
   - ⚠️ ECS utilise IPs publiques (moins sécurisé)
   - ✅ Acceptable pour tests
   - ⚠️ À réactiver pour production

4. **Container Insights désactivé** :
   - ⚠️ Moins de visibilité sur les performances
   - ✅ Logs CloudWatch toujours disponibles

### Recommandations pour Production

Quand vous passerez en production, réactivez progressivement :
1. NAT Gateway (sécurité)
2. db.t3.small ou db.t3.medium (performance)
3. 2+ ECS tasks (haute disponibilité)
4. Container Insights (monitoring)

---

## 🎯 8. CHECKLIST OPTIMISATION

### Actions Immédiates (Aujourd'hui)

- [ ] Vérifier configuration actuelle avec AWS CLI
- [ ] Vérifier si Performance Insights est activé
- [ ] Vérifier si Container Insights est activé
- [ ] Vérifier les coûts réels dans AWS Cost Explorer
- [ ] Appliquer configuration optimisée si nécessaire

### Actions Court Terme (Cette Semaine)

- [ ] Désactiver Performance Insights si activé
- [ ] Désactiver Container Insights si activé
- [ ] Réduire RDS à db.t3.micro
- [ ] Réduire ECS à 1 task avec moins de ressources
- [ ] Réduire ElastiCache à cache.t3.micro
- [ ] Désactiver NAT Gateway (si acceptable pour tests)
- [ ] Réduire retention CloudWatch à 3 jours
- [ ] Configurer AWS Budget avec alertes

### Actions Moyen Terme (Ce Mois)

- [ ] Monitorer coûts quotidiennement
- [ ] Optimiser requêtes PostgreSQL
- [ ] Réduire volume de logs si possible
- [ ] Configurer auto-scaling agressif (scale down rapide)

---

## 📞 9. SUPPORT AWS

Si les coûts restent élevés après optimisation :

1. **Vérifier AWS Cost Explorer** :
   - Identifier les services les plus coûteux
   - Vérifier les transferts de données
   - Vérifier les snapshots RDS

2. **Contacter AWS Support** :
   - Demander un audit des coûts
   - Vérifier s'il y a des ressources orphelines
   - Demander des recommandations d'optimisation

3. **Utiliser AWS Cost Anomaly Detection** :
   - Configurer des alertes automatiques
   - Détecter les pics de consommation

---

## 📝 10. RÉSUMÉ

### Problème Identifié

Votre infrastructure AWS est configurée pour la **production** alors que vous êtes en **phase de tests**, ce qui génère des coûts inutiles :

- **NAT Gateway** : $35-45/mois (inutile pour tests)
- **RDS db.t3.medium** : $60-80/mois (sur-dimensionné)
- **ECS 2 tasks** : $60-80/mois (inutile pour tests)
- **Performance Insights** : $10-15/mois (coût caché)
- **Container Insights** : $5-10/mois (coût caché)

### Solution

Appliquer la configuration optimisée déjà présente dans `terraform.tfvars` :

- **Total actuel** : ~$224-330/mois
- **Total optimisé** : ~$87-123/mois
- **Économie** : **~$137-207/mois (60% de réduction)**

### Prochaines Étapes

1. ✅ Vérifier configuration actuelle
2. ✅ Appliquer optimisations
3. ✅ Monitorer coûts
4. ✅ Configurer alertes budget

---

**Document créé le** : 2026-02-05  
**Version** : 1.0  
**Prochaine révision** : Après application des optimisations

