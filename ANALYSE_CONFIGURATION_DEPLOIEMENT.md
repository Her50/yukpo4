# 📊 Analyse Complète de la Configuration de Déploiement Yukpomnang

*Date: 2025-12-02*

## 🎯 Résumé Exécutif

### Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ACTUELLE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   Frontend   │      │   Backend    │                    │
│  │   Vercel     │─────▶│   Render     │                    │
│  │              │      │              │                    │
│  └──────────────┘      └──────┬───────┘                    │
│                               │                             │
│                               ▼                             │
│                        ┌──────────────┐                    │
│                        │  PostgreSQL  │                    │
│                        │   Render     │                    │
│                        │  (pgvector)  │                    │
│                        └──────────────┘                    │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Prometheus  │      │   Grafana    │                    │
│  │   Hetzner    │◀────▶│   Hetzner    │                    │
│  │   (VPS)      │      │   (VPS)      │                    │
│  └──────┬───────┘      └──────────────┘                    │
│         │                                                    │
│         │ Scrape métriques                                  │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Backend    │                                           │
│  │   Render     │                                           │
│  │  (métriques) │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 🔄 SAUVEGARDE DE L'APPLICATION BACKEND

### État Actuel : ⚠️ **SAUVEGARDE MANQUANTE**

**Problème identifié** : Aucun système de sauvegarde automatique de la base de données PostgreSQL n'est configuré actuellement.

### Ce qui existe actuellement :

#### ✅ Backups de Configuration (Code)
- **Scripts de backup** : `scripts/deploy_optimisations_progressives.sh` et `scripts/rollback_optimisations.sh`
- **Fichiers sauvegardés** :
  - `Cargo.toml` (dépendances Rust)
  - `.env` (variables d'environnement)
  - `src/state.rs` (configuration d'état)
- **Localisation** : `backups/YYYYMMDD_HHMMSS/`
- **Usage** : Rollback de changements de configuration

#### ❌ Backups de Base de Données (Manquants)
- **PostgreSQL** : Aucun backup automatique configuré
- **Render PostgreSQL** : Sauvegardes gérées par Render (si activées manuellement)
- **Volumes Docker** : Pas de backup des volumes `postgres_data`

### Recommandations pour Sauvegarde

#### Option 1 : Sauvegardes Render (Recommandé pour simplicité)
```yaml
# Render gère automatiquement les backups PostgreSQL si activés
# Configuration dans dashboard Render :
- Backup quotidien : Activé
- Rétention : 7 jours (gratuit) ou 30 jours (payant)
- Restauration : Via dashboard Render
```

**Avantages** :
- ✅ Automatique
- ✅ Géré par Render
- ✅ Pas de configuration supplémentaire

**Inconvénients** :
- ⚠️ Dépendant de Render
- ⚠️ Coût supplémentaire pour rétention longue

#### Option 2 : Sauvegardes Automatiques sur Hetzner (Recommandé pour contrôle)
```bash
# Script de backup quotidien sur Hetzner VPS
#!/bin/bash
# /usr/local/bin/backup_postgres_render.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/yukpomnang"
mkdir -p "$BACKUP_DIR"

# Backup depuis Render PostgreSQL
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Garder seulement les 30 derniers backups
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +30 -delete

# Upload vers S3/Wasabi (optionnel)
aws s3 cp "$BACKUP_DIR/db_backup_$DATE.sql.gz" s3://yukpomnang-backups/
```

**Configuration Cron** :
```bash
# Backup quotidien à 2h du matin
0 2 * * * /usr/local/bin/backup_postgres_render.sh >> /var/log/backup.log 2>&1
```

**Avantages** :
- ✅ Contrôle total
- ✅ Stockage externe possible (S3/Wasabi)
- ✅ Rétention personnalisable
- ✅ Indépendant de Render

**Inconvénients** :
- ⚠️ Nécessite configuration manuelle
- ⚠️ Maintenance du script

#### Option 3 : Sauvegardes Cloud (AWS S3 / Wasabi)
```yaml
# Configuration avec pg_dump + upload S3
Backup quotidien : 2h du matin
Upload S3 : Immédiat après backup
Rétention S3 : 90 jours
Rétention locale : 7 jours
```

---

## 2. 🖥️ UTILISATION DE HETZNER

### Contexte : Infrastructure Hybride

**Hetzner est utilisé pour** : Héberger le **stack de monitoring** (Prometheus + Grafana) sur un VPS dédié.

### Architecture Hetzner Actuelle

```
┌─────────────────────────────────────────┐
│         HETZNER VPS (Frankfurt)          │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  Prometheus  │  │   Grafana    │   │
│  │   Port 9090  │  │   Port 3002  │   │
│  └──────┬───────┘  └──────────────┘   │
│         │                              │
│         │ Scrape HTTPS                 │
│         ▼                              │
│  ┌──────────────────────────────┐      │
│  │  Backend Render              │      │
│  │  yukpomnang.onrender.com     │      │
│  │  /metrics/prometheus         │      │
│  └──────────────────────────────┘      │
│                                         │
│  Configuration :                        │
│  - VPS : 4 vCPU, 8GB RAM                │
│  - Coût : ~4.15€/mois (50€/an)         │
│  - Datacenter : Frankfurt               │
│  - Latence : < 5ms vers Render          │
└─────────────────────────────────────────┘
```

### Fichiers de Configuration

#### Prometheus (`prometheus.yml`)
```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'  # Backend Render
        labels:
          instance: 'yukpo-backend-render'
          environment: 'production'
```

#### Docker Compose Monitoring (`backend/docker-compose.monitoring.yml`)
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    # Rétention : 200h (~8 jours)
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
    # Dashboards : métriques vidéo + livraison
```

### Valeur Business de Hetzner

D'après `ANALYSE_VALEUR_HETZNER_GRAFANA_PROMETHEUS.md` :

| Métrique | Sans Hetzner | Avec Hetzner | Gain |
|----------|--------------|--------------|------|
| **Uptime** | ~95% (estimé) | **99.9%+** (mesuré) | +4.9% |
| **MTTR** | 2-4 heures | **< 15 minutes** | -93% |
| **Détection Problèmes** | Réactive | **Proactive** | Avant impact |
| **Coût Monitoring** | 0€ (pas de monitoring) | **50€/an** | Investissement |
| **ROI** | N/A | **33x (3300%)** | Exceptionnel |

### Cas d'Usage Concrets

1. **Monitoring Pipeline Vidéo IA**
   - Métriques : `video_jobs_queued`, `video_generation_duration_ms`
   - Alertes Slack si queue > 10 jobs
   - Dashboard Grafana temps réel

2. **Monitoring Système de Livraison**
   - Métriques : `delivery_matching_success_total`, `delivery_ws_connections`
   - Alertes si taux succès < 70%
   - Optimisation continue

3. **Prévention Pannes**
   - Métriques PostgreSQL : connexions actives, taille DB
   - Alertes si DB > 80% capacité
   - Migration préventive planifiée

---

## 3. 📊 PROMETHEUS : Niveau d'Intégration

### Niveau Actuel : ✅ **INTÉGRATION COMPLÈTE**

Prometheus est intégré à **3 niveaux** :

### Niveau 1 : Collecte de Métriques (Backend Rust)

#### Endpoint Métriques
```rust
// backend/src/lib.rs ou routes
GET /metrics/prometheus
```

#### Métriques Exposées (Exemples)
```promql
# Pipeline Vidéo
video_jobs_queued{job="yukpo-backend"}
video_jobs_running{job="yukpo-backend"}
video_generation_duration_ms_avg{job="yukpo-backend"}
video_generation_duration_ms_p95{job="yukpo-backend"}

# Système de Livraison
delivery_matching_success_total{job="yukpo-backend"}
delivery_matching_failed_total{job="yukpo-backend"}
delivery_ws_connections_current{job="yukpo-backend"}
delivery_wallet_debit_events_total{job="yukpo-backend"}

# Base de Données
pg_stat_database_numbackends{datname="yukpo_db"}
pg_database_size_bytes{datname="yukpo_db"}

# IA
ai_tokens_used_total{provider="openai"}
ai_requests_total{provider="openai"}
ai_cost_estimated_usd{provider="openai"}
```

### Niveau 2 : Scraping (Prometheus sur Hetzner)

#### Configuration (`prometheus.yml`)
```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    scrape_interval: 15s
    metrics_path: '/metrics/prometheus'
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'
        labels:
          service: 'yukpo-backend'
          instance: 'backend-1'
          environment: 'production'
          deployment: 'cloud'
```

**Fréquence** : Toutes les 15 secondes  
**Rétention** : 200 heures (~8 jours)  
**Stockage** : Volume Docker `prometheus_data` sur Hetzner

### Niveau 3 : Visualisation (Grafana)

#### Datasource Prometheus
```yaml
# backend/monitoring/grafana/datasources/prometheus.yml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
    timeInterval: "15s"
```

#### Dashboards Grafana (Recommandés)
1. **Vue d'Ensemble Système**
   - Uptime backend
   - Requêtes HTTP/seconde
   - Latence moyenne API
   - Erreurs 5xx/seconde

2. **Pipeline Vidéo**
   - Statut pipeline (ok/degraded/critical)
   - Jobs en file d'attente
   - Durée génération (moyenne, P95, P99)
   - Taux de succès (24h)

3. **Système de Livraison**
   - Taux de succès matching
   - Latence matching
   - Connexions WebSocket
   - Événements wallet

4. **Coûts & Performance Business**
   - Coûts IA estimés
   - Revenus générés
   - Taux de conversion

### Alertes Prometheus (Configuration)

#### Fichier : `backend/monitoring/prometheus_alerts.yml`
```yaml
groups:
  - name: yukpo_backend_alerts
    rules:
      - alert: PipelineVideoCritical
        expr: pipeline_status{job="yukpo-backend"} == 2
        for: 5m
        annotations:
          summary: "Pipeline vidéo en état CRITICAL"
          
      - alert: VideoQueueSaturated
        expr: video_jobs_queued{job="yukpo-backend"} > 10
        for: 2m
        annotations:
          summary: "Queue vidéo saturée : {{ $value }} jobs"
          
      - alert: DatabaseCapacityHigh
        expr: (pg_database_size_bytes{datname="yukpo_db"} / 1073741824) > 0.8
        for: 1h
        annotations:
          summary: "Base de données à {{ $value }}% capacité"
```

### Intégration Alertmanager (Optionnel)

```yaml
# backend/monitoring/alertmanager.yml
route:
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
      
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#yukpo-alerts'
```

---

## 4. 🚀 MIGRATION VERS RENDER / AWS

### État Actuel vs Cible

| Composant | Actuel | Cible Render | Cible AWS |
|-----------|--------|--------------|-----------|
| **Backend** | ✅ Render | ✅ Render | ⚠️ ECS/Fargate |
| **Frontend** | ✅ Vercel | ✅ Render Static | ⚠️ CloudFront |
| **PostgreSQL** | ✅ Render | ✅ Render | ⚠️ RDS |
| **Monitoring** | ✅ Hetzner | ⚠️ Render (limité) | ⚠️ CloudWatch |
| **Redis** | ⚠️ Render (optionnel) | ⚠️ Render | ⚠️ ElastiCache |

### Option A : Migration Complète vers Render

#### ✅ Ce qui reste identique
- Backend : Déjà sur Render ✅
- PostgreSQL : Déjà sur Render ✅
- Frontend : Peut migrer vers Render Static Sites

#### ⚠️ Ce qui change : Monitoring

**Problème** : Render ne propose pas de service Prometheus/Grafana managé.

**Solutions** :

##### Solution 1 : Garder Hetzner pour Monitoring (Recommandé)
```
✅ Avantages :
- Monitoring complet (Prometheus + Grafana)
- Coût faible (50€/an)
- Contrôle total
- Pas de changement nécessaire

❌ Inconvénients :
- Infrastructure hybride (Render + Hetzner)
```

##### Solution 2 : Monitoring sur Render (Limité)
```
⚠️ Limitations :
- Pas de service Prometheus/Grafana managé
- Nécessite déployer Prometheus comme service web
- Coût : ~25$/mois (300€/an) pour service web
- Moins de contrôle que Hetzner VPS
```

##### Solution 3 : Monitoring Externe (Datadog/New Relic)
```
💰 Coût : 50-200$/mois (600-2400€/an)
✅ Avantages : Service managé complet
❌ Inconvénients : Coût élevé, vendor lock-in
```

#### 📋 Checklist Migration Render Complète

```markdown
- [ ] Migrer Frontend vers Render Static Sites
  - [ ] Configurer `render.yaml` pour static site
  - [ ] Mettre à jour variables d'environnement
  - [ ] Tester déploiement
  
- [ ] Décider stratégie Monitoring
  - [ ] Option A : Garder Hetzner (recommandé)
  - [ ] Option B : Prometheus sur Render (service web)
  - [ ] Option C : Service externe (Datadog)
  
- [ ] Configurer Redis sur Render (si nécessaire)
  - [ ] Créer service Redis Render
  - [ ] Mettre à jour REDIS_URL
  
- [ ] Migrer variables d'environnement
  - [ ] Vérifier toutes les variables
  - [ ] Configurer secrets Render
  
- [ ] Tester déploiement complet
  - [ ] Health checks
  - [ ] Métriques Prometheus
  - [ ] Dashboards Grafana
```

### Option B : Migration Complète vers AWS

#### Architecture AWS Cible

```
┌─────────────────────────────────────────────────────────┐
│                    AWS ARCHITECTURE                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Frontend   │      │   Backend    │                │
│  │  CloudFront  │─────▶│  ECS/Fargate │                │
│  │   + S3       │      │              │                │
│  └──────────────┘      └──────┬───────┘                │
│                               │                         │
│                               ▼                         │
│                        ┌──────────────┐                │
│                        │  PostgreSQL  │                │
│                        │   RDS        │                │
│                        │  (pgvector)  │                │
│                        └──────────────┘                │
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Redis      │      │  Monitoring  │                │
│  │ ElastiCache  │      │ CloudWatch   │                │
│  └──────────────┘      │ + Prometheus │                │
│                        │  (EC2/EKS)  │                │
│                        └──────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 📋 Checklist Migration AWS Complète

##### 1. Infrastructure de Base

```markdown
- [ ] Créer VPC et sous-réseaux
  - [ ] VPC : 10.0.0.0/16
  - [ ] Subnets : public (10.0.1.0/24) + private (10.0.2.0/24)
  - [ ] Internet Gateway
  - [ ] NAT Gateway (pour privé)
  
- [ ] Créer RDS PostgreSQL
  - [ ] Instance : db.t3.medium (2 vCPU, 4GB RAM)
  - [ ] Multi-AZ : Oui (production)
  - [ ] Backup automatique : 7 jours
  - [ ] Extension pgvector : À installer
  - [ ] Security Group : Autoriser ECS
  
- [ ] Créer ElastiCache Redis
  - [ ] Mode : Cluster (si scaling)
  - [ ] Instance : cache.t3.micro (développement)
  - [ ] Security Group : Autoriser ECS
```

##### 2. Backend (ECS/Fargate)

```markdown
- [ ] Créer ECR (Elastic Container Registry)
  - [ ] Repository : yukpomnang-backend
  - [ ] Build et push image Docker
  
- [ ] Créer ECS Cluster
  - [ ] Type : Fargate (serverless)
  - [ ] Task Definition :
    - CPU : 1 vCPU (développement) → 2-4 vCPU (production)
    - Memory : 2GB → 4-8GB
    - Image : ECR yukpomnang-backend
    - Variables d'environnement :
      - DATABASE_URL : RDS endpoint
      - REDIS_URL : ElastiCache endpoint
      - JWT_SECRET : Secrets Manager
  
- [ ] Créer Application Load Balancer (ALB)
  - [ ] Target Group : ECS tasks
  - [ ] Health Check : /api/ping
  - [ ] SSL/TLS : ACM certificate
  
- [ ] Configurer Auto Scaling
  - [ ] Min : 2 tasks
  - [ ] Max : 10 tasks
  - [ ] Scaling basé sur CPU/Memory
```

##### 3. Frontend (CloudFront + S3)

```markdown
- [ ] Créer S3 Bucket
  - [ ] Nom : yukpomnang-frontend
  - [ ] Static website hosting : Activé
  - [ ] Index : index.html
  
- [ ] Build et upload frontend
  - [ ] npm run build
  - [ ] aws s3 sync dist/ s3://yukpomnang-frontend/
  
- [ ] Créer CloudFront Distribution
  - [ ] Origin : S3 bucket
  - [ ] Cache : Optimisé
  - [ ] SSL/TLS : ACM certificate
  - [ ] Custom domain : yukpomnang.com
```

##### 4. Monitoring (CloudWatch + Prometheus)

```markdown
Option A : CloudWatch uniquement
- [ ] Activer CloudWatch Logs pour ECS
- [ ] Créer dashboards CloudWatch
- [ ] Configurer alertes CloudWatch
- [ ] Métriques : CPU, Memory, Request count, Latency

Option B : Prometheus sur EC2 (Recommandé)
- [ ] Créer EC2 instance (t3.small)
- [ ] Installer Prometheus + Grafana
- [ ] Configurer Security Group (port 9090, 3000)
- [ ] Scraper ECS tasks via ALB
- [ ] Garder même configuration que Hetzner

Option C : Prometheus sur EKS
- [ ] Créer EKS cluster
- [ ] Déployer Prometheus Operator
- [ ] ServiceMonitor pour ECS
- [ ] Plus complexe mais scalable
```

##### 5. Sauvegardes AWS

```markdown
- [ ] RDS Automated Backups
  - [ ] Rétention : 7 jours (gratuit) ou 35 jours (payant)
  - [ ] Point-in-time recovery : Activé
  
- [ ] S3 Versioning
  - [ ] Activer versioning sur bucket frontend
  - [ ] Lifecycle policy : Supprimer anciennes versions après 90 jours
  
- [ ] Backup ECS (optionnel)
  - [ ] Exporter Task Definitions
  - [ ] Sauvegarder configurations
```

##### 6. Migration des Données

```markdown
- [ ] Exporter PostgreSQL depuis Render
  - [ ] pg_dump depuis Render PostgreSQL
  - [ ] Compresser backup
  
- [ ] Importer dans RDS
  - [ ] Créer base de données
  - [ ] Restaurer backup
  - [ ] Vérifier données
  
- [ ] Migration Redis (si nécessaire)
  - [ ] Exporter depuis Render Redis
  - [ ] Importer dans ElastiCache
```

##### 7. DNS et Domaines

```markdown
- [ ] Configurer Route53
  - [ ] Créer hosted zone
  - [ ] Enregistrer domaine
  
- [ ] Mettre à jour DNS
  - [ ] Backend : ALB DNS → CNAME
  - [ ] Frontend : CloudFront DNS → CNAME
```

#### Coûts Estimés AWS (Production)

| Service | Configuration | Coût/mois |
|---------|---------------|-----------|
| **ECS Fargate** | 2 tasks × 2 vCPU × 4GB | ~80$ |
| **RDS PostgreSQL** | db.t3.medium Multi-AZ | ~120$ |
| **ElastiCache Redis** | cache.t3.micro | ~15$ |
| **CloudFront** | 100GB transfer | ~10$ |
| **S3** | 10GB storage | ~1$ |
| **ALB** | Standard | ~20$ |
| **EC2 Prometheus** | t3.small | ~15$ |
| **Route53** | Hosted zone | ~1$ |
| **CloudWatch** | Logs + Metrics | ~10$ |
| **Total** | | **~272$/mois (~250€/mois)** |

**Comparaison** :
- Render actuel : ~45$/mois (backend + DB)
- AWS : ~272$/mois (infrastructure complète)
- **Différence** : +227$/mois (+2724€/an)

---

## 5. 📝 RECOMMANDATIONS FINALES

### Pour Sauvegarde

✅ **Recommandation** : Implémenter backup automatique sur Hetzner VPS

```bash
# Script quotidien sur Hetzner
0 2 * * * /usr/local/bin/backup_postgres_render.sh
```

**Avantages** :
- Contrôle total
- Coût faible (stockage Hetzner)
- Indépendant de Render
- Upload S3/Wasabi possible

### Pour Hetzner

✅ **Recommandation** : **GARDER Hetzner pour Monitoring**

**Raisons** :
1. Coût optimal : 50€/an vs 300€/an sur Render
2. Contrôle total : VPS dédié
3. Performance : Latence < 5ms vers Render
4. Stack complet : Prometheus + Grafana + Alertmanager

**Alternative** : Si migration AWS, déployer Prometheus sur EC2 (même coût, même contrôle)

### Pour Prometheus

✅ **Recommandation** : **GARDER l'intégration actuelle**

**Niveaux d'intégration** :
1. ✅ Backend expose `/metrics/prometheus`
2. ✅ Prometheus scrape toutes les 15s
3. ✅ Grafana visualise les dashboards
4. ⚠️ Alertmanager : À configurer pour Slack (optionnel)

### Pour Migration Render/AWS

#### Scénario 1 : Rester sur Render (Recommandé pour MVP)

✅ **Avantages** :
- Coût faible : ~45$/mois
- Déploiement simple
- Scaling automatique
- Backend déjà opérationnel

⚠️ **Actions** :
- [ ] Configurer backups PostgreSQL automatiques
- [ ] Garder Hetzner pour monitoring
- [ ] Migrer frontend vers Render Static (optionnel)

#### Scénario 2 : Migrer vers AWS (Recommandé pour Scale)

✅ **Avantages** :
- Infrastructure enterprise-grade
- Scalabilité illimitée
- Services managés (RDS, ElastiCache)
- Multi-région possible

⚠️ **Actions** :
- [ ] Budget : +227$/mois
- [ ] Migration complète nécessaire
- [ ] Formation équipe AWS
- [ ] Monitoring : Prometheus sur EC2 ou CloudWatch

---

## 6. 🔧 FICHIERS DE CONFIGURATION CLÉS

### Backend
- `render.yaml` : Configuration déploiement Render
- `backend/Dockerfile` : Image Docker backend
- `backend/monitoring/prometheus.yml` : Config Prometheus
- `backend/monitoring/grafana/datasources/prometheus.yml` : Datasource Grafana

### Monitoring
- `docker-compose.yml` : Services locaux (PostgreSQL, Prometheus, Grafana)
- `backend/docker-compose.monitoring.yml` : Stack monitoring
- `prometheus.yml` : Config Prometheus (production Hetzner)

### Sauvegardes
- `scripts/deploy_optimisations_progressives.sh` : Backup config
- `scripts/rollback_optimisations.sh` : Restauration config
- ⚠️ **Manquant** : Script backup PostgreSQL automatique

---

## 7. 📊 TABLEAU RÉCAPITULATIF

| Composant | État Actuel | Sauvegarde | Migration Render | Migration AWS |
|-----------|-------------|------------|-------------------|----------------|
| **Backend** | ✅ Render | ❌ Non | ✅ Déjà fait | ⚠️ ECS/Fargate |
| **Frontend** | ✅ Vercel | ❌ Non | ⚠️ Render Static | ⚠️ CloudFront+S3 |
| **PostgreSQL** | ✅ Render | ⚠️ Render (manuel) | ✅ Déjà fait | ⚠️ RDS |
| **Redis** | ⚠️ Optionnel | ❌ Non | ⚠️ Render | ⚠️ ElastiCache |
| **Prometheus** | ✅ Hetzner | ⚠️ Volume Docker | ⚠️ Service web | ⚠️ EC2/EKS |
| **Grafana** | ✅ Hetzner | ⚠️ Volume Docker | ⚠️ Service web | ⚠️ EC2/EKS |
| **Sauvegarde DB** | ❌ Manquante | ❌ Non | ⚠️ Render auto | ✅ RDS auto |

---

**Document créé le** : 2025-12-02  
**Version** : 1.0  
**Auteur** : Analyse Automatique Configuration

