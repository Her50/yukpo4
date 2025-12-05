# 🚀 Configuration Multi-Instances + Load Balancer

## 📋 Réponse Directe

**La configuration multi-instances + load balancer se fait PRINCIPALEMENT dans l'infrastructure cloud (AWS, Render, etc.), PAS dans le code Rust.**

**Le code Rust doit être PRÊT** pour cette configuration (health checks, stateless, etc.) - ✅ **DÉJÀ FAIT !**

---

## ✅ Ce qui est DÉJÀ dans le Code Rust (Prêt pour Multi-Instances)

### 1. Health Check Endpoint
**Fichier** : `backend/src/routers/router_yukpo.rs`
- ✅ Endpoint `/api/health` créé
- ✅ Retourne HTTP 200 si healthy, HTTP 503 si unhealthy
- ✅ Compatible avec tous les load balancers

### 2. Application Stateless
- ✅ Pas de state partagé entre instances
- ✅ Pool de connexions DB indépendant par instance
- ✅ Cache Redis partagé (optionnel mais recommandé)

### 3. Configuration via Variables d'Environnement
- ✅ `DB_POOL_SIZE` : Configurable par instance
- ✅ `CACHE_TTL_SEARCH` : Configurable
- ✅ `RATE_LIMIT_IP` : Configurable

---

## ☁️ Configuration Infrastructure Cloud

### Option 1 : Render.com (Recommandé pour Démarrage Rapide)

**Fichier** : `render.yaml` (à créer ou modifier)

```yaml
services:
  # Backend principal
  - type: web
    name: yukpomnang-backend
    env: rust
    buildCommand: cd backend && cargo build --release
    startCommand: cd backend && cargo run --release
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: DB_POOL_SIZE
        value: "100"
      - key: CACHE_TTL_SEARCH
        value: "600"
      - key: RATE_LIMIT_IP
        value: "200"
    healthCheckPath: /api/health
    # ✅ NOUVEAU: Auto-scaling
    scaling:
      minInstances: 3
      maxInstances: 10
      targetCPUPercent: 70
      targetMemoryPercent: 80
    # ✅ NOUVEAU: Load balancer automatique
    # Render gère automatiquement le load balancer
```

**Avantages** :
- ✅ Configuration simple (1 fichier YAML)
- ✅ Load balancer automatique
- ✅ Auto-scaling basé sur CPU/Memory
- ✅ Health check automatique

---

### Option 2 : AWS (Production Enterprise)

#### 2.1. ECS/Fargate avec Application Load Balancer

**Fichier** : `backend/aws/ecs-task-definition.json`

```json
{
  "family": "yukpomnang-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-ecr-repo/yukpomnang-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "DB_POOL_SIZE", "value": "100" },
        { "name": "CACHE_TTL_SEARCH", "value": "600" },
        { "name": "RATE_LIMIT_IP", "value": "200" }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/yukpomnang-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Fichier** : `backend/aws/ecs-service.json`

```json
{
  "serviceName": "yukpomnang-backend",
  "cluster": "yukpomnang-cluster",
  "taskDefinition": "yukpomnang-backend",
  "desiredCount": 5,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-xxx"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "backend",
      "containerPort": 8080
    }
  ],
  "healthCheckGracePeriodSeconds": 60
}
```

**Fichier** : `backend/aws/alb-target-group.json`

```json
{
  "Name": "yukpomnang-backend-tg",
  "Protocol": "HTTP",
  "Port": 8080,
  "VpcId": "vpc-xxx",
  "HealthCheckProtocol": "HTTP",
  "HealthCheckPath": "/api/health",
  "HealthCheckIntervalSeconds": 30,
  "HealthCheckTimeoutSeconds": 5,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3,
  "TargetType": "ip"
}
```

**Fichier** : `backend/aws/alb-listener.json`

```json
{
  "LoadBalancerArn": "arn:aws:elasticloadbalancing:...",
  "Protocol": "HTTP",
  "Port": 80,
  "DefaultActions": [
    {
      "Type": "forward",
      "TargetGroupArn": "arn:aws:elasticloadbalancing:..."
    }
  ]
}
```

**Auto-Scaling** : `backend/aws/ecs-autoscaling.json`

```json
{
  "ServiceName": "yukpomnang-backend",
  "ClusterName": "yukpomnang-cluster",
  "ScalableDimension": "ecs:service:DesiredCount",
  "MinCapacity": 3,
  "MaxCapacity": 20,
  "TargetTrackingScalingPolicies": [
    {
      "PolicyName": "cpu-scaling",
      "TargetValue": 70.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
      },
      "ScaleInCooldown": 300,
      "ScaleOutCooldown": 60
    },
    {
      "PolicyName": "memory-scaling",
      "TargetValue": 80.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageMemoryUtilization"
      },
      "ScaleInCooldown": 300,
      "ScaleOutCooldown": 60
    }
  ]
}
```

---

### Option 3 : Docker Compose (Local/Dev/Staging)

**Fichier** : `backend/docker-compose.scalable.yml` (à créer)

```yaml
version: '3.8'

services:
  # Load Balancer Nginx
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend-1
      - backend-2
      - backend-3
    networks:
      - app-network

  # Backend Instance 1
  backend-1:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - DB_POOL_SIZE=100
      - CACHE_TTL_SEARCH=600
      - RATE_LIMIT_IP=200
      - INSTANCE_ID=1
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Backend Instance 2
  backend-2:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - DB_POOL_SIZE=100
      - CACHE_TTL_SEARCH=600
      - RATE_LIMIT_IP=200
      - INSTANCE_ID=2
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend Instance 3
  backend-3:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - DB_POOL_SIZE=100
      - CACHE_TTL_SEARCH=600
      - RATE_LIMIT_IP=200
      - INSTANCE_ID=3
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis (partagé entre instances)
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    networks:
      - app-network
    volumes:
      - redis_data:/data

  # PostgreSQL (partagé entre instances)
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=yukpomnang
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    networks:
      - app-network
    volumes:
      - postgres_data:/var/lib/postgresql/data

networks:
  app-network:
    driver: bridge

volumes:
  redis_data:
  postgres_data:
```

**Commande** :
```bash
docker-compose -f docker-compose.scalable.yml up --scale backend=5
# Crée 5 instances backend automatiquement
```

---

### Option 4 : Kubernetes (Production Avancée)

**Fichier** : `backend/k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yukpomnang-backend
spec:
  replicas: 5  # ✅ 5 instances
  selector:
    matchLabels:
      app: yukpomnang-backend
  template:
    metadata:
      labels:
        app: yukpomnang-backend
    spec:
      containers:
      - name: backend
        image: yukpomnang-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_POOL_SIZE
          value: "100"
        - name: CACHE_TTL_SEARCH
          value: "600"
        - name: RATE_LIMIT_IP
          value: "200"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: yukpomnang-backend-service
spec:
  selector:
    app: yukpomnang-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer  # ✅ Load balancer automatique
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: yukpomnang-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: yukpomnang-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 2
        periodSeconds: 15
      selectPolicy: Max
```

**Commande** :
```bash
kubectl apply -f backend/k8s/deployment.yaml
# Crée 5 instances + load balancer automatiquement
```

---

## 🔧 Configuration Nginx Load Balancer (Si vous utilisez Nginx)

**Fichier** : `backend/nginx/nginx-load-balancer.conf` (à créer)

```nginx
upstream backend_pool {
    least_conn;  # ✅ Répartition par connexions actives (meilleur pour DB)
    
    # Instances backend
    server backend-1:8080 max_fails=3 fail_timeout=30s;
    server backend-2:8080 max_fails=3 fail_timeout=30s;
    server backend-3:8080 max_fails=3 fail_timeout=30s;
    server backend-4:8080 max_fails=3 fail_timeout=30s;
    server backend-5:8080 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    server_name api.yukpomnang.com;

    # Rate limiting global
    limit_req_zone $binary_remote_addr zone=api:10m rate=200r/m;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://backend_pool;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }

    # Health check endpoint (direct, sans load balancing)
    location /api/health {
        proxy_pass http://backend_pool;
        access_log off;
    }
}
```

---

## 📊 Comparaison des Options

| Plateforme | Complexité | Coût | Auto-Scaling | Load Balancer |
|------------|------------|------|--------------|---------------|
| **Render.com** | ⭐ Facile | $$ | ✅ Oui | ✅ Automatique |
| **AWS ECS/Fargate** | ⭐⭐⭐ Moyen | $$$ | ✅ Oui | ✅ ALB |
| **Docker Compose** | ⭐⭐ Facile | $ | ❌ Manuel | ✅ Nginx |
| **Kubernetes** | ⭐⭐⭐⭐ Avancé | $$$ | ✅ Oui | ✅ Automatique |

---

## 🎯 Recommandation selon Besoin

### Démarrage Rapide (MVP)
**→ Render.com** (configuration YAML simple)

### Production Petite/Moyenne
**→ AWS ECS/Fargate** (équilibré complexité/coût)

### Production Grande Échelle
**→ Kubernetes** (maximum flexibilité)

### Développement/Staging
**→ Docker Compose** (local, facile à tester)

---

## ✅ Checklist Configuration

### Code Rust (DÉJÀ FAIT ✅)
- [x] Health check endpoint `/api/health`
- [x] Application stateless
- [x] Variables d'environnement configurées
- [x] Pool DB configurable

### Infrastructure Cloud (À CONFIGURER)
- [ ] Choisir plateforme (Render/AWS/K8s/Docker)
- [ ] Créer fichiers de configuration
- [ ] Configurer load balancer
- [ ] Configurer auto-scaling
- [ ] Configurer health checks
- [ ] Tester avec plusieurs instances

---

## 🚀 Exemple Rapide : Render.com

**1. Créer `render.yaml` à la racine** :
```yaml
services:
  - type: web
    name: yukpomnang-backend
    env: rust
    buildCommand: cd backend && cargo build --release
    startCommand: cd backend && cargo run --release
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: DB_POOL_SIZE
        value: "100"
    healthCheckPath: /api/health
    scaling:
      minInstances: 3
      maxInstances: 10
```

**2. Push sur Git** → Render détecte automatiquement et déploie

**3. Render crée automatiquement** :
- ✅ Load balancer
- ✅ 3 instances minimum
- ✅ Auto-scaling jusqu'à 10 instances
- ✅ Health checks automatiques

**C'est tout !** 🎉

---

## 📝 Résumé

| Élément | Où se configure ? |
|---------|-------------------|
| **Health check endpoint** | ✅ Code Rust (déjà fait) |
| **Application stateless** | ✅ Code Rust (déjà fait) |
| **Variables d'environnement** | ✅ Code Rust (déjà fait) |
| **Multi-instances** | ☁️ Infrastructure cloud |
| **Load balancer** | ☁️ Infrastructure cloud |
| **Auto-scaling** | ☁️ Infrastructure cloud |
| **Health checks infrastructure** | ☁️ Infrastructure cloud |

**Le code Rust est PRÊT !** Il ne reste plus qu'à configurer l'infrastructure cloud selon votre plateforme choisie.





