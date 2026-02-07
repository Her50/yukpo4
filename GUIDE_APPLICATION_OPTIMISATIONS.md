# 🚀 Guide : Application de Toutes les Optimisations

## 📋 Ce que le script fait

Le script `apply-all-optimizations.ps1` applique automatiquement :

1. ✅ **Optimisation des coûts AWS** (~$122/mois économisés)
   - Réduit RDS : db.t3.medium → db.t3.micro
   - Réduit ECS : 2 tasks → 1 task
   - Désactive NAT Gateway
   - Optimise ElastiCache : cache.t3.small → cache.t3.micro
   - Optimise CloudWatch

2. ✅ **Migration Redis vers ElastiCache**
   - Récupère l'endpoint ElastiCache
   - Met à jour Secrets Manager
   - Redéploie le service ECS

3. ✅ **Correction Vue Matérialisée PostgreSQL**
   - Crée l'index unique nécessaire
   - Active le refresh automatique

---

## 🎯 Utilisation

### Option 1 : Mode Dry-Run (Recommandé d'abord)

Voir ce qui sera fait sans appliquer :

```powershell
cd scripts
.\apply-all-optimizations.ps1 -DryRun
```

### Option 2 : Application Complète

Appliquer toutes les optimisations :

```powershell
cd scripts
.\apply-all-optimizations.ps1
```

Le script vous demandera confirmation avant d'appliquer les changements Terraform.

### Option 3 : Options Partielles

```powershell
# Ignorer la migration Redis
.\apply-all-optimizations.ps1 -SkipRedis

# Ignorer la correction PostgreSQL
.\apply-all-optimizations.ps1 -SkipPostgres

# Les deux
.\apply-all-optimizations.ps1 -SkipRedis -SkipPostgres
```

---

## ⚠️ Prérequis

1. **AWS CLI configuré** avec les bonnes credentials
2. **Terraform installé**
3. **Accès aux ressources AWS** :
   - RDS
   - ECS
   - ElastiCache
   - Secrets Manager
4. **psql installé** (optionnel, pour correction PostgreSQL automatique)

---

## 📋 Étapes Détaillées

### Étape 1 : Vérification

Le script vérifie automatiquement :
- ✅ AWS CLI installé
- ✅ Terraform installé
- ✅ Fichier terraform.tfvars.test existe

### Étape 2 : Sauvegarde

Le script sauvegarde automatiquement :
- ✅ `terraform.tfvars` → `terraform.tfvars.production.backup`
- ✅ Récupère les valeurs sensibles (mot de passe RDS, JWT secret)

### Étape 3 : Application Terraform

Le script :
1. Copie `terraform.tfvars.test` → `terraform.tfvars`
2. Remplace les valeurs sensibles automatiquement
3. Exécute `terraform plan`
4. Demande confirmation
5. Exécute `terraform apply`

**⚠️ ATTENTION** :
- RDS sera redémarré (downtime ~5-10 min)
- ECS tasks seront recréées
- NAT Gateway sera supprimé

### Étape 4 : Migration Redis

Le script :
1. Attend que ElastiCache soit prêt (30-60 secondes)
2. Récupère l'endpoint ElastiCache
3. Met à jour Secrets Manager avec la nouvelle REDIS_URL
4. Redéploie le service ECS

### Étape 5 : Correction PostgreSQL

Le script :
1. Récupère l'endpoint RDS
2. Exécute le script SQL pour créer l'index unique
3. Active le refresh automatique

**Note** : Si psql n'est pas installé, le script affiche la commande à exécuter manuellement.

---

## 🔍 Vérifications Post-Application

### 1. Vérifier les Coûts

```powershell
.\scripts\optimize-aws-costs.ps1 -CheckCosts
```

### 2. Vérifier l'État RDS

```powershell
aws rds describe-db-instances `
  --db-instance-identifier yukpomnang-db `
  --region us-east-1 `
  --query 'DBInstances[0].[DBInstanceStatus,DBInstanceClass,AllocatedStorage]'
```

**Résultat attendu** :
- Status : `available`
- InstanceClass : `db.t3.micro`
- AllocatedStorage : `20`

### 3. Vérifier l'État ECS

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region us-east-1 `
  --query 'services[0].[status,runningCount,desiredCount]'
```

**Résultat attendu** :
- Status : `ACTIVE`
- RunningCount : `1`
- DesiredCount : `1`

### 4. Vérifier ElastiCache

```powershell
aws elasticache describe-replication-groups `
  --replication-group-id yukpomnang-redis `
  --region us-east-1 `
  --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]'
```

**Résultat attendu** :
- Status : `available`
- Address : `yukpomnang-redis.xxxxx.cache.amazonaws.com`

### 5. Vérifier les Logs ECS

```powershell
aws logs tail /ecs/yukpomnang-backend `
  --follow `
  --region us-east-1 `
  --filter-pattern "Redis"
```

**Rechercher** :
- ✅ `[Redis] Health check réussi`
- ✅ `[Redis] Connexion établie`
- ❌ `[Redis] Health check échoué` (si problème)

### 6. Vérifier la Vue Matérialisée

```powershell
# Se connecter à RDS
psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang

# Vérifier l'index
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'services_search_optimized_v2'
AND indexname LIKE '%unique%';
```

**Résultat attendu** : Index `idx_services_search_optimized_v2_unique` existe

---

## ⚠️ Problèmes Potentiels

### Problème 1 : Terraform échoue

**Symptôme** : Erreur lors de `terraform apply`

**Solution** :
1. Vérifier les credentials AWS
2. Vérifier que la région est correcte
3. Vérifier que les ressources n'existent pas déjà
4. Consulter les logs Terraform

### Problème 2 : ElastiCache non disponible

**Symptôme** : Impossible de récupérer l'endpoint

**Solution** :
1. Attendre quelques minutes (ElastiCache prend du temps à démarrer)
2. Vérifier manuellement :
   ```powershell
   aws elasticache describe-replication-groups --replication-group-id yukpomnang-redis --region us-east-1
   ```
3. Relancer la migration Redis manuellement si nécessaire

### Problème 3 : ECS ne se connecte pas à Redis

**Symptôme** : Logs montrent des erreurs Redis

**Solution** :
1. Vérifier le Security Group ECS autorise les connexions vers ElastiCache
2. Vérifier que REDIS_URL dans Secrets Manager est correcte
3. Redémarrer le service ECS :
   ```powershell
   aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region us-east-1
   ```

### Problème 4 : psql non installé

**Symptôme** : Script PostgreSQL ne s'exécute pas

**Solution** :
1. Installer PostgreSQL client
2. Ou exécuter manuellement :
   ```powershell
   psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang -f scripts/fix-postgres-materialized-view.sql
   ```

---

## 📊 Résultats Attendus

### Coûts

| Avant | Après | Économie |
|-------|-------|----------|
| ~$200-265/mois | ~$96-130/mois | **~$122/mois** |

### Performance

- ✅ Redis : Plus de rate limiting, latence réduite
- ✅ PostgreSQL : Vue matérialisée rafraîchie automatiquement
- ⚠️ RDS : Légèrement plus lent (db.t3.micro vs db.t3.medium)
- ⚠️ ECS : Moins de ressources (1 task au lieu de 2)

### Disponibilité

- ⚠️ RDS : Downtime ~5-10 min pendant le redémarrage
- ✅ ECS : Pas de downtime (redéploiement progressif)
- ✅ Redis : Pas de downtime (migration transparente)

---

## ✅ Checklist Post-Application

- [ ] Terraform apply réussi
- [ ] RDS redémarré et disponible (db.t3.micro)
- [ ] ECS service actif avec 1 task
- [ ] ElastiCache créé et disponible
- [ ] Redis migré (logs ECS OK)
- [ ] Vue matérialisée corrigée (index créé)
- [ ] Coûts vérifiés (réduction confirmée)
- [ ] Application fonctionne correctement

---

## 🆘 Besoin d'Aide ?

Consulter :
- `ANALYSE_LOGS_AWS_COUTS.md` : Analyse complète
- `COMPARAISON_COUTS_REDIS.md` : Comparaison Redis
- `EXPLICATION_VUE_MATERIALISEE.md` : Explication vue matérialisée
- `scripts/migrate-redis-to-elasticache.md` : Guide migration Redis

---

**Temps estimé** : 15-20 minutes  
**Downtime** : ~5-10 minutes (redémarrage RDS)  
**Économie** : ~$122/mois

