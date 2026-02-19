# 🚀 Guide Complet : Redéploiement et Vérification

**Date** : 2026-02-14  
**Actions** : Redéployer Vercel/Netlify, Vérifier domaine, Vérifier DNS

---

## 📋 ACTION 1 : REDÉPLOIEMENT VERCEL/NETLIFY

### Vercel - Redéploiement

#### Option A : Via Dashboard (Recommandé)

1. **Aller sur** : https://vercel.com
2. **Sélectionner** le projet
3. **Deployments** → Cliquer sur **"Redeploy"** sur le dernier déploiement
4. **OU** **Deployments** → **"Create Deployment"**

#### Option B : Via CLI

```bash
# Installer Vercel CLI (si nécessaire)
npm install -g vercel

# Se connecter
vercel login

# Redéployer
cd frontend
vercel --prod
```

---

### Netlify - Redéploiement

#### Option A : Via Dashboard (Recommandé)

1. **Aller sur** : https://app.netlify.com
2. **Sélectionner** le site
3. **Deploys** → **"Trigger deploy"** → **"Deploy site"**
4. **OU** Cliquer sur **"Redeploy"** sur le dernier déploiement

#### Option B : Via CLI

```bash
# Installer Netlify CLI (si nécessaire)
npm install -g netlify-cli

# Se connecter
netlify login

# Redéployer
cd frontend
netlify deploy --prod
```

---

## 📋 ACTION 2 : VÉRIFIER DOMAINE yukpomnang.com

### Vercel - Vérifier le Domaine

**Étapes** :

1. **Aller sur** : https://vercel.com
2. **Sélectionner** le projet
3. **Settings** → **Domains**
4. **Vérifier** si `yukpomnang.com` est dans la liste

**Si absent** :
1. **Add Domain** → Entrer `yukpomnang.com`
2. **Suivre les instructions DNS** affichées par Vercel
3. **Configurer dans Cloudflare** (voir Action 3)

---

### Netlify - Vérifier le Domaine

**Étapes** :

1. **Aller sur** : https://app.netlify.com
2. **Sélectionner** le site
3. **Domain management** (ou **Settings** → **Domain management**)
4. **Vérifier** si `yukpomnang.com` est dans la liste

**Si absent** :
1. **Add custom domain** → Entrer `yukpomnang.com`
2. **Verify** → Suivre les instructions DNS
3. **Configurer dans Cloudflare** (voir Action 3)

---

## 📋 ACTION 3 : VÉRIFIER DNS CLOUDFLARE

### Vérification dans Cloudflare Dashboard

**Étapes** :

1. **Aller sur** : https://dash.cloudflare.com
2. **Sélectionner** `yukpomnang.com`
3. **DNS** → **Enregistrements**
4. **Chercher** l'enregistrement pour `yukpomnang` (racine, sans sous-domaine)

**Vérifier** :
- ✅ **Type** : `A` ou `CNAME`
- ✅ **Nom** : `yukpomnang` ou `@`
- ✅ **Contenu** : IP Vercel/Netlify ou CNAME Vercel/Netlify
- ✅ **Proxy** : Activé (nuage orange) pour HTTPS

---

### Configuration pour Vercel

**Si le domaine doit pointer vers Vercel** :

**Option A : CNAME (Recommandé)**
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: cname.vercel-dns.com
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

**Option B : A Record (Si Vercel fournit une IP)**
```
Type: A
Nom: yukpomnang (ou @)
Contenu: [IP fournie par Vercel]
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

---

### Configuration pour Netlify

**Si le domaine doit pointer vers Netlify** :

**Option A : CNAME (Recommandé)**
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: [nom-site].netlify.app
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

**Option B : A Record (Si Netlify fournit une IP)**
```
Type: A
Nom: yukpomnang (ou @)
Contenu: [IP fournie par Netlify]
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

---

## ✅ VÉRIFICATION DNS LOCALE

**Commande** :
```bash
nslookup yukpomnang.com
```

**Résultat actuel** :
```
Addresses: 2606:4700:3030::6815:1c87 (IPv6 Cloudflare)
```

**Interprétation** :
- ✅ Résout vers Cloudflare (IPv6)
- ✅ Le proxy Cloudflare est probablement activé
- ⏳ Vérifier dans Cloudflare Dashboard que l'enregistrement pointe vers Vercel/Netlify

---

## 📊 CHECKLIST COMPLÈTE

### Redéploiement
- [ ] Vercel redéployé (Dashboard ou CLI)
- [ ] Netlify redéployé (Dashboard ou CLI)

### Domaine
- [ ] `yukpomnang.com` vérifié dans Vercel
- [ ] `yukpomnang.com` vérifié dans Netlify
- [ ] Domaine ajouté si absent

### DNS Cloudflare
- [ ] Enregistrement `yukpomnang` vérifié
- [ ] Type correct (A ou CNAME)
- [ ] **Contenu pointe vers Vercel/Netlify** ⚠️ À vérifier
- [ ] Proxy activé (nuage orange)
- [ ] DNS résout correctement

---

## 🎯 PROCHAINES ÉTAPES

### 1. Déterminer Quelle Plateforme Utilise yukpomnang.com

**Question** : Le domaine `yukpomnang.com` pointe-t-il vers Vercel ou Netlify ?

**Pour le savoir** :
- Vérifier dans Vercel Dashboard → Settings → Domains
- Vérifier dans Netlify Dashboard → Domain management
- Vérifier dans Cloudflare → DNS → Enregistrements → Contenu de l'enregistrement `yukpomnang`

---

### 2. Configurer le DNS Correctement

**Si Vercel** :
- Configurer CNAME vers `cname.vercel-dns.com` (ou IP Vercel)
- Activer le proxy (nuage orange)

**Si Netlify** :
- Configurer CNAME vers `[nom-site].netlify.app` (ou IP Netlify)
- Activer le proxy (nuage orange)

---

### 3. Tester Après Configuration

**Attendre 2-5 minutes** pour la propagation DNS, puis :

```bash
# Test HTTPS
curl -v https://yukpomnang.com

# Test API via proxy
curl -v https://yukpomnang.com/api/health
```

**Résultat attendu** :
- Status: 200 OK
- Certificat SSL valide
- API redirige vers `https://api.yukpomnang.com/health`

---

## 📊 RÉSUMÉ

| Action | Statut | Fichiers |
|--------|--------|----------|
| **Redéploiement Vercel** | ⏳ À faire | Guides créés |
| **Redéploiement Netlify** | ⏳ À faire | Guides créés |
| **Vérifier domaine Vercel** | ⏳ À faire | Guide créé |
| **Vérifier domaine Netlify** | ⏳ À faire | Guide créé |
| **Vérifier DNS Cloudflare** | ⏳ À faire | Guide créé |

---

**Date** : 2026-02-14  
**Statut** : Guides créés - Actions à effectuer manuellement



