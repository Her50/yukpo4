# ⚡ Configuration Temporaire : Wasabi Directement (Sans Domaine)

## 🎯 Utilisation Immédiate Sans Acheter de Domaine

Si vous ne voulez pas acheter de domaine maintenant, vous pouvez utiliser Wasabi directement.

---

## 📝 Configuration mobile/.env

### **Créer ou Modifier** : `mobile/.env`

```env
# ============================================
# CONFIGURATION TEMPORAIRE : WASABI DIRECT
# ============================================
#
# ⚠️ Cette configuration utilise Wasabi directement
#    sans CDN Cloudflare (car pas de domaine)
#
# Performance : Bonne, mais pas optimale
# Coût : Aucun (Wasabi déjà configuré)
#
# Plus tard : Quand vous aurez un domaine,
#             changez EXPO_PUBLIC_CDN_CLOUDFLARE_URL
#             vers votre domaine Cloudflare
#
# ============================================

# Wasabi Direct (utilisé comme CDN et fallback)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com

# Wasabi Direct (fallback - même URL)
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

---

## ✅ Avantages

- ✅ **Fonctionne immédiatement**
- ✅ **Aucun coût supplémentaire**
- ✅ **Pas besoin de domaine**
- ✅ **Vous pouvez tester l'application**

---

## ⚠️ Inconvénients

- ❌ **Pas de cache CDN** (performance moindre)
- ❌ **Latence plus élevée** pour utilisateurs éloignés
- ❌ **Pas de distribution optimale** (pas de PoP Cloudflare)

---

## 🔄 Migration Future vers Cloudflare

**Quand vous aurez un domaine** :

1. **Acheter domaine** (Namecheap, GoDaddy, etc.)
2. **Configurer dans Cloudflare** (voir `GUIDE_CLOUDFLARE_PAS_A_PAS.md`)
3. **Créer sous-domaine** `cdn.votredomaine.com`
4. **Modifier** `mobile/.env` :

```env
# Après configuration Cloudflare
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.votredomaine.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

5. **Redémarrer l'application**

---

## 🎯 Recommandation

**Pour l'instant** :
- ✅ Utiliser Wasabi directement
- ✅ Tester l'application
- ✅ Vérifier que tout fonctionne

**Plus tard** :
- ✅ Acheter domaine (~$10-15/an)
- ✅ Configurer Cloudflare
- ✅ Améliorer performance

---

*Date : 2025-12-03*  
*Configuration Wasabi temporaire*

