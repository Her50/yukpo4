# ⚠️ Correction Requise : netlify.toml

**Date** : 2026-02-14  
**Problème** : Le fichier `netlify.toml` pointe vers l'ancien backend

---

## ❌ PROBLÈME IDENTIFIÉ

### Fichier : `frontend/netlify.toml` et `netlify.toml`

**Configuration actuelle** :
```toml
[[redirects]]
  from = "/api/*"
  to = "https://yukpomnang.onrender.com/api/:splat"  # ❌ Ancien backend
```

**Problème** : Tous les redirects pointent vers `https://yukpomnang.onrender.com` au lieu de `https://api.yukpomnang.com`

---

## ✅ CORRECTION REQUISE

### Mettre à Jour Tous les Redirects

**Changer** :
- `https://yukpomnang.onrender.com` → `https://api.yukpomnang.com`

**Fichiers à modifier** :
1. `frontend/netlify.toml`
2. `netlify.toml` (à la racine)

---

## 📋 REDIRECTS À CORRIGER

Tous les redirects suivants doivent être mis à jour :

1. `/api/*` → `https://api.yukpomnang.com/api/:splat`
2. `/auth/*` → `https://api.yukpomnang.com/auth/:splat`
3. `/services/*` → `https://api.yukpomnang.com/services/:splat`
4. `/healthz` → `https://api.yukpomnang.com/healthz`
5. `/prestataire/*` → `https://api.yukpomnang.com/prestataire/:splat`
6. `/user/*` → `https://api.yukpomnang.com/user/:splat`
7. `/users/*` → `https://api.yukpomnang.com/users/:splat`
8. `/ia/*` → `https://api.yukpomnang.com/ia/:splat`
9. `/ws/*` → `wss://api.yukpomnang.com/ws/:splat` (WebSocket)
10. `/fournitures/*` → `https://api.yukpomnang.com/fournitures/:splat`
11. `/echange/*` → `https://api.yukpomnang.com/echange/:splat`

---

## ✅ CONFIGURATION CORRECTE

**Exemple pour `/api/*`** :
```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.yukpomnang.com/api/:splat"
  status = 200
  force = true
  headers = {Access-Control-Allow-Origin = "*"}
```

**Note** : Pour WebSocket (`/ws/*`), utiliser `wss://` au lieu de `https://`

---

**Date** : 2026-02-14  
**Action** : ⚠️ Correction requise dans `netlify.toml`



