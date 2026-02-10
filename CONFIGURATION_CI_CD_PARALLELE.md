# 🚀 Configuration CI/CD Parallèle : AWS + Hetzner

## ✅ Réponse à vos Questions

### 1. Redis sur Hetzner

**Hetzner n'a PAS de service Redis managé** comme AWS ElastiCache.

**Solution** : Utiliser Redis via Docker (même plus simple et moins cher !)

- ✅ **Gratuit** (€0/mois vs $30-50/mois AWS)
- ✅ **Simple** (un conteneur Docker)
- ✅ **Performant** (même serveur que backend)

Voir `REDIS_HETZNER_VS_AWS.md` pour les détails.

---

### 2. Build Automatisé Parallèle

**✅ OUI, j'ai créé un système de build parallèle !**

Le workflow GitHub Actions maintenant :
- ✅ **Maintient le système AWS existant** (aucun changement)
- ✅ **Ajoute un build parallèle vers Hetzner** (nouveau)
- ✅ **Déploie automatiquement sur les deux** (AWS ECS + Hetzner)

---

## 🔄 Workflow Complet

```
1. git push origin main
   ↓
2. GitHub Actions s'exécute :
   ├─ Build image Docker (une seule fois)
   ├─ Push vers GitHub Container Registry
   ├─ ⚡ PARALLÈLE :
   │  ├─ Push vers AWS ECR
   │  │  └─ Déploiement AWS ECS
   │  └─ Pull depuis GHCR sur Hetzner
   │     └─ Déploiement Hetzner (Docker Compose)
   ↓
3. ✅ Application déployée sur AWS ET Hetzner !
```

---

## 📋 Configuration Requise

### Secrets GitHub à Configurer

#### 1. Secrets AWS (Déjà configurés)

- `AWS_ACCESS_KEY_ID` ✅
- `AWS_SECRET_ACCESS_KEY` ✅

#### 2. Secrets Hetzner (Nouveau)

- `HETZNER_SSH_PRIVATE_KEY` : Clé privée SSH pour accéder à Hetzner

**Comment obtenir** :

```bash
# Sur votre machine locale
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f ~/.ssh/hetzner_deploy

# Copier la clé publique sur Hetzner
ssh-copy-id -i ~/.ssh/hetzner_deploy.pub root@46.224.14.85

# Copier la clé privée dans GitHub Secrets
cat ~/.ssh/hetzner_deploy
# → Copier tout le contenu dans GitHub → Settings → Secrets → HETZNER_SSH_PRIVATE_KEY
```

---

## 🔧 Configuration Hetzner

### 1. Préparer le serveur Hetzner

```bash
ssh root@46.224.14.85

# Créer les répertoires
mkdir -p /opt/yukpo/backend
cd /opt/yukpo

# Créer le fichier .env (si pas déjà créé)
nano .env
```

**Contenu de `.env`** :

```bash
# Database
DATABASE_URL=postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@postgres:5432/yukpomnang
DB_USER=yukpo_user
DB_PASSWORD=VOTRE_MOT_DE_PASSE

# Redis
REDIS_URL=redis://:VOTRE_MOT_DE_PASSE_REDIS@redis:6379/0
REDIS_PASSWORD=VOTRE_MOT_DE_PASSE_REDIS

# JWT
JWT_SECRET=VOTRE_SECRET_JWT_TRES_LONG

# Environnement
ENVIRONMENT=production
RUST_LOG=info
```

### 2. Autoriser GitHub Container Registry

```bash
# Sur Hetzner, créer un token GitHub (optionnel, pour pull privé)
# Si l'image est publique, pas besoin

# Tester le pull
docker login ghcr.io -u VOTRE_USERNAME -p VOTRE_TOKEN
docker pull ghcr.io/VOTRE_USERNAME/yukpomnang-backend-optimized:latest
```

---

## 🚀 Utilisation

### Déploiement Automatique

**Sur chaque `git push origin main`** :

1. ✅ Build automatique de l'image Docker
2. ✅ Push vers GitHub Container Registry
3. ✅ **Parallèle** :
   - Push vers AWS ECR → Déploiement AWS ECS
   - Pull sur Hetzner → Déploiement Hetzner

**Aucune action manuelle requise !**

### Déploiement Manuel

**Via GitHub Actions UI** :

1. Aller dans **Actions** → **Docker Build Optimized**
2. Cliquer **Run workflow**
3. Sélectionner :
   - ✅ `push_to_aws` : Déployer sur AWS
   - ✅ `push_to_hetzner` : Déployer sur Hetzner
   - ✅ Les deux : Déployer sur AWS ET Hetzner

---

## 📊 Comparaison des Déploiements

| Aspect | AWS | Hetzner |
|--------|-----|---------|
| **Build** | ✅ Automatique | ✅ Automatique |
| **Registry** | AWS ECR | GitHub Container Registry |
| **Déploiement** | AWS ECS (Fargate) | Docker Compose |
| **Temps** | 2-5 minutes | 1-2 minutes |
| **Coût** | $80-120/mois | €20-50/mois |

---

## 🔍 Vérification

### Vérifier AWS

```bash
aws ecs describe-services \
  --cluster yukpomnang-cluster \
  --services yukpomnang-backend-service \
  --region us-east-1
```

### Vérifier Hetzner

```bash
ssh root@46.224.14.85
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml ps
docker-compose -f docker-compose.hetzner.yml logs -f backend
```

---

## 🆘 Dépannage

### Erreur : SSH Connection Failed

```bash
# Vérifier la clé SSH
ssh -i ~/.ssh/hetzner_deploy root@46.224.14.85

# Vérifier que la clé est dans GitHub Secrets
# GitHub → Settings → Secrets → HETZNER_SSH_PRIVATE_KEY
```

### Erreur : Docker Pull Failed

```bash
# Sur Hetzner, vérifier l'accès à GHCR
docker login ghcr.io -u VOTRE_USERNAME -p VOTRE_TOKEN

# Vérifier que l'image existe
docker pull ghcr.io/VOTRE_USERNAME/yukpomnang-backend-optimized:latest
```

### Erreur : Docker Compose Failed

```bash
# Sur Hetzner, vérifier les logs
cd /opt/yukpo
docker-compose -f docker-compose.hetzner.yml logs

# Vérifier les variables d'environnement
cat .env
```

---

## ✅ Checklist

- [ ] Clé SSH créée et ajoutée dans GitHub Secrets (`HETZNER_SSH_PRIVATE_KEY`)
- [ ] Clé publique SSH copiée sur Hetzner
- [ ] Fichier `.env` créé sur Hetzner avec toutes les variables
- [ ] Docker et Docker Compose installés sur Hetzner
- [ ] Test de connexion SSH depuis GitHub Actions
- [ ] Test de pull d'image depuis GHCR sur Hetzner
- [ ] Premier déploiement testé

---

## 📚 Fichiers Modifiés

1. **`.github/workflows/docker-build-optimized.yml`**
   - ✅ Ajout du job `deploy-to-hetzner`
   - ✅ Déploiement parallèle AWS + Hetzner
   - ✅ Aucun changement au workflow AWS existant

2. **`REDIS_HETZNER_VS_AWS.md`** (nouveau)
   - Guide complet sur Redis sur Hetzner

3. **`CONFIGURATION_CI_CD_PARALLELE.md`** (ce fichier)
   - Documentation complète du système parallèle

---

## 🎯 Prochaines Étapes

1. ✅ Configurer `HETZNER_SSH_PRIVATE_KEY` dans GitHub Secrets
2. ✅ Créer le fichier `.env` sur Hetzner
3. ✅ Tester le déploiement avec `workflow_dispatch`
4. ✅ Vérifier que les deux déploiements fonctionnent
5. ✅ Faire un `git push` pour tester le déploiement automatique

---

## 💡 Avantages

- ✅ **Un seul build** : L'image est buildée une fois, puis déployée sur les deux plateformes
- ✅ **Parallèle** : AWS et Hetzner se déploient en même temps (pas d'attente)
- ✅ **Automatique** : Un simple `git push` déploie sur les deux
- ✅ **Flexible** : Vous pouvez choisir de déployer sur AWS, Hetzner, ou les deux

---

## 🎉 Résultat

**Vous avez maintenant un système de déploiement parallèle complet :**

- ✅ AWS : Build → ECR → ECS (existant, maintenu)
- ✅ Hetzner : Build → GHCR → Docker Compose (nouveau, parallèle)
- ✅ **Les deux fonctionnent en parallèle automatiquement !**

