# 🚀 Lancer la Migration vers Hetzner

## ✅ Scripts Créés

J'ai créé tous les scripts nécessaires pour la migration. Voici comment procéder :

---

## 🎯 Option 1 : Script Automatique (Recommandé)

### Exécuter le script de configuration

```powershell
# Depuis la racine du projet
cd C:\Users\23767\yukpomnang2
.\scripts\setup-hetzner-migration.ps1
```

**Ce script va** :
1. ✅ Générer une clé SSH pour Hetzner
2. ✅ Afficher la clé privée à copier dans GitHub Secrets
3. ✅ Copier la clé publique sur Hetzner
4. ✅ Vérifier/installer Docker sur Hetzner
5. ✅ Créer les répertoires nécessaires
6. ✅ Créer le fichier `.env` avec vos variables

**Temps estimé** : 5-10 minutes

---

## 🎯 Option 2 : Configuration Manuelle

Si vous préférez faire manuellement, suivez le guide :

**Voir** : `GUIDE_MIGRATION_HETZNER_ETAPE_PAR_ETAPE.md`

---

## 📋 Étapes Rapides

### 1. Générer la clé SSH

```powershell
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f $env:USERPROFILE\.ssh\hetzner_deploy -N '""'
```

### 2. Copier la clé privée dans GitHub Secrets

1. Ouvrir GitHub → Votre repository → **Settings** → **Secrets and variables** → **Actions**
2. Cliquer **New repository secret**
3. Nom : `HETZNER_SSH_PRIVATE_KEY`
4. Valeur : Copier le contenu de `$env:USERPROFILE\.ssh\hetzner_deploy`
5. Cliquer **Add secret**

### 3. Copier la clé publique sur Hetzner

```powershell
# Option A : Si ssh-copy-id disponible
ssh-copy-id -i $env:USERPROFILE\.ssh\hetzner_deploy.pub root@46.224.14.85

# Option B : Manuellement
ssh root@46.224.14.85
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Copier le contenu de hetzner_deploy.pub dans ~/.ssh/authorized_keys
```

### 4. Créer le fichier .env sur Hetzner

```powershell
# Utiliser le script
.\scripts\create-hetzner-env.ps1

# Ou manuellement
ssh root@46.224.14.85
cd /opt/yukpo
nano .env
```

**Contenu minimal** :

```bash
DATABASE_URL=postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@postgres:5432/yukpomnang
DB_USER=yukpo_user
DB_PASSWORD=VOTRE_MOT_DE_PASSE
REDIS_URL=redis://:VOTRE_MOT_DE_PASSE_REDIS@redis:6379/0
REDIS_PASSWORD=VOTRE_MOT_DE_PASSE_REDIS
JWT_SECRET=VOTRE_SECRET_JWT_TRES_LONG
ENVIRONMENT=production
RUST_LOG=info
HOST=0.0.0.0
PORT=8080
ALLOWED_ORIGINS=https://yukpomnang.com,https://api.yukpomnang.com
```

### 5. Tester le déploiement

```powershell
# Faire un commit et push
git add .
git commit -m "feat: configuration Hetzner"
git push origin main

# GitHub Actions va automatiquement déployer sur Hetzner !
```

---

## 🔍 Vérification

### Vérifier la connexion SSH

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 "echo 'Connection OK'"
```

### Vérifier le déploiement

```powershell
ssh -i $env:USERPROFILE\.ssh\hetzner_deploy root@46.224.14.85 << 'EOF'
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml ps
docker-compose -f docker-compose.hetzner.yml logs --tail=20 backend
EOF
```

---

## 📚 Fichiers Créés

1. **`scripts/setup-hetzner-migration.ps1`** - Script de configuration automatique
2. **`scripts/create-hetzner-env.ps1`** - Script pour créer le fichier .env
3. **`GUIDE_MIGRATION_HETZNER_ETAPE_PAR_ETAPE.md`** - Guide complet étape par étape
4. **`.github/workflows/docker-build-optimized.yml`** - Workflow mis à jour avec déploiement Hetzner

---

## 🚀 Prêt à Lancer !

**Exécutez maintenant** :

```powershell
.\scripts\setup-hetzner-migration.ps1
```

Le script vous guidera à travers toutes les étapes !

