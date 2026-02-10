# 🚀 Plan de Migration Backend vers Hetzner

## 📋 État Actuel

- ✅ **Cloudflare CDN** : Déjà configuré (`cdn.yukpomnang.com`)
- ✅ **Infrastructure Hetzner** : Serveur `46.224.14.85` avec monitoring (Prometheus/Grafana)
- ✅ **Scripts de déploiement** : Déjà créés pour Hetzner
- ⏳ **Backend actuel** : Sur AWS (coûteux) ou Render
- ⏳ **PostgreSQL** : Sur AWS (à migrer vers Hetzner)

---

## 🎯 Objectifs de Migration

1. ✅ Réduire les coûts (Hetzner 50-60% moins cher que AWS)
2. ✅ Simplifier l'infrastructure (tout sur Hetzner)
3. ✅ Garder Cloudflare CDN (déjà configuré)
4. ✅ Maintenir le monitoring (Prometheus/Grafana déjà sur Hetzner)

---

## 🏗️ Architecture Cible sur Hetzner

```
┌─────────────────────────────────────────────────┐
│         HETZNER SERVER (46.224.14.85)            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Backend    │  │  PostgreSQL  │            │
│  │   (Rust)     │  │  (pgvector)  │            │
│  │   Port 8080  │  │  Port 5432   │            │
│  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                     │
│  ┌──────▼──────────────────▼───────┐            │
│  │         Redis Cache             │            │
│  │         Port 6379               │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  Prometheus  │  │   Grafana   │            │
│  │  Port 9090   │  │  Port 3000  │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────────────────────────┐           │
│  │    Nginx Reverse Proxy           │           │
│  │    Port 80/443                   │           │
│  │    SSL: Let's Encrypt             │           │
│  └──────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│         CLOUDFLARE CDN                          │
│    cdn.yukpomnang.com                           │
│    (Déjà configuré)                              │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│         WASABI STORAGE                          │
│    yukpo-video-prod.s3.eu-central-1.wasabisys.com│
│    (Stockage vidéos)                             │
└─────────────────────────────────────────────────┘
```

---

## 📦 Services à Déployer sur Hetzner

### **1. Backend Rust (Axum)**

- **Port** : 8080 (interne), 80/443 (exposé via Nginx)
- **Image Docker** : `yukpo-backend:latest`
- **Ressources** : 2-4 vCPU, 4-8 GB RAM

### **2. PostgreSQL avec pgvector**

- **Port** : 5432 (interne uniquement)
- **Version** : PostgreSQL 15+
- **Extensions** : pgvector, imgsmlr
- **Ressources** : 2-4 vCPU, 4-8 GB RAM

### **3. Redis**

- **Port** : 6379 (interne uniquement)
- **Usage** : Cache, rate limiting
- **Ressources** : 1 vCPU, 2 GB RAM

### **4. Nginx (Reverse Proxy + SSL)**

- **Ports** : 80, 443
- **SSL** : Let's Encrypt (Certbot)
- **Fonction** : Reverse proxy vers backend, SSL termination

### **5. Monitoring (Déjà déployé)**

- **Prometheus** : Port 9090
- **Grafana** : Port 3000
- **AlertManager** : Port 9093

---

## 🔧 Configuration Docker Compose

### **Fichier : `docker-compose.hetzner.yml`**

```yaml
version: '3.8'

services:
  # 🚀 Backend Rust
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: yukpo-backend:latest
    container_name: yukpo-backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://yukpo_user:${DB_PASSWORD}@postgres:5432/yukpomnang
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET}
      - ENVIRONMENT=production
      - RUST_LOG=info
      - HOST=0.0.0.0
      - PORT=8080
      - ALLOWED_ORIGINS=https://yukpomnang.com,https://api.yukpomnang.com
      # ... autres variables d'environnement
    ports:
      - "127.0.0.1:8080:8080"  # Exposé uniquement en localhost
    volumes:
      - ./backend/uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    networks:
      - yukpo-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 🗄️ PostgreSQL avec pgvector
  postgres:
    image: pgvector/pgvector:pg15
    container_name: yukpo-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=yukpomnang
      - POSTGRES_USER=yukpo_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"  # Exposé uniquement en localhost
    networks:
      - yukpo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U yukpo_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 🔴 Redis
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

  # 🌐 Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: yukpo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/certbot/conf:/etc/letsencrypt:ro
      - ./nginx/certbot/www:/var/www/certbot:ro
    depends_on:
      - backend
    networks:
      - yukpo-network

  # 📊 Prometheus (Déjà déployé)
  prometheus:
    image: prom/prometheus:latest
    container_name: yukpo-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./backend/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - yukpo-network

  # 📈 Grafana (Déjà déployé)
  grafana:
    image: grafana/grafana:latest
    container_name: yukpo-grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./backend/monitoring/grafana:/etc/grafana/provisioning:ro
    networks:
      - yukpo-network
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  yukpo-network:
    driver: bridge
```

---

## 🔐 Configuration Nginx

### **Fichier : `nginx/nginx.conf`**

```nginx
upstream backend {
    server backend:8080;
}

server {
    listen 80;
    server_name api.yukpomnang.com;

    # Redirection HTTP → HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yukpomnang.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yukpomnang.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yukpomnang.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Proxy vers backend
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://backend/api/health;
        access_log off;
    }
}
```

---

## 📝 Étapes de Migration

### **Phase 1 : Préparation (1-2 jours)**

1. ✅ **Vérifier les ressources Hetzner**
   ```bash
   # Vérifier l'espace disque
   df -h
   
   # Vérifier la RAM
   free -h
   
   # Vérifier les ports disponibles
   netstat -tlnp
   ```

2. ✅ **Créer les répertoires**
   ```bash
   ssh root@46.224.14.85
   mkdir -p /opt/yukpo/{backend,nginx,ssl,logs}
   ```

3. ✅ **Installer Docker et Docker Compose**
   ```bash
   # Si pas déjà installé
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Installer Docker Compose
   apt-get update
   apt-get install docker-compose-plugin
   ```

### **Phase 2 : Migration PostgreSQL (1 jour)**

Voir `MIGRATION_POSTGRESQL_HETZNER_VERS_AZURE_AWS.md` pour les détails.

**Résumé** :
1. Backup depuis AWS
2. Restaurer sur Hetzner PostgreSQL
3. Vérifier l'intégrité

### **Phase 3 : Déploiement Backend (1 jour)**

1. ✅ **Copier le code backend**
   ```bash
   # Depuis votre machine locale
   scp -r backend root@46.224.14.85:/opt/yukpo/
   ```

2. ✅ **Créer le fichier `.env`**
   ```bash
   ssh root@46.224.14.85
   cd /opt/yukpo/backend
   nano .env
   ```
   
   ```bash
   DATABASE_URL=postgresql://yukpo_user:password@postgres:5432/yukpomnang
   REDIS_URL=redis://redis:6379/0
   JWT_SECRET=votre_secret_jwt_tres_long
   ENVIRONMENT=production
   RUST_LOG=info
   # ... autres variables
   ```

3. ✅ **Build l'image Docker**
   ```bash
   cd /opt/yukpo/backend
   docker build -t yukpo-backend:latest .
   ```

4. ✅ **Configurer Nginx**
   ```bash
   # Copier la configuration Nginx
   scp -r nginx root@46.224.14.85:/opt/yukpo/
   ```

5. ✅ **Configurer SSL (Let's Encrypt)**
   ```bash
   # Installer Certbot
   apt-get install certbot python3-certbot-nginx
   
   # Obtenir le certificat
   certbot --nginx -d api.yukpomnang.com
   ```

6. ✅ **Lancer les services**
   ```bash
   cd /opt/yukpo
   docker-compose -f docker-compose.hetzner.yml up -d
   ```

### **Phase 4 : Vérification (1 jour)**

1. ✅ **Vérifier les services**
   ```bash
   docker-compose -f docker-compose.hetzner.yml ps
   docker-compose -f docker-compose.hetzner.yml logs -f
   ```

2. ✅ **Tester les endpoints**
   ```bash
   curl https://api.yukpomnang.com/api/health
   curl https://api.yukpomnang.com/api/healthz
   ```

3. ✅ **Vérifier Prometheus**
   ```bash
   curl http://46.224.14.85:9090/targets
   # Vérifier que le backend est "UP"
   ```

4. ✅ **Mettre à jour le DNS**
   ```
   api.yukpomnang.com → 46.224.14.85 (A record)
   ```

### **Phase 5 : Tests et Monitoring (2-3 jours)**

1. ✅ Tests fonctionnels complets
2. ✅ Monitoring des performances
3. ✅ Vérification des logs
4. ✅ Tests de charge (optionnel)

---

## 🔄 Script de Déploiement Automatique

### **Fichier : `scripts/deploy-hetzner-backend.sh`**

```bash
#!/bin/bash
set -e

HETZNER_HOST="46.224.14.85"
HETZNER_USER="root"
HETZNER_DIR="/opt/yukpo"

echo "🚀 Déploiement backend sur Hetzner..."

# 1. Copier les fichiers
echo "📦 Copie des fichiers..."
scp -r backend "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/"
scp -r nginx "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/"
scp docker-compose.hetzner.yml "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/docker-compose.yml"

# 2. Build et déploiement
ssh "$HETZNER_USER@$HETZNER_HOST" << 'EOF'
    cd /opt/yukpo
    
    # Build l'image
    cd backend
    docker build -t yukpo-backend:latest .
    
    # Redémarrer les services
    cd ..
    docker-compose down
    docker-compose up -d
    
    # Vérifier le statut
    docker-compose ps
    docker-compose logs -f --tail=50
EOF

echo "✅ Déploiement terminé!"
```

---

## 🔐 Sécurité

### **1. Firewall (UFW)**

```bash
# Installer UFW
apt-get install ufw

# Autoriser SSH
ufw allow 22/tcp

# Autoriser HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Autoriser Prometheus/Grafana (optionnel, ou via VPN)
ufw allow 9090/tcp
ufw allow 3000/tcp

# Activer le firewall
ufw enable
```

### **2. Fail2Ban**

```bash
# Installer Fail2Ban
apt-get install fail2ban

# Configuration automatique
systemctl enable fail2ban
systemctl start fail2ban
```

### **3. Mots de passe forts**

- ✅ Utiliser des mots de passe aléatoires pour PostgreSQL
- ✅ Utiliser des secrets JWT longs (64+ caractères)
- ✅ Ne jamais commiter les `.env` dans git

---

## 📊 Monitoring

### **Prometheus Targets**

Vérifier que Prometheus scrape le backend :

```yaml
# backend/monitoring/prometheus.yml
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    static_configs:
      - targets:
          - 'backend:8080'  # Dans le réseau Docker
```

### **Grafana Dashboards**

- ✅ Dashboard métriques backend
- ✅ Dashboard métriques PostgreSQL
- ✅ Dashboard métriques Redis
- ✅ Alertes Slack (déjà configuré)

---

## 🆘 Dépannage

### **Backend ne démarre pas**

```bash
# Vérifier les logs
docker-compose logs backend

# Vérifier les variables d'environnement
docker-compose exec backend env | grep DATABASE_URL

# Tester la connexion PostgreSQL
docker-compose exec backend psql $DATABASE_URL -c "SELECT 1"
```

### **PostgreSQL ne démarre pas**

```bash
# Vérifier les logs
docker-compose logs postgres

# Vérifier les permissions
ls -la /opt/yukpo/postgres_data

# Vérifier les extensions
docker-compose exec postgres psql -U yukpo_user -d yukpomnang -c "\dx"
```

### **Nginx erreur 502**

```bash
# Vérifier que le backend répond
docker-compose exec nginx curl http://backend:8080/api/health

# Vérifier la configuration Nginx
docker-compose exec nginx nginx -t
```

---

## ✅ Checklist de Migration

- [ ] Serveur Hetzner préparé (Docker, répertoires)
- [ ] PostgreSQL migré depuis AWS
- [ ] Backend déployé et fonctionnel
- [ ] Redis configuré
- [ ] Nginx configuré avec SSL
- [ ] DNS mis à jour (api.yukpomnang.com)
- [ ] Prometheus scrape le backend
- [ ] Tests fonctionnels réussis
- [ ] Monitoring activé
- [ ] Firewall configuré
- [ ] Backup automatique configuré
- [ ] Documentation mise à jour

---

## 📚 Ressources

- **Docker Compose** : https://docs.docker.com/compose/
- **Nginx** : https://nginx.org/en/docs/
- **Let's Encrypt** : https://letsencrypt.org/
- **Prometheus** : https://prometheus.io/docs/
- **Grafana** : https://grafana.com/docs/

---

## 🎯 Prochaines Étapes

1. ✅ Exécuter le script de déploiement
2. ✅ Vérifier que tout fonctionne
3. ✅ Mettre à jour le DNS
4. ✅ Tester en production
5. ✅ Arrêter les ressources AWS (après validation)

---

## 💰 Économies Estimées

**Avant (AWS)** :
- RDS PostgreSQL : ~$100-150/mois
- ECS Fargate : ~$80-120/mois
- ElastiCache Redis : ~$30-50/mois
- NAT Gateway : ~$35/mois
- **Total** : ~$245-355/mois

**Après (Hetzner)** :
- VPS Hetzner (8 vCPU, 32 GB RAM) : ~€50-70/mois (~$55-77/mois)
- **Total** : ~$55-77/mois

**Économie** : **~$190-278/mois** (70-80% de réduction) 🎉

