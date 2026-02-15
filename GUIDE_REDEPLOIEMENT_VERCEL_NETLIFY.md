# 🚀 Guide : Redéploiement Vercel/Netlify

**Date** : 2026-02-14  
**Objectif** : Appliquer les changements de configuration

---

## 📋 VERCEL - REDÉPLOIEMENT

### Option 1 : Redéploiement Automatique (Recommandé)

**Si le repository est connecté à Vercel** :
- Les changements seront appliqués automatiquement au prochain push
- OU lors du prochain déploiement automatique

**Action** : Push vers le repository (si pas déjà fait)

---

### Option 2 : Redéploiement Manuel via CLI

**Prérequis** : Vercel CLI installé

```bash
# Installer Vercel CLI (si pas déjà installé)
npm install -g vercel

# Se connecter à Vercel
vercel login

# Aller dans le dossier frontend
cd frontend

# Redéployer en production
vercel --prod
```

---

### Option 3 : Redéploiement via Dashboard

**Dans Vercel Dashboard** :
1. Aller sur https://vercel.com
2. Sélectionner le projet
3. Aller dans l'onglet **"Deployments"**
4. Cliquer sur **"Redeploy"** sur le dernier déploiement
5. OU créer un nouveau déploiement depuis **"Deployments"** → **"Create Deployment"**

---

## 📋 NETLIFY - REDÉPLOIEMENT

### Option 1 : Redéploiement Automatique (Recommandé)

**Si le repository est connecté à Netlify** :
- Les changements seront appliqués automatiquement au prochain push
- OU lors du prochain déploiement automatique

**Action** : Push vers le repository (si pas déjà fait)

---

### Option 2 : Redéploiement Manuel via CLI

**Prérequis** : Netlify CLI installé

```bash
# Installer Netlify CLI (si pas déjà installé)
npm install -g netlify-cli

# Se connecter à Netlify
netlify login

# Aller dans le dossier frontend
cd frontend

# Redéployer
netlify deploy --prod
```

---

### Option 3 : Redéploiement via Dashboard

**Dans Netlify Dashboard** :
1. Aller sur https://app.netlify.com
2. Sélectionner le site
3. Aller dans l'onglet **"Deploys"**
4. Cliquer sur **"Trigger deploy"** → **"Deploy site"**
5. OU cliquer sur **"Redeploy"** sur le dernier déploiement

---

## ✅ VÉRIFICATION APRÈS REDÉPLOIEMENT

### Test des Rewrites/Redirects

**Test API** :
```bash
curl -v https://yukpomnang.com/api/health
```

**Résultat attendu** : Redirige vers `https://api.yukpomnang.com/health` et retourne 200 OK

---

**Date** : 2026-02-14  
**Statut** : Guide de redéploiement créé


