# 🚀 Migration Docker vers AWS - Documentation Complète

## 📋 Résumé des Mises à Jour

Tous les fichiers Docker ont été mis à jour pour préparer la migration du backend depuis Render vers AWS ECS/Fargate.

## ✅ Fichiers Mis à Jour

### 1. **backend/Dockerfile**
- ✅ Multi-stage build optimisé
- ✅ Image finale basée sur `debian:bookworm-slim` (plus légère)
- ✅ Utilisateur non-root pour la sécurité
- ✅ Health check configuré pour AWS ECS
- ✅ Port par défaut: 8080 (compatible AWS ALB)
- ✅ Support SQLx offline mode
- ✅ Blender intégré pour rendu 3D AR

### 2. **backend/Dockerfile.cloud**
- ✅ Optimisé spécifiquement pour AWS ECS/Fargate
- ✅ Build avec cache des dépendances Rust
- ✅ Stripping de l'exécutable pour réduire la taille
- ✅ Variables d'environnement AWS par défaut
- ✅ Configuration pool de connexions optimisée (100 max)
- ✅ Health check avec période de démarrage de 60s

### 3. **backend/scripts/start-cloud.sh**
- ✅ Script optimisé pour AWS ECS/Fargate
- ✅ Gestion robuste de la connexion AWS RDS
- ✅ Support optionnel pour AWS ElastiCache Redis
- ✅ Retry logic pour les connexions
- ✅ Gestion des erreurs améliorée
- ✅ Logs informatifs pour debugging

### 4. **backend/.dockerignore**
- ✅ Optimisé pour réduire la taille du contexte Docker
- ✅ Exclusion des fichiers de développement
- ✅ Inclusion explicite des fichiers nécessaires (.sqlx, src, config, migrations, ia_prompts)

### 5. **docker-compose.yml**
- ✅ Configuration pour développement local
- ✅ Variables d'environnement simplifiées
- ✅ Health checks configurés
- ✅ Volumes pour développement hot-reload

### 6. **docker-compose.aws.yml** (NOUVEAU)
- ✅ Configuration pour simuler AWS en local
- ✅ Services: backend, postgres, redis, nginx
- ✅ Configuration production-like
- ✅ Réseau isolé pour tests

### 7. **backend/aws/** (NOUVEAU - Dossier complet)
- ✅ `ecs-task-definition.json` - Définition de tâche ECS
- ✅ `ecs-service-definition.json` - Définition de service ECS
- ✅ `deploy-aws.sh` - Script de déploiement automatique
- ✅ `build-and-push.sh` - Script build et push ECR
- ✅ `AWS_DEPLOYMENT_GUIDE.md` - Guide complet de déploiement

## 🔧 Configuration AWS Requise

### Services AWS Nécessaires

1. **Amazon ECR** (Elastic Container Registry)
   - Repository: `yukpomnang-backend`
   - Région: `us-east-1` (ou votre région)

2. **Amazon ECS** (Elastic Container Service)
   - Cluster: `yukpomnang-cluster`
   - Service: `yukpomnang-backend-service`
   - Launch Type: `FARGATE`

3. **Amazon RDS** (Relational Database Service)
   - Engine: PostgreSQL 15+
   - Extensions: pgvector, imgsmlr
   - Instance: db.t3.medium (minimum)

4. **Amazon ElastiCache** (optionnel mais recommandé)
   - Engine: Redis 7
   - Instance: cache.t3.micro (minimum)

5. **Application Load Balancer (ALB)**
   - Target Group: Port 8080
   - Health Check: `/health`
   - Listener: HTTP/HTTPS

6. **AWS Secrets Manager**
   - Secrets pour: DATABASE_URL, JWT_SECRET, REDIS_URL, API keys

7. **CloudWatch Logs**
   - Log Group: `/ecs/yukpomnang-backend`

### IAM Roles Requis

1. **ECS Task Execution Role**
   - Permissions: ECR pull, Secrets Manager read, CloudWatch Logs write

2. **ECS Task Role**
   - Permissions: Secrets Manager read, S3 access (si nécessaire)

## 🚀 Déploiement Rapide

### Étape 1: Build et Push vers ECR

```bash
cd backend/aws
./build-and-push.sh v1.0.0 us-east-1
```

### Étape 2: Déployer sur ECS

```bash
./deploy-aws.sh production v1.0.0
```

### Étape 3: Vérifier le déploiement

```bash
aws ecs describe-services \
    --cluster yukpomnang-cluster \
    --services yukpomnang-backend-service \
    --region us-east-1
```

## 📊 Comparaison Render vs AWS

| Aspect | Render | AWS ECS/Fargate |
|--------|--------|-----------------|
| **Déploiement** | Git push automatique | Script de déploiement |
| **Scaling** | Automatique limité | Auto-scaling configurable |
| **Coûts** | ~$25/mois (Starter) | ~$60/mois (2 tasks) |
| **Contrôle** | Limité | Complet |
| **Monitoring** | Logs basiques | CloudWatch complet |
| **Sécurité** | Bonne | Excellente (IAM, VPC, etc.) |
| **Flexibilité** | Moyenne | Très élevée |

## 🔐 Variables d'Environnement AWS

### Variables Requises (via Secrets Manager)

- `DATABASE_URL` - URL PostgreSQL RDS
- `JWT_SECRET` - Secret JWT (64+ caractères)
- `REDIS_URL` - URL Redis ElastiCache (optionnel)
- `OPENAI_API_KEY` - Clé API OpenAI
- `GOOGLE_MAPS_API_KEY` - Clé API Google Maps

### Variables Optionnelles

- `AWS_REGION` - Région AWS (défaut: us-east-1)
- `DB_POOL_SIZE` - Taille du pool DB (défaut: 100)
- `DB_POOL_MIN_SIZE` - Taille min du pool (défaut: 20)
- `RUN_MIGRATIONS` - Exécuter migrations au démarrage (défaut: false)
- `GPU_ENABLED` - Activer GPU (défaut: false)

## 🧪 Tests Locaux

### Tester la configuration AWS en local

```bash
# Démarrer les services avec docker-compose.aws.yml
docker-compose -f docker-compose.aws.yml up -d

# Vérifier les logs
docker-compose -f docker-compose.aws.yml logs -f backend-aws

# Tester l'endpoint health
curl http://localhost:8080/health

# Arrêter
docker-compose -f docker-compose.aws.yml down
```

## 📈 Monitoring et Logs

### CloudWatch Logs

```bash
# Voir les logs en temps réel
aws logs tail /ecs/yukpomnang-backend --follow --region us-east-1

# Filtrer les erreurs
aws logs filter-log-events \
    --log-group-name /ecs/yukpomnang-backend \
    --filter-pattern "ERROR" \
    --region us-east-1
```

### Métriques ECS

- CPU Utilization
- Memory Utilization
- Task Count
- HTTP 5xx Errors
- Request Count

## 🛠️ Maintenance

### Mise à jour du service

```bash
./backend/aws/deploy-aws.sh production v1.1.0
```

### Scaling manuel

```bash
aws ecs update-service \
    --cluster yukpomnang-cluster \
    --service yukpomnang-backend-service \
    --desired-count 5 \
    --region us-east-1
```

### Rollback

```bash
# Lister les révisions
aws ecs list-task-definitions \
    --family-prefix yukpomnang-backend \
    --region us-east-1

# Rollback vers une révision précédente
aws ecs update-service \
    --cluster yukpomnang-cluster \
    --service yukpomnang-backend-service \
    --task-definition yukpomnang-backend:REVISION \
    --region us-east-1
```

## ⚠️ Points d'Attention

1. **Secrets Manager**: Ne jamais hardcoder les secrets dans les fichiers JSON
2. **Security Groups**: Configurer correctement pour permettre la communication entre services
3. **VPC**: S'assurer que tous les services sont dans le même VPC
4. **Health Checks**: Vérifier que l'endpoint `/health` répond correctement
5. **Migrations**: Gérer les migrations via une task ECS séparée ou au démarrage (RUN_MIGRATIONS=true)

## 📚 Documentation Complémentaire

- Guide de déploiement détaillé: `backend/aws/AWS_DEPLOYMENT_GUIDE.md`
- Task definition: `backend/aws/ecs-task-definition.json`
- Service definition: `backend/aws/ecs-service-definition.json`

## 🎯 Prochaines Étapes

1. ✅ Fichiers Docker mis à jour
2. ⏳ Créer les ressources AWS (ECR, ECS, RDS, etc.)
3. ⏳ Configurer les secrets dans Secrets Manager
4. ⏳ Tester le déploiement en staging
5. ⏳ Migrer les données depuis Render
6. ⏳ Basculer le DNS vers AWS ALB
7. ⏳ Désactiver Render

## 📞 Support

Pour toute question sur la migration AWS:
- Consulter `backend/aws/AWS_DEPLOYMENT_GUIDE.md`
- Vérifier les logs CloudWatch
- Utiliser `docker-compose.aws.yml` pour tests locaux

---

**Date de mise à jour**: 2025-01-27
**Version**: 2.0.0
**Statut**: ✅ Prêt pour migration AWS

