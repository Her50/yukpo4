# 🚨 Actions Urgentes - Réduction Coûts AWS

**Date** : 2026-02-05  
**Problème** : Facture AWS exorbitante (~$200-265/mois) en phase de tests

---

## ✅ ÉTAT DU SYSTÈME

### Backend & Base de Données
- ✅ **Backend opérationnel** : Fonctionne correctement
- ✅ **PostgreSQL opérationnel** : Connexion active, requêtes réussies
- ⚠️ **Problème mineur** : Erreur vue matérialisée (non bloquant)

### Problèmes Identifiés
- 🔴 **Redis rate-limited** : Upstash limite les requêtes (migrer vers ElastiCache)
- 🟡 **Workers en attente** : Rate limiting cause des retards
- 💰 **Coûts élevés** : Configuration sur-dimensionnée pour tests

---

## 🎯 SOLUTION IMMÉDIATE

### Réduire les Coûts de ~60% (URGENT)

**Coût actuel** : ~$200-265/mois  
**Coût optimisé** : ~$96-130/mois  
**Économie** : ~$100-135/mois

### Actions à Prendre

#### 1. Appliquer Configuration Optimisée (5 minutes)

```powershell
# Exécuter le script d'optimisation
cd scripts
.\optimize-aws-costs.ps1 -ApplyOptimizations
```

**Ce que ça fait** :
- ✅ Réduit RDS : db.t3.medium → db.t3.micro (-$40/mois)
- ✅ Réduit ECS : 2 tasks → 1 task (-$30/mois)
- ✅ Désactive NAT Gateway (-$35/mois)
- ✅ Réduit ElastiCache : cache.t3.small → cache.t3.micro (-$10/mois)
- ✅ Optimise CloudWatch (-$7/mois)

**⚠️ ATTENTION** :
- RDS sera redémarré (downtime ~5-10 min)
- ECS tasks seront recréées
- NAT Gateway sera supprimé

#### 2. Migrer Redis vers ElastiCache (10 minutes)

Suivre le guide : `scripts/migrate-redis-to-elasticache.md`

**Bénéfices** :
- ✅ Élimine rate limiting
- ✅ Améliore performances
- ✅ Réduit coûts (~$5-12/mois)

#### 3. Corriger Vue Matérialisée PostgreSQL (2 minutes)

```powershell
# Se connecter à RDS et exécuter
psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang -f scripts/fix-postgres-materialized-view.sql
```

---

## 📋 CHECKLIST RAPIDE

### Aujourd'hui (URGENT)
- [ ] Exécuter `scripts/optimize-aws-costs.ps1 -ApplyOptimizations`
- [ ] Vérifier que le système fonctionne après optimisation
- [ ] Vérifier les coûts avec `scripts/optimize-aws-costs.ps1 -CheckCosts`

### Cette Semaine
- [ ] Migrer Redis vers ElastiCache
- [ ] Corriger vue matérialisée PostgreSQL
- [ ] Configurer alertes AWS Budget

### Ce Mois
- [ ] Monitorer coûts régulièrement
- [ ] Optimiser requêtes PostgreSQL si nécessaire
- [ ] Ajuster auto-scaling selon utilisation réelle

---

## 📊 FICHIERS CRÉÉS

1. **`ANALYSE_LOGS_AWS_COUTS.md`** : Analyse détaillée des logs et coûts
2. **`infra/aws/terraform.tfvars.test`** : Configuration optimisée pour tests
3. **`scripts/optimize-aws-costs.ps1`** : Script PowerShell pour optimiser
4. **`scripts/fix-postgres-materialized-view.sql`** : Fix vue matérialisée
5. **`scripts/migrate-redis-to-elasticache.md`** : Guide migration Redis

---

## 🚀 COMMANDES RAPIDES

### Vérifier les coûts
```powershell
.\scripts\optimize-aws-costs.ps1 -CheckCosts
```

### Appliquer optimisations
```powershell
.\scripts\optimize-aws-costs.ps1 -ApplyOptimizations
```

### Vérifier état infrastructure
```powershell
aws rds describe-db-instances --db-instance-identifier yukpomnang-db --region eu-west-1
aws ecs describe-services --cluster yukpomnang-cluster --services yukpomnang-backend-service --region eu-west-1
```

---

## 💡 CONSEILS

1. **Phase Tests** : Utiliser toujours configuration minimale
2. **Monitoring** : Configurer alertes AWS Budget dès le début
3. **Auto-scaling** : Configurer scale-down agressif (réduire rapidement si pas de charge)
4. **Backups** : Réduire retention en phase tests (3 jours au lieu de 7)

---

## 📞 BESOIN D'AIDE ?

Consulter :
- `ANALYSE_LOGS_AWS_COUTS.md` : Analyse complète
- `scripts/optimize-aws-costs.ps1` : Script interactif
- `infra/aws/README.md` : Documentation Terraform

---

**Action immédiate recommandée** : Exécuter `scripts/optimize-aws-costs.ps1 -ApplyOptimizations`

