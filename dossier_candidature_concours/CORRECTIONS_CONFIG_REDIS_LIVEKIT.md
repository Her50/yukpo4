# Corrections de Configuration Redis/LiveKit

## Date: 2025-11-26

## 🔧 Corrections à Appliquer sur Render.com

### 1. Redis - Correction de l'URL Upstash

**❌ Configuration actuelle (INCORRECTE):**
```
REDIS_URL=redis://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379
```

**✅ Configuration corrigée:**
```
REDIS_URL=rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379
```

**🔍 Problème identifié:**
- Upstash utilise **TLS/SSL** par défaut
- Il faut utiliser `rediss://` (avec **deux 's'**) au lieu de `redis://`
- C'est pour ça que la résolution DNS échoue - Upstash refuse les connexions non sécurisées

**📝 Action:**
1. Aller sur Render.com → Dashboard → Votre service
2. Section "Environment"
3. Trouver la variable `REDIS_URL`
4. Remplacer `redis://` par `rediss://` au début de l'URL
5. Sauvegarder et redéployer

---

### 2. LiveKit - IP non accessible

**Configuration actuelle:**
```
LIVEKIT_API_URL=http://46.224.14.85:7880
LIVEKIT_HLS_URL=http://46.224.14.85:8080/live
```

**🔍 Problèmes identifiés:**
1. ⚠️ IP `46.224.14.85` - probablement non accessible depuis Render.com (IP privée ou réseau interne)
2. ⚠️ URLs en HTTP (non sécurisé) - devrait être HTTPS si accessible publiquement
3. ⚠️ Connexion impossible observée dans les logs

**📝 Options:**

#### Option A: Désactiver LiveKit (recommandé si non utilisé)
Si LiveKit n'est pas utilisé actuellement, **supprimer toutes les variables LiveKit**:
- `LIVEKIT_API_URL`
- `LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_HLS_URL`

#### Option B: Utiliser un serveur LiveKit accessible (si LiveKit est nécessaire)
1. Vérifier que l'IP `46.224.14.85` est accessible depuis Render.com
2. Si l'IP n'est pas accessible, utiliser:
   - Un serveur LiveKit public avec IP/DNS accessible
   - LiveKit Cloud (https://cloud.livekit.io)
   - Un serveur LiveKit self-hosted avec IP publique
3. Utiliser HTTPS/WSS pour la production

**📝 Action (Option B):**
1. Aller sur Render.com → Dashboard → Votre service
2. Section "Environment"
3. Mettre à jour les variables LiveKit avec des URLs accessibles:
   - `LIVEKIT_API_URL=https://[your-livekit-server]/api`
   - `LIVEKIT_WS_URL=wss://[your-livekit-server]`
   - `LIVEKIT_HLS_URL=https://[your-livekit-server]/hls`
4. Sauvegarder et redéployer

---

## ✅ Checklist de Vérification

### Redis
- [ ] `REDIS_URL` utilise `rediss://` (avec deux 's')
- [ ] Format: `rediss://default:[password]@[endpoint].upstash.io:6379`
- [ ] Pas d'espaces ou caractères spéciaux dans l'URL
- [ ] Test de connexion réussi après correction

### LiveKit
- [ ] Soit toutes les variables LiveKit sont supprimées (Option A)
- [ ] Soit toutes les variables LiveKit sont configurées correctement (Option B)
- [ ] Pas de caractère `@` au début des URLs
- [ ] URLs accessibles depuis Render.com (pas d'IP privée)
- [ ] Si HTTPS disponible, utiliser HTTPS au lieu de HTTP

---

## 🔍 Vérification Post-Correction

Après avoir appliqué les corrections, vérifier dans les logs:

### Redis - Succès attendu:
```
✅ Connexion Redis établie avec succès
✅ Connexion Redis établie - Backend v2.1.4
```

### LiveKit - Si activé, succès attendu:
```
✅ LiveKit configuré et activé
```

### LiveKit - Si désactivé, message attendu:
```
ℹ️ LiveKit non configuré (service optionnel)
```

---

## 📋 Variables d'Environnement Complètes

### Redis (Requis pour WebSocket optimal)
```bash
REDIS_URL=rediss://default:[password]@[endpoint].upstash.io:6379
```

### LiveKit (Optionnel - seulement si utilisé)
```bash
LIVEKIT_API_URL=http://[your-server]:7880
LIVEKIT_WS_URL=ws://[your-server]:7880
LIVEKIT_API_KEY=[your-api-key]
LIVEKIT_API_SECRET=[your-api-secret]
LIVEKIT_HLS_URL=http://[your-server]:8080/live
```

---

## 🚨 Notes Importantes

1. **Redis Upstash**: Toujours utiliser `rediss://` (TLS) pour Upstash
2. **LiveKit**: Si l'IP `46.224.14.85` n'est pas accessible publiquement, LiveKit ne fonctionnera pas
3. **Sécurité**: Pour la production, utiliser HTTPS/WSS pour LiveKit
4. **Redéploiement**: Après modification des variables, Render redéploie automatiquement

---

## 🔗 Ressources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [LiveKit Cloud](https://cloud.livekit.io)
- [Render Environment Variables](https://render.com/docs/environment-variables)

