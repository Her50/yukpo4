# 📋 Variables d'Environnement à Insérer dans mobile/.env

## ✅ Variables CDN à Ajouter

Ajoutez ces variables dans votre fichier `mobile/.env` :

```env
# ============================================
# CDN Configuration - Cloudflare + Wasabi
# ============================================

# URL Cloudflare CDN (via Worker - votre domaine)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com

# URL Wasabi Direct (fallback si Cloudflare indisponible)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

## 📝 Liste Complète des Variables

Si vous voulez toutes les variables (CDN + autres déjà existantes) :

```env
# ============================================
# CDN Configuration - Cloudflare + Wasabi
# ============================================
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com

# ============================================
# Backend API (déjà configuré normalement)
# ============================================
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production

# ============================================
# Google Services (déjà configuré normalement)
# ============================================
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
```

## 🎯 Variables Essentielles pour CDN

**Minimum requis** (juste pour CDN) :

```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

## ✅ Action

1. **Ouvrez** `mobile/.env`
2. **Ajoutez** ces 2 lignes :
   ```
   EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com
   EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
   ```
3. **Sauvegardez** le fichier
4. **Redémarrez** l'application Expo

## 📋 Explication

- **EXPO_PUBLIC_CDN_CLOUDFLARE_URL** : URL du CDN Cloudflare (via votre Worker)
- **EXPO_PUBLIC_WASABI_DIRECT_URL** : URL directe Wasabi (fallback si Cloudflare indisponible)

---

**Ces 2 variables suffisent pour activer le CDN dans votre application !**



