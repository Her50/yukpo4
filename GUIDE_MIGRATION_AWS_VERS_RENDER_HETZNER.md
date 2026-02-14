# 🚀 Guide : Migration AWS vers Render/Hetzner

**Date** : 2026-02-14  
**Raison** : Compte AWS fermé - Migration nécessaire

---

## ✅ BONNE NOUVELLE

**Le projet est déjà configuré pour Render et Hetzner !** ✅

**Fichiers existants** :
- ✅ `render.yaml` - Configuration Render
- ✅ `docker-compose.hetzner.yml` - Configuration Hetzner
- ✅ `backend/Dockerfile` - Image Docker backend
- ✅ Configuration monitoring déjà en place sur Hetzner

---

## 🎯 RECOMMANDATION : Render (Rapide et Simple)

### Pourquoi Render ?

**Avantages** :
- ✅ **Déjà configuré** : `render.yaml` existe
- ✅ **Déploiement rapide** : 5-10 minutes
- ✅ **Simple** : Pas besoin de gérer l'infrastructure
- ✅ **PostgreSQL géré** : Base de données incluse
- ✅ **Scaling automatique** : S'adapte à la charge
- ✅ **Coût prévisible** : ~$7-25/mois

---

## 📋 PLAN DE MIGRATION RENDER

### Étape 1 : Sauvegarder la Base de Données AWS

**⚠️ IMPORTANT** : Sauvegarder avant que le compte AWS soit complètement fermé

**Option A : Depuis un serveur accessible** (si vous avez encore accès)
```bash
pg_dump -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -U postgres \
  -d yukpomnang \
  > backup_yukpomnang_$(date +%Y%m%d).sql
```

**Option B : Depuis le backend ECS** (si encore accessible)
```bash
# Se connecter au conteneur ECS
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task [TASK_ID] \
  --container backend \
  --command "pg_dump $DATABASE_URL > /tmp/backup.sql" \
  --interactive

# Copier le backup
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task [TASK_ID] \
  --container backend \
  --command "cat /tmp/backup.sql" \
  --interactive > backup_yukpomnang.sql
```

**Option C : Via AWS Console** (si encore accessible)
- RDS → Snapshots → Créer un snapshot
- Exporter le snapshot vers S3
- Télécharger depuis S3

---

### Étape 2 : Créer un Compte Render

1. Aller sur https://render.com
2. Créer un compte (gratuit)
3. Connecter le repository GitHub

---

### Étape 3 : Créer la Base de Données PostgreSQL

**Dans Render Dashboard** :
1. **New** → **PostgreSQL**
2. **Nom** : `yukpomnang-db`
3. **Région** : `Frankfurt` (proche de l'Europe)
4. **Plan** : `Starter` ($7/mois) ou `Standard` ($20/mois)
5. **Créer**

**Note** : Render fournira automatiquement `DATABASE_URL`

---

### Étape 4 : Restaurer la Base de Données

**Option A : Via psql (local)**
```bash
# Obtenir DATABASE_URL depuis Render Dashboard
export DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Restaurer
psql $DATABASE_URL < backup_yukpomnang.sql
```

**Option B : Via Render Shell**
```bash
# Dans Render Dashboard → Database → Shell
psql < backup_yukpomnang.sql
```

---

### Étape 5 : Créer le Service Web (Backend)

**Dans Render Dashboard** :
1. **New** → **Web Service**
2. **Connect Repository** → Sélectionner votre repository GitHub
3. **Configuration** :
   - **Name** : `yukpo-backend`
   - **Region** : `Frankfurt`
   - **Branch** : `main` (ou votre branche principale)
   - **Root Directory** : `backend`
   - **Environment** : `Docker`
   - **Dockerfile Path** : `backend/Dockerfile`
   - **Instance Type** : `Starter` ($7/mois) ou `Standard` ($25/mois)

4. **Environment Variables** :
   - `DATABASE_URL` : (automatiquement connecté si vous avez créé la DB)
   - `REDIS_URL` : (si vous utilisez Redis, créer un service Redis)
   - `JWT_SECRET` : (copier depuis AWS)
   - `ALLOWED_ORIGINS` : `https://api.yukpomnang.com,https://yukpomnang.com`
   - Toutes les autres variables d'environnement depuis AWS

5. **Health Check Path** : `/healthz`

6. **Créer**

---

### Étape 6 : Mettre à Jour DNS Cloudflare

**Dans Cloudflare Dashboard** :
1. Aller sur https://dash.cloudflare.com
2. Sélectionner `yukpomnang.com`
3. **DNS** → **Enregistrements**
4. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Nom** : `api`
   - **Contenu** : `[votre-service].onrender.com` (URL fournie par Render)
   - **Proxy** : Activé (nuage orange) ✅

---

### Étape 7 : Tester

**Vérifications** :
```bash
# Health check
curl https://api.yukpomnang.com/healthz

# Test API
curl https://api.yukpomnang.com/api/health
```

---

## 🎯 ALTERNATIVE : Hetzner (Économique)

### Pourquoi Hetzner ?

**Avantages** :
- ✅ **Très économique** : VPS à partir de 4€/mois
- ✅ **Contrôle total** : VPS dédié
- ✅ **Déjà configuré** : `docker-compose.hetzner.yml` existe
- ✅ **Monitoring déjà en place** : Prometheus/Grafana sur Hetzner

**Inconvénients** :
- ⚠️ Plus complexe : Gestion manuelle de l'infrastructure
- ⚠️ Pas de scaling automatique

---

## 📋 PLAN DE MIGRATION HETZNER

### Étape 1 : Créer un VPS Hetzner

1. Aller sur https://www.hetzner.com/cloud
2. Créer un compte
3. **Create Server** :
   - **Location** : `Frankfurt`
   - **Image** : `Ubuntu 22.04`
   - **Type** : `CPX21` (4 vCPU, 8GB RAM, ~10€/mois) ou `CPX11` (2 vCPU, 4GB RAM, ~5€/mois)
   - **Créer**

---

### Étape 2 : Installer Docker

**Sur le VPS Hetzner** :
```bash
# Se connecter au VPS
ssh root@[IP_HETZNER]

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Installer Docker Compose
apt-get update
apt-get install -y docker-compose-plugin
```

---

### Étape 3 : Créer la Base de Données PostgreSQL

**Option A : PostgreSQL sur VPS** (avec docker-compose)
```bash
# Utiliser docker-compose.hetzner.yml
docker compose -f docker-compose.hetzner.yml up -d postgres
```

**Option B : Hetzner Managed Database** (recommandé)
1. Hetzner Dashboard → **Databases** → **Create Database**
2. **Type** : PostgreSQL
3. **Plan** : `db-fsn1-micro` (2GB, ~5€/mois)
4. **Créer**

---

### Étape 4 : Déployer le Backend

**Sur le VPS Hetzner** :
```bash
# Cloner le repository
git clone https://github.com/[votre-repo]/yukpomnang2.git
cd yukpomnang2

# Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec les bonnes valeurs

# Déployer avec Docker Compose
docker compose -f docker-compose.hetzner.yml up -d backend
```

---

### Étape 5 : Configurer Nginx (Reverse Proxy + SSL)

**Sur le VPS Hetzner** :
```bash
# Installer Nginx
apt-get install -y nginx certbot python3-certbot-nginx

# Configurer Nginx
# (voir configuration dans docker-compose.hetzner.yml ou créer manuellement)

# Obtenir certificat SSL
certbot --nginx -d api.yukpomnang.com
```

---

### Étape 6 : Mettre à Jour DNS Cloudflare

**Dans Cloudflare Dashboard** :
1. **DNS** → **Enregistrements**
2. Modifier l'enregistrement `api` :
   - **Type** : `A`
   - **Nom** : `api`
   - **Contenu** : `[IP_HETZNER]`
   - **Proxy** : Activé (nuage orange) ✅

---

## 📊 COMPARAISON

| Critère | Render | Hetzner |
|---------|--------|---------|
| **Coût** | ~$7-25/mois | ~€4-10/mois |
| **Complexité** | ⭐ Simple | ⭐⭐ Moyen |
| **Temps de déploiement** | 5-10 min | 30-60 min |
| **Scaling** | Automatique | Manuel |
| **Base de données** | Gérée | Gérée ou VPS |
| **Configuration existante** | ✅ `render.yaml` | ✅ `docker-compose.hetzner.yml` |

---

## 🎯 RECOMMANDATION FINALE

**Pour un déploiement rapide** : ✅ **Render**
- Configuration déjà prête
- Déploiement en 5-10 minutes
- Pas de gestion d'infrastructure

**Pour un déploiement économique** : ✅ **Hetzner**
- Coût très faible (4-10€/mois)
- Contrôle total
- Monitoring déjà en place

---

## 📋 CHECKLIST DE MIGRATION

### Avant la Migration
- [ ] Sauvegarder la base de données AWS
- [ ] Lister toutes les variables d'environnement AWS
- [ ] Vérifier les secrets (JWT, API keys, etc.)

### Migration Render
- [ ] Créer compte Render
- [ ] Créer base de données PostgreSQL
- [ ] Restaurer la base de données
- [ ] Créer service Web (backend)
- [ ] Configurer variables d'environnement
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

### Migration Hetzner
- [ ] Créer compte Hetzner
- [ ] Créer VPS
- [ ] Installer Docker
- [ ] Créer base de données
- [ ] Restaurer la base de données
- [ ] Déployer backend avec Docker Compose
- [ ] Configurer Nginx + SSL
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

**Date** : 2026-02-14  
**Statut** : Guide de migration créé - Prêt pour déploiement

