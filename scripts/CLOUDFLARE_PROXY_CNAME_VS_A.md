# ✅ Configuration Cloudflare : CNAME vs Enregistrement A

## 📋 Situation Actuelle

Vous avez plusieurs enregistrements DNS dans Cloudflare :

### ✅ CNAME avec Proxy Activé (ORANGE) - **C'EST OK**

1. **CNAME `cdn` → `yukpomnang.com`**
   - Proxy : **ORANGE** (Procuration) ✅
   - **Action : LAISSER COMME ÇA**
   - Pourquoi : Le CDN peut utiliser le proxy Cloudflare pour le cache et la protection

2. **CNAME `www` → `parkingpage.namecheap.com`**
   - Proxy : **ORANGE** (Procuration) ✅
   - **Action : LAISSER COMME ÇA**
   - Pourquoi : C'est une page de parking, le proxy n'affecte pas le backend

### ⚠️ Enregistrement A Principal - **C'EST CELUI-CI QUI COMPTE**

**Enregistrement A pour `yukpomnang.com`** (domaine racine)
- Type : **A** ou **UN**
- Nom : `yukpomnang.com` (ou `@` ou vide)
- Contenu : IP de votre backend AWS (ex: `192.64.119.4` ou autre)
- Proxy : **DOIT ÊTRE GRIS** (DNS uniquement) ⚠️

## 🎯 Règle Simple

- ✅ **CNAME** (cdn, www, api, etc.) → Proxy ORANGE = **OK**
- ⚠️ **Enregistrement A** pour `yukpomnang.com` → Proxy GRIS = **OBLIGATOIRE**

## 🔍 Pourquoi cette distinction ?

1. **Enregistrement A principal** (`yukpomnang.com`)
   - Pointe directement vers votre backend AWS
   - Si le proxy est activé → Les requêtes passent par Cloudflare
   - Pour les liens externes et l'accès direct → **Proxy doit être GRIS**

2. **CNAME** (sous-domaines)
   - Pointent vers d'autres domaines ou services
   - Le proxy Cloudflare peut être utile pour :
     - Cache CDN
     - Protection DDoS
     - Optimisation
   - **Pas de problème** si le proxy est activé

## ✅ Action à Faire

1. **LAISSER** les CNAME avec proxy ORANGE (comme vous l'avez fait) ✅

2. **TROUVER** l'enregistrement **A** pour `yukpomnang.com` :
   - Chercher dans la liste DNS
   - Type : "A" ou "UN"
   - Nom : `yukpomnang.com` ou `@` ou vide
   - Contenu : Une adresse IP (pas un nom de domaine)

3. **DÉSACTIVER** le proxy pour cet enregistrement A :
   - Cliquer sur le nuage ORANGE
   - Le passer en GRIS (DNS uniquement)

4. **SAUVEGARDER**

## 🔍 Comment identifier l'enregistrement A

Dans votre liste DNS, cherchez :
- **Type** : "A" ou "UN" (pas "CNAME")
- **Nom** : `yukpomnang.com` ou vide ou `@`
- **Contenu** : Une adresse IP (ex: `192.64.119.4`, `54.xxx.xxx.xxx`, etc.)
  - **PAS** un nom de domaine comme `yukpomnang.com` ou `parkingpage.namecheap.com`

## 📝 Résumé

| Enregistrement | Type | Proxy | Action |
|---------------|------|-------|--------|
| `yukpomnang.com` | **A** | **GRIS** | ⚠️ Désactiver si ORANGE |
| `cdn` | CNAME | ORANGE | ✅ Laisser comme ça |
| `www` | CNAME | ORANGE | ✅ Laisser comme ça |
| `api` | CNAME | GRIS | ✅ OK aussi |

**L'important : C'est l'enregistrement A principal qui doit avoir le proxy désactivé !**

