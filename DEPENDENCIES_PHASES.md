# 📦 Dépendances à Ajouter pour les Phases

## Phase 1 : Redis

✅ **Déjà présent dans Cargo.toml:**
```toml
redis = { version = "0.26", features = ["tokio-native-tls-comp", "aio"] }
deadpool-redis = "0.15"
```

## Phase 4 : Prometheus

⚠️ **À ajouter dans Cargo.toml:**
```toml
prometheus = "0.13"
```

## Phase 5 : Tests de Charge

### Apache Bench (ab)
```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install httpd
```

### k6
```bash
# Installation
brew install k6  # macOS
# ou
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
```

## Déploiement

### Redis Cluster
```bash
# Docker Compose
docker-compose -f deployment/redis/docker-compose.yml up -d

# Kubernetes
kubectl apply -f deployment/redis/kubernetes/
```

### Prometheus + Grafana
```bash
# Helm
helm install prometheus prometheus-community/kube-prometheus-stack

# Ou Docker Compose
docker-compose -f deployment/monitoring/docker-compose.yml up -d
```

