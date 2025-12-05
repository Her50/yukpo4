# ⚙️ Configuration Variables d'Environnement - Cloudflare

## 📋 Valeurs à Récupérer depuis Cloudflare

### **1. URL Cloudflare CDN**

**Où trouver** :
- Après configuration du sous-domaine `cdn.votredomaine.com`
- Dans Cloudflare Dashboard → DNS → Enregistrements
- Vérifiez que le CNAME `cdn` existe et est "Proxied" (nuage orange)

**Format** :
```
https://cdn.votredomaine.com
```

**Exemple** :
```
https://cdn.yukpo.app
```

---

### **2. URL Wasabi Direct**

**Déjà connue** :
```
https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

**Où trouver** :
- Dans votre configuration Wasabi
- Bucket : `yukpo-video-prod`
- Région : `eu-central-1`

---

## 📝 Configuration dans mobile/.env

### **Étape 1 : Ouvrir le fichier**

```bash
# Chemin
mobile/.env
```

### **Étape 2 : Ajouter/Modifier les variables**

```env
# ============================================
# CONFIGURATION CDN CLOUDFLARE
# ============================================
#
# ⚠️ IMPORTANT : Architecture Wasabi + Cloudflare
#
# WASABI = STOCKAGE (Storage)
#   - Stocke vos vidéos de manière permanente
#   - URL Wasabi : https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
#
# CLOUDFLARE = DISTRIBUTION (CDN)
#   - Distribue les vidéos depuis Wasabi vers utilisateurs
#   - Cloudflare lit depuis Wasabi et cache pour distribution optimale
#
# ============================================

# Cloudflare CDN (remplacez par votre domaine Cloudflare)
# Format : https://cdn.votredomaine.com
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.votredomaine.com

# Wasabi Direct (Fallback si Cloudflare indisponible)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

### **Étape 3 : Remplacer les valeurs**

**Remplacez** `votredomaine.com` par votre vrai domaine :

**Exemple si votre domaine est `yukpo.app`** :

```env
# Cloudflare CDN
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# Wasabi Direct (Fallback)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

## ✅ Vérification

### **Test 1 : Vérifier les variables**

```bash
# Dans mobile/
cat .env | grep CDN
cat .env | grep WASABI
```

**Résultat attendu** :
```
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.votredomaine.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

### **Test 2 : Vérifier dans l'application**

```typescript
// Dans mobile/src/config/environment.ts
console.log('CDN Cloudflare:', ENVIRONMENT.CDN_CLOUDFLARE_URL);
console.log('Wasabi Direct:', ENVIRONMENT.WASABI_DIRECT_URL);
```

**Résultat attendu** :
```
CDN Cloudflare: https://cdn.votredomaine.com
Wasabi Direct: https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

## 🔄 Après Modification

### **1. Redémarrer l'application**

```bash
# Arrêter l'application
# Puis relancer
npm run dev
# ou
expo start
```

### **2. Vérifier que les changements sont pris en compte**

- Les variables d'environnement sont chargées au démarrage
- Si changement non pris en compte, redémarrer complètement

---

## 📊 Résumé des Valeurs

| Variable | Valeur | Source |
|----------|--------|--------|
| `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` | `https://cdn.votredomaine.com` | Cloudflare Dashboard (sous-domaine créé) |
| `EXPO_PUBLIC_WASABI_DIRECT_URL` | `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com` | Configuration Wasabi existante |

---

## ⚠️ Notes Importantes

1. **Domaine Cloudflare** :
   - Doit être configuré dans Cloudflare Dashboard
   - Le sous-domaine `cdn` doit exister (CNAME)
   - Doit être "Proxied" (nuage orange)

2. **Wasabi** :
   - URL déjà connue et fonctionnelle
   - Utilisée comme fallback si Cloudflare indisponible

3. **Format URL** :
   - Toujours commencer par `https://`
   - Pas de slash final (`/`)

---

*Date : 2025-12-03*  
*Configuration variables d'environnement*

