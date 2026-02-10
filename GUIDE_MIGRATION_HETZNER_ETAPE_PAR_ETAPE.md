# 🚀 Guide Migration Backend vers Hetzner - Étape par Étape

## 📋 Vue d'ensemble

Ce guide vous accompagne dans la migration complète du backend vers Hetzner avec déploiement automatique.

---

## ✅ Prérequis

- ✅ Serveur Hetzner accessible (`46.224.14.85`)
- ✅ Accès SSH au serveur Hetzner
- ✅ Compte GitHub avec accès aux Secrets
- ✅ PowerShell (Windows) ou Bash (Linux/Mac)

---

## 🎯 Étapes de Migration

### **ÉTAPE 1 : Configuration Automatique (Recommandée)**

Exécutez le script PowerShell qui configure tout automatiquement :

```powershell
# Depuis la racine du projet
.\scripts\setup-hetzner-migration.ps1
```

**Ce script fait** :
1. ✅ Génère une clé SSH pour Hetzner
2. ✅ Affiche la clé privée à copier dans GitHub Secrets
3. ✅ Copie la clé publique sur Hetzner
4. ✅ Vérifie/installe Docker sur Hetzner
5. ✅ Crée les répertoires nécessaires
6. ✅ Crée le fichier `.env` avec vos variables

**Temps estimé** : 5-10 minutes

---

### **ÉTAPE 2 : Configuration Manuelle (Alternative)**

Si vous préférez faire manuellement :

#### 2.1. Générer la clé SSH

```powershell
# Windows PowerShell
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f $env:USERPROFILE\.ssh\hetzner_deploy -N '""'

# Linux/Mac
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f ~/.ssh/hetzner_deploy -N ""
```

#### 2.2. Copier la clé publique sur Hetzner

```powershell
# Windows (si ssh-copy-id disponible)
ssh-copy-id -i $env:USERPROFILE\.ssh\hetzner_deploy.pub root@46.224.14.85

# Ou manuellement
ssh root@46.224.14.85
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Copier le contenu de hetzner_deploy.pub dans ~/.ssh/authorized_keys
```

#### 2.3. Ajouter la clé privée dans GitHub Secrets

1. Ouvrir GitHub → Votre repository → **Settings** → **Secrets and variables** → **Actions**
2. Cliquer **New repository secret**
3. Nom : `HETZNER_SSH_PRIVATE_KEY`
4. Valeur : Copier tout le contenu de `hetzner_deploy` (clé privée)
5. Cliquer **Add secret**

#### 2.4. Créer le fichier .env sur Hetzner

```powershell
# Utiliser le script
.\scripts\create-hetzner-env.ps1

# Ou manuellement
ssh root@46.224.14.85
cd /opt/yukpo
nano .env
```

**Contenu minimal du `.env`** :

```bash
# Database PostgreSQL
DATABASE_URL=postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@postgres:5432/yukpomnang
DB_USER=yukpo_user
DB_PASSWORD=VOTRE_MOT_DE_PASSE

# Redis
REDIS_URL=redis://:VOTRE_MOT_DE_PASSE_REDIS@redis:6379/0
REDIS_PASSWORD=VOTRE_MOT_DE_PASSE_REDIS

# JWT
JWT_SECRET=VOTRE_SECRET_JWT_TRES_LONG_MINIMUM_64_CARACTERES

# Environnement
ENVIRONMENT=production
RUST_LOG=info
HOST=0.0.0.0
PORT=8080

# CORS
ALLOWED_ORIGINS=https://yukpomnang.com,https://api.yukpomnang.com
```

---

### **ÉTAPE 3 : Vérifier la Configuration**

#### 3.1. Tester la connexion SSH

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "echo 'Connection OK'"
```

#### 3.2. Vérifier Docker sur Hetzner

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "docker --version && docker compose version"
```

#### 3.3. Vérifier le fichier .env

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "cd /opt/yukpo && cat .env"
```

---

### **ÉTAPE 4 : Premier Déploiement**

#### Option A : Déploiement Automatique (Recommandé)

1. Faire un commit et push :

```powershell
git add .
git commit -m "feat: configuration Hetzner pour déploiement automatique"
git push origin main
```

2. GitHub Actions va automatiquement :
   - ✅ Build l'image Docker
   - ✅ Push vers GitHub Container Registry
   - ✅ Déployer sur AWS (existant)
   - ✅ Déployer sur Hetzner (nouveau)

#### Option B : Déploiement Manuel via GitHub Actions

1. Aller dans GitHub → **Actions**
2. Sélectionner **Docker Build Optimized**
3. Cliquer **Run workflow**
4. Cocher `push_to_hetzner`
5. Cliquer **Run workflow**

---

### **ÉTAPE 5 : Vérifier le Déploiement**

#### 5.1. Vérifier les conteneurs sur Hetzner

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml ps
EOF
```

**Résultat attendu** :
```
NAME                STATUS              PORTS
yukpo-backend        Up 2 minutes        127.0.0.1:8080->8080/tcp
yukpo-postgres       Up 2 minutes        127.0.0.1:5432->5432/tcp
yukpo-redis          Up 2 minutes        127.0.0.1:6379->6379/tcp
```

#### 5.2. Vérifier les logs

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml logs -f --tail=50 backend
EOF
```

#### 5.3. Tester l'endpoint health

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "curl -f http://localhost:8080/api/health"
```

**Résultat attendu** : `{"status":"ok"}` ou similaire

---

## 🔧 Configuration Nginx (Optionnel)

Si vous voulez exposer le backend publiquement via Nginx :

### 1. Installer Nginx et Certbot

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
EOF
```

### 2. Configurer Nginx

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cat > /etc/nginx/sites-available/yukpomnang << 'NGINX_EOF'
server {
    listen 80;
    server_name api.yukpomnang.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF

ln -s /etc/nginx/sites-available/yukpomnang /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
EOF
```

### 3. Configurer SSL (Let's Encrypt)

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "certbot --nginx -d api.yukpomnang.com"
```

---

## 🆘 Dépannage

### Erreur : SSH Connection Failed

```powershell
# Vérifier la clé SSH
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy -v root@46.224.14.85

# Vérifier que la clé est dans GitHub Secrets
# GitHub → Settings → Secrets → HETZNER_SSH_PRIVATE_KEY
```

### Erreur : Docker Pull Failed

```powershell
# Sur Hetzner, vérifier l'accès à GHCR
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
docker login ghcr.io -u VOTRE_USERNAME -p VOTRE_TOKEN
docker pull ghcr.io/VOTRE_USERNAME/yukpomnang-backend-optimized:latest
EOF
```

### Erreur : Container ne démarre pas

```powershell
# Vérifier les logs
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml logs backend
docker-compose -f docker-compose.hetzner.yml logs postgres
docker-compose -f docker-compose.hetzner.yml logs redis
EOF
```

### Erreur : Variables d'environnement manquantes

```powershell
# Vérifier le fichier .env
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "cd /opt/yukpo && cat .env"

# Vérifier que les variables sont chargées
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cd /opt/yukpo
set -a
source .env
set +a
echo "DATABASE_URL: $DATABASE_URL"
echo "REDIS_URL: $REDIS_URL"
EOF
```

---

## ✅ Checklist de Migration

- [ ] Clé SSH générée (`hetzner_deploy`)
- [ ] Clé privée copiée dans GitHub Secrets (`HETZNER_SSH_PRIVATE_KEY`)
- [ ] Clé publique copiée sur Hetzner
- [ ] Docker installé sur Hetzner
- [ ] Répertoires créés sur Hetzner (`/opt/yukpo`)
- [ ] Fichier `.env` créé sur Hetzner avec toutes les variables
- [ ] Test de connexion SSH réussi
- [ ] Premier déploiement testé via GitHub Actions
- [ ] Conteneurs démarrés et fonctionnels
- [ ] Health check réussi
- [ ] Nginx configuré (optionnel)
- [ ] SSL configuré (optionnel)

---

## 📚 Ressources

- **Script de configuration** : `scripts/setup-hetzner-migration.ps1`
- **Script .env** : `scripts/create-hetzner-env.ps1`
- **Workflow GitHub Actions** : `.github/workflows/docker-build-optimized.yml`
- **Documentation CI/CD** : `CONFIGURATION_CI_CD_PARALLELE.md`
- **Redis Hetzner** : `REDIS_HETZNER_VS_AWS.md`

---

## 🎉 Résultat Final

Une fois la migration terminée, vous aurez :

- ✅ **Backend déployé automatiquement** sur Hetzner à chaque `git push`
- ✅ **Déploiement parallèle** : AWS + Hetzner simultanément
- ✅ **Monitoring** : Prometheus/Grafana déjà sur Hetzner
- ✅ **Coûts réduits** : 70-80% moins cher qu'AWS

---

## 🚀 Prochaines Étapes

1. ✅ Exécuter `setup-hetzner-migration.ps1`
2. ✅ Vérifier la configuration
3. ✅ Faire un `git push` pour tester
4. ✅ Vérifier le déploiement
5. ✅ Migrer les données PostgreSQL (voir `MIGRATION_POSTGRESQL_HETZNER_VERS_AZURE_AWS.md`)

