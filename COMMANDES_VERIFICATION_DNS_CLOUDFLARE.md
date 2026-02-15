# 🔍 Commandes : Vérification DNS Cloudflare

**Date** : 2026-02-14  
**Objectif** : Vérifier la configuration DNS pour yukpomnang.com

---

## 📋 VÉRIFICATION DNS LOCALE

### Commande : Vérifier la Résolution DNS

```bash
# Windows PowerShell
nslookup yukpomnang.com

# Linux/Mac
dig yukpomnang.com
# ou
nslookup yukpomnang.com
```

**Résultat attendu** :
- Si pointe vers Vercel : IP Vercel ou CNAME vers `*.vercel-dns.com`
- Si pointe vers Netlify : IP Netlify ou CNAME vers `*.netlify.app`
- Si pointe vers Cloudflare : IP Cloudflare (si proxy activé)

---

## 🌐 VÉRIFICATION DANS CLOUDFLARE DASHBOARD

### Étapes Manuelles

1. **Aller sur Cloudflare** :
   - URL : https://dash.cloudflare.com
   - Se connecter avec votre compte

2. **Sélectionner le domaine** :
   - Cliquer sur `yukpomnang.com`

3. **Aller dans DNS** :
   - Menu latéral → **DNS** → **Enregistrements**

4. **Chercher l'enregistrement racine** :
   - Chercher un enregistrement avec :
     - **Type** : `A` ou `CNAME`
     - **Nom** : `yukpomnang` ou `@` (racine)
     - **Contenu** : IP ou CNAME vers Vercel/Netlify

5. **Vérifier le Proxy** :
   - ✅ **Proxy activé** (nuage orange) → HTTPS automatique
   - ⚠️ **DNS uniquement** (nuage gris) → Pas de HTTPS automatique

---

## 📊 ENREGISTREMENTS ATTENDUS

### Si Déployé sur Vercel

**Enregistrement CNAME** :
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: cname.vercel-dns.com (ou IP Vercel)
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

---

### Si Déployé sur Netlify

**Enregistrement CNAME** :
```
Type: CNAME
Nom: yukpomnang (ou @)
Contenu: [nom-site].netlify.app
Proxy: Activé (nuage orange) ✅
TTL: Auto
```

---

## ✅ CHECKLIST DE VÉRIFICATION

- [ ] **Enregistrement DNS existe** pour `yukpomnang.com` (racine)
- [ ] **Type correct** : `A` ou `CNAME`
- [ ] **Contenu correct** : Pointe vers Vercel ou Netlify
- [ ] **Proxy activé** : Nuage orange (pour HTTPS)
- [ ] **DNS résout** : `nslookup yukpomnang.com` retourne une IP/CNAME

---

## 🔧 CORRECTION SI NÉCESSAIRE

### Si l'Enregistrement N'Existe Pas

**Dans Cloudflare** :
1. DNS → Enregistrements
2. **+ Ajouter un enregistrement**
3. Configurer selon Vercel/Netlify (voir ci-dessus)
4. **Activer le proxy** (nuage orange)
5. Sauvegarder

---

### Si le Proxy N'est Pas Activé

**Dans Cloudflare** :
1. Trouver l'enregistrement `yukpomnang`
2. Cliquer sur **"Modifier"**
3. **Activer le proxy** (nuage orange)
4. Sauvegarder

---

## 📊 RÉSUMÉ

| Élément | À Vérifier |
|---------|------------|
| Enregistrement existe | ✅ Oui |
| Type | ✅ A ou CNAME |
| Contenu | ✅ Pointe vers Vercel/Netlify |
| Proxy | ✅ Activé (nuage orange) |
| DNS résout | ✅ Test avec nslookup |

---

**Date** : 2026-02-14  
**Statut** : Guide de vérification DNS créé


