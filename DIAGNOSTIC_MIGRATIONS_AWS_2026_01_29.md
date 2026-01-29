# 🔍 Diagnostic Complet - Migrations AWS (2026-01-29)

## 📋 Problème Identifié

Les logs AWS montrent que **9 tables critiques sont manquantes** en production :

### Tables Manquantes
1. `product_creation_queue` - Queue asynchrone pour création de produits
2. `delivery_matching_queue` - Queue pour matching des coursiers
3. `global_promo_events` - Événements promotionnels globaux
4. `live_flash_sales` - Flash sales en direct
5. `deliveries` - Table principale des livraisons
6. `delivery_proximity_suggestions` - Suggestions de proximité
7. `product_orders` - Commandes de produits
8. `social_publication_jobs` - Jobs de publication sociale
9. `video_generation_jobs` - Jobs de génération vidéo

## 🎯 Cause Probable

**Les migrations SQLx ne s'exécutent pas correctement au démarrage de l'application en production AWS.**

### Indicateurs
- ❌ Aucun log de migration visible dans les logs AWS
- ❌ Les tables critiques n'existent pas
- ❌ Les workers échouent en boucle
- ✅ L'application démarre quand même (les migrations échouent silencieusement)

## 🔧 Solutions Appliquées

### 1. Amélioration du Système de Migration (✅ Fait)

**Fichier** : `backend/src/main.rs`

**Améliorations** :
- ✅ Vérification de l'existence du dossier migrations
- ✅ Vérification complète de toutes les tables critiques après migration
- ✅ Logging détaillé de l'état des migrations
- ✅ Arrêt de l'application si trop de tables critiques sont manquantes en production

### 2. Vérification des Tables Critiques

Le code vérifie maintenant automatiquement l'existence de toutes les tables critiques :
- `users`, `services` (tables de base)
- `deliveries`, `product_creation_queue`, `delivery_matching_queue`
- `global_promo_events`, `live_flash_sales`
- `product_orders`, `social_publication_jobs`, `video_generation_jobs`
- `delivery_proximity_suggestions`

## 🚀 Actions Immédiates Requises

### Option 1 : Exécuter les Migrations Manuellement (RECOMMANDÉ)

**Via ECS Exec** (si activé) :
```bash
# Se connecter à une tâche ECS
aws ecs execute-command \
  --cluster yukpomnang-cluster \
  --task <TASK_ID> \
  --container yukpomnang-backend \
  --command "/bin/bash" \
  --interactive

# Dans le conteneur
cd /app/backend
export DATABASE_URL="<URL_FROM_SSM>"
sqlx migrate run
```

**Via Script Python** :
```bash
python scripts/run_migrations_aws.py
```

### Option 2 : Vérifier les Logs de Démarrage

Chercher dans CloudWatch Logs les lignes contenant :
- `🚀 Application des migrations SQLx standard...`
- `✅ Migrations SQLx standard appliquées avec succès`
- `❌ ERREUR DÉTAILLÉE lors de l'application des migrations SQLx standard`

### Option 3 : Vérifier la Configuration ECS

**Variables d'environnement requises** :
- `DATABASE_URL` - Doit pointer vers la base de données AWS RDS
- `ENABLE_AUTO_MIGRATIONS=true` - Pour activer les migrations automatiques

**Vérifier que le dossier migrations est inclus dans l'image Docker** :
```dockerfile
# Dans Dockerfile
COPY backend/migrations /app/backend/migrations
```

## 📊 Migrations Concernées

Les tables manquantes sont créées par ces migrations :

| Table | Migration |
|-------|-----------|
| `product_creation_queue` | `20260102_create_product_creation_queue.sql` |
| `delivery_matching_queue` | `20251115001_create_delivery_matching_tables.sql` |
| `global_promo_events` | `20251115002_create_global_promo_platform.sql` |
| `live_flash_sales` | `20251111001_002_create_live_flash_sales.sql` |
| `deliveries` | `0000_create_all_tables.sql` ou `20251110005_104_create_delivery_core.sql` |
| `product_orders` | `20250120_001_add_order_preparation_system.sql` |
| `social_publication_jobs` | `0000_create_all_tables.sql` ou `20251111002_create_social_connectors.sql` |
| `video_generation_jobs` | `0000_create_all_tables.sql` |
| `delivery_proximity_suggestions` | (Créée dans une migration de delivery) |

## 🔍 Diagnostic à Effectuer

### 1. Vérifier l'État des Migrations en Base

```sql
-- Se connecter à la base de données AWS RDS
SELECT version, description, success, installed_on 
FROM _sqlx_migrations 
ORDER BY version;
```

### 2. Vérifier l'Existence des Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'product_creation_queue',
  'delivery_matching_queue',
  'global_promo_events',
  'live_flash_sales',
  'deliveries',
  'product_orders',
  'social_publication_jobs',
  'video_generation_jobs',
  'delivery_proximity_suggestions'
)
ORDER BY table_name;
```

### 3. Vérifier les Logs de Démarrage

Dans CloudWatch Logs, chercher les logs autour du démarrage de l'application pour voir :
- Si les migrations sont tentées
- Si elles échouent
- Quelle est l'erreur exacte

## ✅ Prochaines Étapes

1. **Immédiat** : Exécuter les migrations manuellement via ECS Exec ou script Python
2. **Court terme** : Vérifier pourquoi les migrations ne s'exécutent pas automatiquement
3. **Moyen terme** : Améliorer le système de migration pour qu'il échoue de manière visible si les tables critiques sont manquantes
4. **Long terme** : Ajouter un healthcheck qui vérifie l'existence des tables critiques

## 📝 Notes

- Les améliorations apportées au code permettront de mieux diagnostiquer le problème au prochain déploiement
- Le code arrêtera maintenant l'application si plus de 3 tables critiques sont manquantes en production
- Les logs seront plus détaillés pour identifier la cause exacte de l'échec des migrations

