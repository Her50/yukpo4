# ⚡ Référence Rapide : Variables d'Environnement

## 🎯 Configuration Minimale (Recommandée)

```bash
# ✅ Variables REQUISES (déjà configurées)
DATABASE_URL=postgresql://user:pass@host:5432/yukpo_db
REDIS_URL=redis://host:6379/0
MONGODB_URL=mongodb://host:27017

# ❌ Variables OPTIONNELLES (ne pas configurer si non disponibles)
# DATABASE_READ_REPLICA_URL=  ← LAISSER VIDE
# REDIS_CLUSTER_NODES=         ← LAISSER VIDE
```

---

## 🔍 Comment Trouver les Valeurs

### DATABASE_READ_REPLICA_URL

**Si vous n'avez PAS de read replica** :
- ✅ **Ne pas configurer** (laisser vide)
- L'application utilisera automatiquement `DATABASE_URL`

**Si vous avez un read replica** :

#### Render
- ❌ **Non disponible** par défaut
- Nécessite un service externe (AWS RDS, DigitalOcean, etc.)

#### AWS RDS
```
1. AWS Console → RDS → Databases
2. Sélectionner votre base de données master
3. Onglet "Connectivity & security" → "Read replicas"
4. Cliquer sur le read replica
5. Copier l'endpoint : your-replica.xxxxx.rds.amazonaws.com
6. Format : postgresql://user:pass@your-replica.xxxxx.rds.amazonaws.com:5432/db
```

#### DigitalOcean
```
1. Dashboard → Databases → [Votre cluster]
2. Settings → Read Replicas
3. Copier le "Connection String"
```

---

### REDIS_CLUSTER_NODES

**Si vous n'avez PAS de cluster Redis** :
- ✅ **Ne pas configurer** (laisser vide)
- L'application utilisera automatiquement `REDIS_URL`

**Si vous avez un cluster Redis** :

#### Render / Upstash (Standalone)
- ❌ **Non disponible** (standalone uniquement)
- Nécessite un service externe (AWS ElastiCache, Redis Cloud, etc.)

#### AWS ElastiCache
```
1. AWS Console → ElastiCache → Redis clusters
2. Sélectionner votre cluster
3. Copier les "Node endpoints"
4. Format : redis://node1.xxxxx.cache.amazonaws.com:6379,redis://node2.xxxxx.cache.amazonaws.com:6379,redis://node3.xxxxx.cache.amazonaws.com:6379
```

#### Redis Cloud
```
1. Dashboard → Databases → [Votre database]
2. Configuration → Endpoints
3. Copier tous les endpoints
4. Format : redis://default:pass@endpoint1:port,redis://default:pass@endpoint2:port,redis://default:pass@endpoint3:port
```

#### Docker (Self-Hosted)
```
1. Déployer : docker-compose -f docker-compose.redis-cluster.yml up -d
2. Format : redis://localhost:6379,redis://localhost:6380,redis://localhost:6381
```

---

## ✅ Vérification Rapide

### Vérifier si vous avez un Read Replica PostgreSQL

```bash
# Se connecter au master
psql $DATABASE_URL

# Vérifier les replicas
SELECT * FROM pg_stat_replication;
```

**Si vide** → Pas de read replica → Ne pas configurer `DATABASE_READ_REPLICA_URL`

---

### Vérifier si vous avez un Redis Cluster

```bash
# Se connecter à Redis
redis-cli -h your-redis-host -p 6379

# Vérifier le mode cluster
CLUSTER INFO
```

**Si erreur "ERR This instance has cluster support disabled"** → Standalone → Ne pas configurer `REDIS_CLUSTER_NODES`

---

## 📊 Tableau de Décision

| Situation | DATABASE_READ_REPLICA_URL | REDIS_CLUSTER_NODES |
|-----------|---------------------------|---------------------|
| **Render (défaut)** | ❌ Ne pas configurer | ❌ Ne pas configurer |
| **< 5,000 req/s** | ❌ Ne pas configurer | ❌ Ne pas configurer |
| **> 5,000 req/s + Read Replica disponible** | ✅ Configurer | ❌ Ne pas configurer |
| **> 10,000 req/s + Cluster Redis disponible** | ✅ Configurer | ✅ Configurer |

---

## 🎯 Pour Votre Cas (Render)

**Configuration Recommandée** :

```bash
# Sur Render Dashboard → Environment Variables

✅ DATABASE_URL=postgresql://yukpo_db_user:...@dpg-xxx.frankfurt-postgres.render.com/yukpo_db
✅ REDIS_URL=redis://... (votre URL Redis actuelle)
✅ MONGODB_URL=mongodb://... (votre URL MongoDB actuelle)

❌ DATABASE_READ_REPLICA_URL=  ← Ne pas créer cette variable
❌ REDIS_CLUSTER_NODES=         ← Ne pas créer cette variable
```

**L'application fonctionnera parfaitement avec cette configuration !**

---

## 📚 Documentation Complète

Pour plus de détails, voir :
- `GUIDE_TROUVER_VALEURS_VARIABLES_ENV.md` : Guide complet détaillé
- `RENDER_ENV_VARIABLES_DEFAULTS.md` : Configuration Render spécifique

