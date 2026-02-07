# 📊 Analyse des Logs AWS et Optimisation des Coûts

**Date** : 2026-02-05  
**Fichier analysé** : `log-events-viewer-result (30).csv`

---

## 🔍 1. ÉTAT DU SYSTÈME

### ✅ Backend Opérationnel

**Statut** : ✅ **FONCTIONNEL**

Les logs montrent que le backend Rust fonctionne correctement :
- ✅ Connexion PostgreSQL active (requêtes d'index exécutées avec succès)
- ✅ Optimisation des index de base de données en cours
- ✅ Services spécialisés (pharmacies, hôpitaux, laboratoires, agences) opérationnels
- ✅ Cache refresh en cours

**Preuve** : Lignes 2-89 du CSV montrent des requêtes INFO réussies sur les index PostgreSQL.

### ✅ Base de Données PostgreSQL

**Statut** : ✅ **OPÉRATIONNELLE**

- ✅ Connexion active
- ✅ Requêtes d'index exécutées avec succès
- ✅ Vue matérialisée `services_search_optimized_v2` présente
- ⚠️ **Problème mineur** : Erreur lors du refresh concurrent de la vue matérialisée (lignes 91, 153)

**Erreur détectée** :
```
cannot refresh materialized view "public.services_search_optimized_v2" concurrently
```

**Solution** : Utiliser `REFRESH MATERIALIZED VIEW` sans `CONCURRENTLY` ou créer un index unique sur la vue.

---

## ⚠️ 2. PROBLÈMES IDENTIFIÉS

### 🔴 Problème 1 : Redis Rate-Limited (CRITIQUE)

**Fréquence** : Répété toutes les ~10 minutes

**Erreur** :
```
[Redis] Health check échoué - Redis non disponible
ResponseError: Your database has been temporarily rate-limited, 
please contact support@upstash.com for further details.
```

**Impact** :
- ⚠️ Redis Upstash est rate-limited (limite de requêtes dépassée)
- ⚠️ Fallback gracieux activé (système continue de fonctionner mais sans cache)
- ⚠️ Performance dégradée

**Solutions** :
1. **Court terme** : Contacter Upstash support pour augmenter la limite
2. **Moyen terme** : Migrer vers ElastiCache Redis sur AWS (déjà configuré dans Terraform)
3. **Optimisation** : Réduire la fréquence des requêtes Redis

### 🟡 Problème 2 : Rate Limiting Massif des Workers

**Fréquence** : Toutes les 30 secondes

**Workers affectés** :
- `flash_sale_queue_worker` (lignes 94-201)
- `notification_queue_worker` (lignes 95-201)

**Impact** :
- ⚠️ Workers en attente permanente (30 secondes entre chaque retry)
- ⚠️ Probablement lié au rate limiting Redis
- ⚠️ Performance dégradée des notifications et flash sales

**Solution** : Résoudre le problème Redis en priorité.

### 🟡 Problème 3 : Vue Matérialisée PostgreSQL

**Erreur** : Refresh concurrent impossible

**Solution** :
```sql
-- Option 1 : Refresh sans CONCURRENTLY
REFRESH MATERIALIZED VIEW services_search_optimized_v2;

-- Option 2 : Créer index unique si nécessaire
CREATE UNIQUE INDEX ON services_search_optimized_v2 (id);
```

---

## 💰 3. ANALYSE DES COÛTS AWS

### 📊 Coûts Estimés Actuels (Configuration par défaut)

| Service | Configuration | Coût/mois | Réduction Possible |
|---------|---------------|-----------|-------------------|
| **RDS PostgreSQL** | db.t3.medium | ~$60-80 | ⬇️ db.t3.micro (-$40) |
| **ElastiCache Redis** | cache.t3.small | ~$15-20 | ⬇️ cache.t3.micro (-$10) |
| **ECS Fargate** | 2 tasks × 1 vCPU × 2GB | ~$60-80 | ⬇️ 1 task (-$30) |
| **ALB** | Standard | ~$20-25 | ❌ Nécessaire |
| **NAT Gateway** | 1 instance | ~$35-45 | ⬇️ Désactiver (-$35) |
| **CloudWatch Logs** | 7 jours retention | ~$5-10 | ⬇️ 3 jours (-$2) |
| **EIP (NAT)** | 1 IP | ~$3-5 | ⬇️ Supprimé si NAT désactivé |
| **Total Actuel** | | **~$198-265/mois** | |
| **Total Optimisé** | | **~$96-130/mois** | **Économie : ~$100-135/mois** |

### 🔴 Sources de Coûts Élevés

#### 1. **NAT Gateway** (~$35-45/mois)
- **Problème** : Coût fixe même si peu utilisé
- **Solution** : Désactiver si ECS peut utiliser IPs publiques (pour tests)

#### 2. **RDS db.t3.medium** (~$60-80/mois)
- **Problème** : Sur-dimensionné pour phase de tests
- **Solution** : Passer à db.t3.micro (~$15-20/mois)

#### 3. **ECS 2 Tasks** (~$60-80/mois)
- **Problème** : 2 tâches en parallèle pour tests
- **Solution** : Réduire à 1 task (~$30-40/mois)

#### 4. **ElastiCache cache.t3.small** (~$15-20/mois)
- **Problème** : Sur-dimensionné
- **Solution** : Passer à cache.t3.micro (~$5-8/mois)

#### 5. **CloudWatch Logs** (~$5-10/mois)
- **Problème** : Beaucoup de logs générés
- **Solution** : Réduire retention à 3 jours

---

## 🎯 4. PLAN D'OPTIMISATION IMMÉDIATE

### Priorité 1 : Réduire les Coûts (URGENT)

#### Étape 1 : Modifier Terraform pour Configuration Test

Créer `infra/aws/terraform.tfvars.test` :

```hcl
# Configuration optimisée pour tests (réduction ~60% coûts)

aws_region  = "eu-west-1"
project_name = "yukpomnang"
environment  = "dev"  # ← Important : dev pour skip final snapshot

# Network - DÉSACTIVER NAT GATEWAY
enable_nat_gateway = false  # ← Économie ~$35/mois

# RDS - RÉDUIRE TAILLE
rds_instance_class      = "db.t3.micro"  # ← Économie ~$40/mois
rds_allocated_storage   = 20
rds_max_allocated_storage = 50  # ← Réduire max
rds_backup_retention    = 3  # ← Réduire backups

# ElastiCache - RÉDUIRE TAILLE
redis_node_type      = "cache.t3.micro"  # ← Économie ~$10/mois
redis_num_nodes      = 1

# ECS - RÉDUIRE NOMBRE DE TASKS
ecs_cpu          = 512   # ← 0.5 vCPU (économise ~$15/mois)
ecs_memory       = 1024  # ← 1 GB (économise ~$15/mois)
ecs_desired_count = 1    # ← 1 task au lieu de 2 (économise ~$30/mois)
ecs_min_count    = 1
ecs_max_count    = 2     # ← Limiter auto-scaling

# CloudWatch - RÉDUIRE RETENTION
log_retention_days = 3  # ← Économie ~$2/mois
enable_container_insights = false  # ← Économie ~$5/mois
```

#### Étape 2 : Appliquer les Changements

```powershell
cd infra/aws

# Sauvegarder config actuelle
cp terraform.tfvars terraform.tfvars.production.backup

# Utiliser config test
cp terraform.tfvars.test terraform.tfvars

# Planifier les changements
terraform plan -out=tfplan

# Appliquer (ATTENTION : vérifier les changements avant)
terraform apply tfplan
```

**⚠️ ATTENTION** : 
- RDS sera redémarré (downtime ~5-10 min)
- ECS tasks seront recréées
- NAT Gateway sera supprimé (ECS utilisera IPs publiques)

### Priorité 2 : Résoudre Problèmes Techniques

#### 1. Migrer Redis vers ElastiCache

```powershell
# Vérifier que ElastiCache est créé
aws elasticache describe-replication-groups --region eu-west-1

# Mettre à jour DATABASE_URL dans Secrets Manager
aws secretsmanager update-secret \
  --secret-id yukpomnang/backend/secrets \
  --secret-string file://secrets-updated.json
```

#### 2. Corriger Vue Matérialisée

```sql
-- Se connecter à RDS
psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang

-- Option 1 : Refresh sans CONCURRENTLY
REFRESH MATERIALIZED VIEW services_search_optimized_v2;

-- Option 2 : Créer index unique si nécessaire
CREATE UNIQUE INDEX IF NOT EXISTS services_search_optimized_v2_id_idx 
ON services_search_optimized_v2 (id);
```

---

## 📋 5. CHECKLIST OPTIMISATION

### ✅ Actions Immédiates (Aujourd'hui)

- [ ] Créer `terraform.tfvars.test` avec configuration optimisée
- [ ] Sauvegarder configuration actuelle
- [ ] Appliquer changements Terraform (réduire RDS, ECS, NAT)
- [ ] Vérifier que le système fonctionne après changements

### ✅ Actions Court Terme (Cette Semaine)

- [ ] Migrer Redis Upstash → ElastiCache AWS
- [ ] Corriger vue matérialisée PostgreSQL
- [ ] Configurer alertes AWS Budget
- [ ] Réduire retention CloudWatch Logs

### ✅ Actions Moyen Terme (Ce Mois)

- [ ] Monitorer coûts avec AWS Cost Explorer
- [ ] Optimiser requêtes PostgreSQL (EXPLAIN ANALYZE)
- [ ] Réduire fréquence workers si possible
- [ ] Configurer auto-scaling plus agressif (scale down rapide)

---

## 🔧 6. SCRIPTS UTILES

### Script 1 : Vérifier Coûts AWS

```powershell
# Vérifier coûts par service (derniers 7 jours)
aws ce get-cost-and-usage \
  --time-period Start=2026-01-29,End=2026-02-05 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region eu-west-1
```

### Script 2 : Vérifier État RDS

```powershell
aws rds describe-db-instances \
  --db-instance-identifier yukpomnang-db \
  --region eu-west-1 \
  --query 'DBInstances[0].[DBInstanceStatus,DBInstanceClass,AllocatedStorage]'
```

### Script 3 : Vérifier État ECS

```powershell
aws ecs describe-services \
  --cluster yukpomnang-cluster \
  --services yukpomnang-backend-service \
  --region eu-west-1 \
  --query 'services[0].[status,runningCount,desiredCount]'
```

### Script 4 : Vérifier NAT Gateway

```powershell
aws ec2 describe-nat-gateways \
  --region eu-west-1 \
  --filter "Name=tag:Name,Values=yukpomnang-nat-gateway" \
  --query 'NatGateways[0].[State,NatGatewayId]'
```

---

## 📊 7. MONITORING COÛTS

### Configurer AWS Budget

```powershell
# Créer budget de $100/mois avec alertes
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget-config.json \
  --notifications-with-subscribers file://budget-notifications.json
```

**Fichier `budget-config.json`** :
```json
{
  "BudgetName": "yukpomnang-monthly-budget",
  "BudgetLimit": {
    "Amount": "100",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {
    "Tag": [
      {
        "Key": "Project",
        "Values": ["Yukpomnang"]
      }
    ]
  }
}
```

**Fichier `budget-notifications.json`** :
```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "votre-email@example.com"
      }
    ]
  }
]
```

---

## 🎯 8. RÉSUMÉ ET RECOMMANDATIONS

### ✅ État Actuel

- **Backend** : ✅ Opérationnel
- **PostgreSQL** : ✅ Opérationnel (problème mineur vue matérialisée)
- **Redis** : ⚠️ Rate-limited (Upstash)
- **Coûts AWS** : 🔴 Élevés (~$200-265/mois pour tests)

### 🎯 Objectif

**Réduire coûts de ~60%** : De $200-265/mois → **$96-130/mois**

### 📋 Actions Prioritaires

1. **URGENT** : Appliquer configuration test (réduire RDS, ECS, désactiver NAT)
2. **IMPORTANT** : Migrer Redis vers ElastiCache
3. **IMPORTANT** : Configurer AWS Budget avec alertes
4. **MOYEN** : Corriger vue matérialisée PostgreSQL

### 💡 Conseils Long Terme

- **Phase Tests** : Utiliser configuration minimale (db.t3.micro, 1 ECS task, pas de NAT)
- **Phase Production** : Augmenter progressivement selon besoins réels
- **Monitoring** : Configurer alertes dès le début pour éviter surprises
- **Auto-scaling** : Configurer scale-down agressif (réduire rapidement si pas de charge)

---

**Document créé le** : 2026-02-05  
**Version** : 1.0  
**Prochaine révision** : Après application des optimisations

