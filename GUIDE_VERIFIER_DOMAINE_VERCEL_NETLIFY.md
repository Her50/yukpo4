# 🔍 Guide : Vérifier Domaine yukpomnang.com dans Vercel/Netlify

**Date** : 2026-02-14  
**Objectif** : Vérifier que le domaine personnalisé est configuré

---

## 📋 VERCEL - VÉRIFIER LE DOMAINE

### Étapes dans Vercel Dashboard

1. **Aller sur Vercel** :
   - URL : https://vercel.com
   - Se connecter avec votre compte

2. **Sélectionner le projet** :
   - Cliquer sur le projet (probablement `yukpo-public` ou similaire)

3. **Aller dans Settings** :
   - Menu latéral → **Settings**

4. **Onglet Domains** :
   - Cliquer sur **"Domains"** dans le menu Settings
   - Vérifier la liste des domaines configurés

5. **Vérifier yukpomnang.com** :
   - ✅ Si `yukpomnang.com` est dans la liste → **Domaine configuré**
   - ❌ Si `yukpomnang.com` n'est pas dans la liste → **Ajouter le domaine**

---

### Ajouter le Domaine (Si Absent)

**Dans Vercel Dashboard** :

1. **Settings** → **Domains**
2. Cliquer sur **"Add Domain"**
3. Entrer : `yukpomnang.com`
4. Cliquer sur **"Add"**
5. **Vercel affichera les instructions DNS** :
   - Type : `CNAME` ou `A`
   - Nom : `@` ou `yukpomnang`
   - Valeur : URL Vercel (ex: `cname.vercel-dns.com`)

6. **Configurer le DNS dans Cloudflare** (voir section DNS ci-dessous)

---

## 📋 NETLIFY - VÉRIFIER LE DOMAINE

### Étapes dans Netlify Dashboard

1. **Aller sur Netlify** :
   - URL : https://app.netlify.com
   - Se connecter avec votre compte

2. **Sélectionner le site** :
   - Cliquer sur le site (probablement `yukpomnang` ou similaire)

3. **Aller dans Domain settings** :
   - Menu latéral → **Site configuration** → **Domain management**
   - OU **Settings** → **Domain management**

4. **Vérifier yukpomnang.com** :
   - ✅ Si `yukpomnang.com` est dans la liste → **Domaine configuré**
   - ❌ Si `yukpomnang.com` n'est pas dans la liste → **Ajouter le domaine**

---

### Ajouter le Domaine (Si Absent)

**Dans Netlify Dashboard** :

1. **Domain management** → **Add custom domain**
2. Entrer : `yukpomnang.com`
3. Cliquer sur **"Verify"**
4. **Netlify affichera les instructions DNS** :
   - Type : `A` ou `CNAME`
   - Nom : `@` ou `yukpomnang`
   - Valeur : IP Netlify ou CNAME Netlify

5. **Configurer le DNS dans Cloudflare** (voir section DNS ci-dessous)

---

## 🌐 DNS CLOUDFLARE - VÉRIFIER/CONFIGURER

### Vérifier l'Enregistrement Actuel

**Dans Cloudflare Dashboard** :

1. Aller sur https://dash.cloudflare.com
2. Sélectionner `yukpomnang.com`
3. **DNS** → **Enregistrements**
4. Chercher l'enregistrement pour `yukpomnang` (racine, sans sous-domaine)

**Vérifier** :
- ✅ Type : `A` ou `CNAME`
- ✅ Nom : `yukpomnang` ou `@`
- ✅ Contenu : IP Vercel/Netlify ou CNAME Vercel/Netlify
- ✅ Proxy : Activé (nuage orange) pour HTTPS

---

### Configurer pour Vercel

**Si le domaine pointe vers Vercel** :

**Option A : CNAME (Recommandé)**
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: cname.vercel-dns.com
Proxy: Activé (nuage orange)
TTL: Auto
```

**Option B : A Record (Si Vercel fournit une IP)**
```
Type: A
Nom: yukpomnang (ou @)
Contenu: [IP fournie par Vercel]
Proxy: Activé (nuage orange)
TTL: Auto
```

---

### Configurer pour Netlify

**Si le domaine pointe vers Netlify** :

**Option A : CNAME (Recommandé)**
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: [nom-du-site].netlify.app
Proxy: Activé (nuage orange)
TTL: Auto
```

**Option B : A Record (Si Netlify fournit une IP)**
```
Type: A
Nom: yukpomnang (ou @)
Contenu: [IP fournie par Netlify]
Proxy: Activé (nuage orange)
TTL: Auto
```

---

## ✅ VÉRIFICATION FINALE

### Test du Domaine

**Après configuration** :

1. **Attendre 2-5 minutes** pour la propagation DNS

2. **Tester HTTPS** :
   ```bash
   curl -v https://yukpomnang.com
   ```

   **Résultat attendu** : Status 200 OK avec certificat SSL valide

3. **Tester les Rewrites/Redirects** :
   ```bash
   curl -v https://yukpomnang.com/api/health
   ```

   **Résultat attendu** : Redirige vers `https://api.yukpomnang.com/health` et retourne 200 OK

---

## 📊 RÉSUMÉ

| Action | Vercel | Netlify |
|--------|--------|---------|
| Vérifier domaine | Settings → Domains | Domain management |
| Ajouter domaine | Add Domain | Add custom domain |
| Instructions DNS | Affiche CNAME/A | Affiche CNAME/A |
| Configurer DNS | Cloudflare | Cloudflare |

---

**Date** : 2026-02-14  
**Statut** : Guide de vérification créé

