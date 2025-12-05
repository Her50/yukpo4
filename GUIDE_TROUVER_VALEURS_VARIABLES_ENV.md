# 🔍 Guide : Comment Trouver les Valeurs des Variables d'Environnement

## 🎯 Vue d'Ensemble

Ce guide explique comment trouver les valeurs pour :
- `DATABASE_READ_REPLICA_URL` (PostgreSQL read replica)
- `REDIS_CLUSTER_NODES` (Redis cluster)

---

## 📋 1. DATABASE_READ_REPLICA_URL (PostgreSQL Read Replica)

### ✅ Option A : Vous n'avez PAS de Read Replica

**Action** : **Ne pas configurer cette variable** (laisser vide)

**Comment vérifier** :
- Si vous utilisez Render PostgreSQL : **Pas de read replica par défaut**
- Si vous utilisez AWS RDS : Vérifier dans la console AWS
- Si vous utilisez un VPS : Vérifier si vous avez configuré la réplication

**Résultat** : L'application utilisera automatiquement `DATABASE_URL` (master)

---

### ✅ Option B : Vous avez un Read Replica

#### Provider : Render

**Render ne fournit PAS de read replica par défaut**

Pour obtenir un read replica sur Render :
1. Créer une nouvelle base de données PostgreSQL
2. Configurer la réplication streaming manuellement (avancé)
3. **Recommandation** : Utiliser un provider externe (AWS RDS, DigitalOcean, etc.)

**Si vous utilisez un service externe** :
- L'URL sera fournie par votre provider
- Format : `postgresql://user:password@replica-host:5432/database_name`

---

#### Provider : AWS RDS

**Étape 1** : Se connecter à la console AWS RDS

**Étape 2** : Trouver votre instance PostgreSQL master
```
AWS Console → RDS → Databases → [Votre base de données]
```

**Étape 3** : Vérifier les Read Replicas
```
Onglet "Connectivity & security" → Section "Read replicas"
```

**Étape 4** : Si un read replica existe, cliquer dessus

**Étape 5** : Récupérer l'endpoint
```
Endpoint: your-replica.xxxxx.us-east-1.rds.amazonaws.com
Port: 5432
```

**Étape 6** : Construire l'URL
```bash
DATABASE_READ_REPLICA_URL=postgresql://username:password@your-replica.xxxxx.us-east-1.rds.amazonaws.com:5432/database_name
```

**Créer un Read Replica** (si vous n'en avez pas) :
```
AWS Console → RDS → Databases → [Votre DB] → Actions → Create read replica
```

---

#### Provider : DigitalOcean

**Étape 1** : Se connecter à DigitalOcean Dashboard

**Étape 2** : Aller dans "Databases" → [Votre cluster PostgreSQL]

**Étape 3** : Vérifier les Read Replicas
```
Settings → Read Replicas
```

**Étape 4** : Si un read replica existe, récupérer l'URL
```
Connection String → Copy
```

**Créer un Read Replica** :
```
Settings → Read Replicas → Create Read Replica
```

---

#### Provider : VPS / Self-Hosted

**Étape 1** : Vérifier si la réplication est configurée
```bash
# Sur le serveur master
psql -U postgres -c "SELECT * FROM pg_stat_replication;"
```

**Étape 2** : Si un replica existe, récupérer son adresse
```bash
# L'adresse du replica sera affichée dans la colonne "client_addr"
```

**Étape 3** : Construire l'URL
```bash
DATABASE_READ_REPLICA_URL=postgresql://user:password@replica-ip:5432/database_name
```

**Configurer un Read Replica** (si nécessaire) :
```bash
# Voir le script : scripts/setup_postgresql_replica.sh
./scripts/setup_postgresql_replica.sh
```

---

### 🔍 Comment Vérifier si un Read Replica Existe

**Méthode 1 : Via psql**
```bash
# Se connecter au master
psql $DATABASE_URL

# Vérifier les replicas
SELECT * FROM pg_stat_replication;
```

**Méthode 2 : Via votre provider**
- Render : Pas de read replica par défaut
- AWS RDS : Console → RDS → Databases → Read Replicas
- DigitalOcean : Dashboard → Databases → Read Replicas

---

## 📋 2. REDIS_CLUSTER_NODES (Redis Cluster)

### ✅ Option A : Vous n'avez PAS de Redis Cluster

**Action** : **Ne pas configurer cette variable** (laisser vide)

**Comment vérifier** :
- Si vous utilisez Upstash : **Standalone** (pas de cluster)
- Si vous utilisez Render Redis : **Standalone** (pas de cluster)
- Si vous utilisez Redis Cloud : Vérifier le plan (Free = standalone)

**Résultat** : L'application utilisera automatiquement `REDIS_URL` (standalone)

---

### ✅ Option B : Vous avez un Redis Cluster

#### Provider : Upstash

**Upstash Free/Pro = Standalone (pas de cluster)**

Pour obtenir un cluster sur Upstash :
1. Upgrader vers un plan qui supporte les clusters
2. Créer un cluster Redis
3. Récupérer les endpoints des nœuds

**Si vous avez un cluster Upstash** :
```
Dashboard → Redis → [Votre cluster] → Endpoints
```

Format :
```bash
REDIS_CLUSTER_NODES=redis://node1.upstash.io:6379,redis://node2.upstash.io:6379,redis://node3.upstash.io:6379
```

---

#### Provider : AWS ElastiCache

**Étape 1** : Se connecter à la console AWS ElastiCache

**Étape 2** : Trouver votre cluster Redis
```
AWS Console → ElastiCache → Redis clusters → [Votre cluster]
```

**Étape 3** : Récupérer les endpoints des nœuds
```
Configuration endpoint: your-cluster.xxxxx.cache.amazonaws.com:6379
Node endpoints: 
  - node1.xxxxx.cache.amazonaws.com:6379
  - node2.xxxxx.cache.amazonaws.com:6379
  - node3.xxxxx.cache.amazonaws.com:6379
```

**Étape 4** : Construire la variable
```bash
REDIS_CLUSTER_NODES=redis://node1.xxxxx.cache.amazonaws.com:6379,redis://node2.xxxxx.cache.amazonaws.com:6379,redis://node3.xxxxx.cache.amazonaws.com:6379
```

**Créer un Cluster** :
```
AWS Console → ElastiCache → Create → Redis → Cluster mode enabled
```

---

#### Provider : Redis Cloud (Redis Labs)

**Étape 1** : Se connecter à Redis Cloud Dashboard

**Étape 2** : Vérifier le type de déploiement
```
Dashboard → Databases → [Votre database] → Configuration
```

**Étape 3** : Si c'est un cluster, récupérer les endpoints
```
Endpoints:
  - endpoint1.redis-cloud.com:12345
  - endpoint2.redis-cloud.com:12346
  - endpoint3.redis-cloud.com:12347
```

**Étape 4** : Construire la variable (avec mot de passe)
```bash
REDIS_CLUSTER_NODES=redis://default:password@endpoint1.redis-cloud.com:12345,redis://default:password@endpoint2.redis-cloud.com:12346,redis://default:password@endpoint3.redis-cloud.com:12347
```

---

#### Provider : Docker / Self-Hosted

**Étape 1** : Vérifier si un cluster est déployé
```bash
docker ps | grep redis
```

**Étape 2** : Si vous utilisez docker-compose.redis-cluster.yml
```bash
# Les nœuds sont configurés dans le fichier
# Ports: 6379, 6380, 6381 (masters)
#        6382, 6383, 6384 (replicas)
```

**Étape 3** : Construire la variable
```bash
REDIS_CLUSTER_NODES=redis://localhost:6379,redis://localhost:6380,redis://localhost:6381
```

**Déployer un Cluster** :
```bash
docker-compose -f docker-compose.redis-cluster.yml up -d
./scripts/setup_redis_cluster.sh
```

---

### 🔍 Comment Vérifier si un Redis Cluster Existe

**Méthode 1 : Via redis-cli**
```bash
# Se connecter à un nœud
redis-cli -h your-redis-host -p 6379

# Vérifier le mode cluster
CLUSTER INFO
CLUSTER NODES
```

**Méthode 2 : Via votre provider**
- Upstash : Dashboard → Redis → Type (Standalone ou Cluster)
- AWS ElastiCache : Console → Cluster mode (enabled/disabled)
- Redis Cloud : Dashboard → Database type

**Méthode 3 : Tester la connexion**
```bash
# Si cluster, cette commande devrait retourner plusieurs nœuds
redis-cli --cluster info your-redis-host:6379
```

---

## 🎯 Résumé par Provider

### Render (Votre Configuration Actuelle)

| Variable | Disponible ? | Comment Obtenir |
|----------|--------------|-----------------|
| `DATABASE_READ_REPLICA_URL` | ❌ **Non** | Render ne fournit pas de read replica par défaut |
| `REDIS_CLUSTER_NODES` | ❌ **Non** | Render Redis est standalone (pas de cluster) |

**Action** : **Ne pas configurer ces variables** (laisser vides)

---

### AWS (Si vous migrez vers AWS)

| Variable | Disponible ? | Comment Obtenir |
|----------|--------------|-----------------|
| `DATABASE_READ_REPLICA_URL` | ✅ **Oui** | RDS Console → Databases → Read Replicas → Endpoint |
| `REDIS_CLUSTER_NODES` | ✅ **Oui** | ElastiCache Console → Redis clusters → Node endpoints |

---

### DigitalOcean

| Variable | Disponible ? | Comment Obtenir |
|----------|--------------|-----------------|
| `DATABASE_READ_REPLICA_URL` | ✅ **Oui** | Dashboard → Databases → Read Replicas → Connection String |
| `REDIS_CLUSTER_NODES` | ✅ **Oui** | Dashboard → Databases → Redis Cluster → Endpoints |

---

## ✅ Checklist : Comment Savoir si Vous Avez Besoin de Ces Variables

### Pour DATABASE_READ_REPLICA_URL

- [ ] Avez-vous plus de **5,000 requêtes/seconde** sur PostgreSQL ?
- [ ] Avez-vous configuré un read replica PostgreSQL ?
- [ ] Votre provider supporte-t-il les read replicas ?

**Si toutes les réponses sont NON** → **Ne pas configurer** (laisser vide)

---

### Pour REDIS_CLUSTER_NODES

- [ ] Avez-vous plus de **10,000 connexions Redis simultanées** ?
- [ ] Avez-vous configuré un Redis cluster ?
- [ ] Votre provider supporte-t-il les clusters Redis ?

**Si toutes les réponses sont NON** → **Ne pas configurer** (laisser vide)

---

## 🚀 Actions Recommandées

### Pour Votre Configuration Actuelle (Render)

```bash
# ✅ Configuration recommandée
DATABASE_URL=postgresql://...          # ✅ Configurer
REDIS_URL=redis://...                  # ✅ Configurer
MONGODB_URL=mongodb://...              # ✅ Configurer

# ❌ Ne pas configurer (pas disponibles sur Render par défaut)
# DATABASE_READ_REPLICA_URL=           ← LAISSER VIDE
# REDIS_CLUSTER_NODES=                 ← LAISSER VIDE
```

**L'application fonctionnera parfaitement avec cette configuration !**

---

### Si Vous Voulez Activer le Scaling Horizontal

**Option 1 : Utiliser des Services Externes**
- AWS RDS pour read replica PostgreSQL
- AWS ElastiCache pour Redis cluster
- Configurer les variables avec les URLs fournies

**Option 2 : Self-Hosted**
- Configurer PostgreSQL streaming replication
- Déployer Redis cluster avec Docker
- Utiliser les scripts fournis (`setup_postgresql_replica.sh`, `setup_redis_cluster.sh`)

---

## 📞 Support

Si vous avez besoin d'aide pour :
- Configurer un read replica PostgreSQL
- Déployer un Redis cluster
- Migrer vers un provider qui supporte ces fonctionnalités

Consultez :
- `GUIDE_SCALING_HORIZONTAL_COMPLET.md` : Guide complet
- `scripts/setup_postgresql_replica.sh` : Script configuration read replica
- `scripts/setup_redis_cluster.sh` : Script configuration Redis cluster

