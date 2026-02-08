# Status des Optimisations AWS

## Problème Rencontré

L'application automatique des optimisations via Terraform a échoué car :
1. **Création d'un nouveau VPC** : Terraform tente de créer un nouveau VPC au lieu d'utiliser l'existant
2. **Ressources en cours d'utilisation** : Les security groups et subnets ne peuvent pas être supprimés car ils sont utilisés par RDS
3. **Problèmes de connectivité réseau** : Erreurs DNS lors de la suppression des ressources

## Approche Alternative : Optimisations Incrémentales

Au lieu de remplacer toute l'infrastructure, appliquons les optimisations de manière incrémentale sur les ressources existantes.

### Optimisations qui peuvent être appliquées SANS downtime :

1. ✅ **RDS** : Réduire `db.t3.medium` → `db.t3.micro` (modification in-place)
2. ✅ **ElastiCache** : Réduire `cache.t3.small` → `cache.t3.micro` (modification in-place)
3. ✅ **ECS** : Réduire task count de 2 → 1 (modification in-place)
4. ✅ **ECS** : Réduire CPU/Memory (nécessite nouvelle task definition)
5. ✅ **RDS** : Réduire backup retention de 7 → 3 jours
6. ✅ **CloudWatch** : Réduire log retention

### Optimisations qui nécessitent plus de précaution :

- ⚠️ **NAT Gateway** : Désactiver (économise ~$35/mois mais nécessite reconfiguration réseau)
- ⚠️ **VPC/Subnets** : Ne PAS remplacer (trop risqué)

## Prochaines Étapes Recommandées

### Option 1 : Via AWS Console (Recommandé pour tests)
1. Aller dans AWS Console → RDS → Modifier l'instance → Changer `db.t3.medium` → `db.t3.micro`
2. Aller dans AWS Console → ElastiCache → Modifier le cluster → Changer `cache.t3.small` → `cache.t3.micro`
3. Aller dans AWS Console → ECS → Service → Modifier desired count de 2 → 1

### Option 2 : Via AWS CLI (Script automatisé)
Un script PowerShell sera créé pour appliquer ces changements via AWS CLI.

### Option 3 : Corriger Terraform (Pour production)
1. Importer le VPC existant dans Terraform state
2. Utiliser un data source pour référencer le VPC existant au lieu d'en créer un nouveau
3. Appliquer les changements progressivement

## Économies Estimées

- RDS : ~$40/mois (db.t3.medium → db.t3.micro)
- ElastiCache : ~$10/mois (cache.t3.small → cache.t3.micro)
- ECS : ~$30/mois (2 tasks → 1 task)
- NAT Gateway : ~$35/mois (si désactivé)
- **TOTAL : ~$115/mois économisés** (sans NAT Gateway) ou **~$150/mois** (avec NAT Gateway désactivé)

## Actions Immédiates

1. ✅ Corriger l'erreur PostgreSQL materialized view (script SQL disponible)
2. ⏳ Appliquer optimisations RDS/ElastiCache/ECS via AWS Console ou CLI
3. ⏳ Migrer Redis URL dans Secrets Manager après création ElastiCache
4. ⏳ Vérifier que le backend fonctionne avec les nouvelles configurations



