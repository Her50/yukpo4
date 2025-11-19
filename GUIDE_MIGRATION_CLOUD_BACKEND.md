# 🔄 Guide de Migration Cloud Backend (Render → AWS/Azure/etc.)

## 📋 Vue d'Ensemble

Ce guide explique comment migrer facilement le backend de Render vers AWS, Azure, ou tout autre cloud provider **sans rien casser**.

## ✅ Architecture Modulaire Actuelle

### Points de Configuration Centralisés

L'architecture actuelle est **déjà modulaire** ! Voici où se trouvent les configurations :

#### 1. **Prometheus** (`prometheus.yml`)
```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'  # ⚠️ À changer
```

#### 2. **Frontend** (`frontend/src/config/api.config.ts` ou variables d'environnement)
```typescript
// Utilise VITE_API_BASE_URL depuis .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://yukpomnang.onrender.com';
```

#### 3. **Scripts de Déploiement**
- `deploy-hetzner-monitoring.ps1` : URL backend codée en dur
- `deploy-hetzner.sh` : Vérifie l'URL Render

#### 4. **Documentation**
- Plusieurs fichiers `.md` mentionnent l'URL Render

## 🔧 Solution : Centraliser la Configuration

### Option 1 : Variables d'Environnement (Recommandé)

#### Créer un fichier de configuration centralisé

**`config/backend-url.env`** (à créer) :
```bash
# Backend URL - Changez cette valeur pour migrer
BACKEND_URL=https://yukpomnang.onrender.com
# Exemples:
# BACKEND_URL=https://api.yukpo.aws.com
# BACKEND_URL=https://yukpo-api.azurewebsites.net
# BACKEND_URL=https://api.yukpo.com
```

#### Modifier `prometheus.yml` pour utiliser une variable

**Avant** (codé en dur) :
```yaml
- targets:
    - 'yukpomnang.onrender.com'
```

**Après** (avec variable d'environnement) :
```yaml
- targets:
    - '${BACKEND_URL}'
```

**Note** : Prometheus ne supporte pas directement les variables d'environnement. Il faut utiliser un script de templating.

#### Script de templating pour Prometheus

**`scripts/generate-prometheus-config.sh`** :
```bash
#!/bin/bash
# Génère prometheus.yml depuis un template avec variables

BACKEND_URL=${BACKEND_URL:-https://yukpomnang.onrender.com}

envsubst < prometheus.yml.template > prometheus.yml

echo "✅ prometheus.yml généré avec BACKEND_URL=$BACKEND_URL"
```

**`prometheus.yml.template`** :
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets:
          - '${BACKEND_URL}'  # Variable remplacée par envsubst
        labels:
          instance: 'yukpo-backend-cloud'
          environment: 'production'
          deployment: 'cloud'
```

### Option 2 : Fichier de Configuration JSON/YAML

**`config/backend-config.json`** :
```json
{
  "backend": {
    "url": "https://yukpomnang.onrender.com",
    "provider": "render",
    "region": "us-east-1"
  },
  "monitoring": {
    "prometheus": {
      "scrape_interval": "15s"
    }
  }
}
```

## 📝 Checklist de Migration

### Étape 1 : Préparation

- [ ] Identifier tous les endroits où l'URL backend est codée en dur
- [ ] Créer un fichier de configuration centralisé
- [ ] Mettre à jour les scripts pour utiliser la configuration

### Étape 2 : Migration Frontend

**Fichiers à modifier** :
- `frontend/.env.production` : `VITE_API_BASE_URL`
- `frontend/.env.development` : `VITE_API_BASE_URL`
- Variables d'environnement Netlify/Vercel

**Action** :
```bash
# Sur Netlify/Vercel, changer la variable d'environnement
VITE_API_BASE_URL=https://nouveau-backend.com
```

### Étape 3 : Migration Prometheus

**Fichiers à modifier** :
- `prometheus.yml` ou `prometheus.yml.template`

**Action** :
```bash
# Sur Hetzner
cd /opt/yukpo
export BACKEND_URL=https://nouveau-backend.com
./scripts/generate-prometheus-config.sh
docker compose restart prometheus
```

### Étape 4 : Migration Scripts

**Fichiers à modifier** :
- `deploy-hetzner-monitoring.ps1`
- `deploy-hetzner.sh`

**Action** : Remplacer les URLs codées en dur par des variables

### Étape 5 : Tests

- [ ] Vérifier que le frontend se connecte au nouveau backend
- [ ] Vérifier que Prometheus scrape le nouveau backend
- [ ] Vérifier que Grafana affiche les métriques
- [ ] Tester les endpoints critiques

## 🚀 Exemple : Migration Render → AWS

### 1. Déployer le backend sur AWS

```bash
# Exemple avec AWS Elastic Beanstalk ou ECS
# Nouvelle URL: https://api.yukpo.aws.com
```

### 2. Mettre à jour la configuration

**Frontend (Netlify)** :
```bash
VITE_API_BASE_URL=https://api.yukpo.aws.com
```

**Prometheus (Hetzner)** :
```bash
ssh root@46.224.14.85
cd /opt/yukpo
export BACKEND_URL=https://api.yukpo.aws.com
# Si vous utilisez le template:
./scripts/generate-prometheus-config.sh
# Sinon, éditer manuellement prometheus.yml
docker compose restart prometheus
```

### 3. Vérifier

```bash
# Vérifier que Prometheus scrape le nouveau backend
curl http://46.224.14.85:9090/api/v1/targets | grep api.yukpo.aws.com

# Vérifier la santé du backend
curl https://api.yukpo.aws.com/healthz
```

## 🚀 Exemple : Migration Render → Azure

### 1. Déployer le backend sur Azure

```bash
# Exemple avec Azure App Service
# Nouvelle URL: https://yukpo-api.azurewebsites.net
```

### 2. Mettre à jour la configuration

Même processus que pour AWS, remplacer l'URL.

## 🔒 Bonnes Pratiques

### 1. Utiliser des Variables d'Environnement

**Ne jamais coder en dur les URLs** :
```typescript
// ❌ Mauvais
const API_URL = 'https://yukpomnang.onrender.com';

// ✅ Bon
const API_URL = import.meta.env.VITE_API_BASE_URL;
```

### 2. Centraliser la Configuration

Créer un fichier `config/backend.config.ts` :
```typescript
export const backendConfig = {
  url: import.meta.env.VITE_API_BASE_URL || 'https://yukpomnang.onrender.com',
  timeout: 30000,
  retries: 3,
};
```

### 3. Utiliser des Scripts de Migration

Créer `scripts/migrate-backend.sh` :
```bash
#!/bin/bash
OLD_URL=$1
NEW_URL=$2

# Mettre à jour tous les fichiers
find . -type f -name "*.yml" -exec sed -i "s|$OLD_URL|$NEW_URL|g" {} \;
find . -type f -name "*.ts" -exec sed -i "s|$OLD_URL|$NEW_URL|g" {} \;
find . -type f -name "*.tsx" -exec sed -i "s|$OLD_URL|$NEW_URL|g" {} \;
```

## 📊 Fichiers à Modifier lors d'une Migration

### Priorité 1 (Critique)
- [ ] `prometheus.yml` (Hetzner)
- [ ] Variables d'environnement frontend (Netlify/Vercel)
- [ ] Variables d'environnement backend (nouveau cloud)

### Priorité 2 (Important)
- [ ] `frontend/src/config/api.config.ts`
- [ ] `deploy-hetzner-monitoring.ps1`
- [ ] `deploy-hetzner.sh`

### Priorité 3 (Documentation)
- [ ] Tous les fichiers `.md` mentionnant l'URL Render
- [ ] README.md
- [ ] Guides de déploiement

## ✅ Conclusion

**Oui, la configuration est modulaire !** Il suffit de :

1. **Changer les variables d'environnement** (frontend + backend)
2. **Mettre à jour `prometheus.yml`** (1 ligne à changer)
3. **Redémarrer Prometheus** (1 commande)

**Temps estimé de migration** : 5-10 minutes

**Risque de casse** : Très faible si vous suivez cette checklist

---

## 🔧 Amélioration Proposée

Pour rendre la migration encore plus facile, je peux créer :

1. **Script de migration automatique** : `migrate-backend.sh`
2. **Template Prometheus avec variables** : `prometheus.yml.template`
3. **Fichier de configuration centralisé** : `config/backend-config.json`

Souhaitez-vous que je les crée maintenant ?

