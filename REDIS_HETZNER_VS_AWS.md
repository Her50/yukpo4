# 🔴 Redis : Hetzner vs AWS

## ❌ Réponse : Hetzner n'a PAS de service Redis managé

**Hetzner ne propose pas de service Redis managé** comme AWS ElastiCache.

### Comparaison

| Service | AWS | Hetzner |
|---------|-----|---------|
| **Redis Managé** | ✅ ElastiCache | ❌ Non disponible |
| **PostgreSQL Managé** | ✅ RDS | ✅ Cloud Database |
| **MySQL Managé** | ✅ RDS | ✅ Cloud Database |
| **MongoDB Managé** | ✅ DocumentDB | ❌ Non disponible |

---

## ✅ Solution : Redis sur Hetzner via Docker

**C'est même plus simple et moins cher !**

### Option 1 : Redis via Docker Compose (Recommandé)

```yaml
# docker-compose.hetzner.yml
services:
  redis:
    image: redis:7-alpine
    container_name: yukpo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # Exposé uniquement en localhost
    networks:
      - yukpo-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Avantages** :
- ✅ **Gratuit** (inclus dans le VPS)
- ✅ **Simple** : Un conteneur Docker
- ✅ **Contrôle total** : Configuration personnalisée
- ✅ **Performance** : Pas de latence réseau (même serveur que backend)

**Coût** : **€0/mois** (vs $30-50/mois AWS ElastiCache)

---

### Option 2 : Redis sur VPS séparé (Haute Disponibilité)

Si vous voulez une séparation complète :

```bash
# Sur un VPS Hetzner dédié (CPX11 - €5/mois)
# Installer Redis
apt-get update
apt-get install redis-server

# Configuration
systemctl start redis-server
systemctl enable redis-server
```

**Coût** : **€5/mois** (vs $30-50/mois AWS ElastiCache)

---

## 📊 Comparaison des Coûts

| Solution | Coût Mensuel | Performance | Maintenance |
|----------|--------------|--------------|-------------|
| **AWS ElastiCache** | $30-50 | ⭐⭐⭐⭐⭐ | ✅ Géré par AWS |
| **Redis Docker (Hetzner)** | **€0** | ⭐⭐⭐⭐⭐ | ⚠️ Auto-géré |
| **Redis VPS (Hetzner)** | **€5** | ⭐⭐⭐⭐ | ⚠️ Auto-géré |

**Recommandation** : **Redis Docker** sur le même VPS que le backend (€0/mois, performance optimale)

---

## 🔧 Configuration Redis pour Hetzner

### 1. Variables d'environnement

```bash
# .env sur Hetzner
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
REDIS_PASSWORD=votre_mot_de_passe_securise
```

### 2. Configuration Redis (persistance)

```yaml
# redis.conf (optionnel, pour configuration avancée)
appendonly yes
appendfsync everysec
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### 3. Backup automatique (optionnel)

```bash
# Script de backup Redis quotidien
#!/bin/bash
docker exec yukpo-redis redis-cli --rdb /data/dump-$(date +%Y%m%d).rdb
# Copier vers backup externe
```

---

## ✅ Conclusion

**Hetzner n'a pas de Redis managé**, mais **Redis via Docker est la meilleure solution** :

- ✅ **Gratuit** (€0/mois vs $30-50/mois AWS)
- ✅ **Simple** (un conteneur Docker)
- ✅ **Performant** (même serveur que backend)
- ✅ **Contrôlable** (configuration personnalisée)

**Recommandation** : Utiliser Redis via Docker Compose sur Hetzner.

