# Rôle de EXPO_PUBLIC_WASABI_DIRECT_URL

## ✅ Statut

Cette variable **existait déjà** dans le code avec une valeur par défaut :
- Fichier : `mobile/src/config/environment.ts` (ligne 23)
- Valeur par défaut : `https://yukpo-video-prod.s3.eu-central-1.wasabisys.com`

## 🎯 Rôle : Fallback (Secours)

### Architecture de Fallback

```
1. Cloudflare CDN (priorité 1)
   └─> Si disponible → Utilise Cloudflare
   
2. Wasabi Direct (priorité 2 - FALLBACK)
   └─> Si Cloudflare indisponible → Utilise Wasabi directement
   
3. Backend Direct (priorité 3 - DERNIER RECOURS)
   └─> Si tout échoue → Utilise backend
```

### Quand est-ce utilisé ?

**Scénario 1 : Cloudflare indisponible**
- Cloudflare est down ou lent
- L'application bascule automatiquement vers Wasabi Direct
- Les vidéos continuent de fonctionner

**Scénario 2 : Détection de latence**
- Le service CDN teste Cloudflare et Wasabi
- Si Wasabi est plus rapide → Utilise Wasabi Direct
- Sinon → Utilise Cloudflare

**Scénario 3 : Configuration manuelle**
- Vous pouvez forcer l'utilisation de Wasabi Direct
- Utile pour tests ou si Cloudflare n'est pas configuré

## 📝 Dans le code

Fichier : `mobile/src/services/cdnService.ts`

```typescript
const CDN_ENDPOINTS: CDNEndpoint[] = [
    {
        name: 'Cloudflare',
        url: ENVIRONMENT.CDN_CLOUDFLARE_URL || 'https://cdn.yukpo.app',
        region: 'global',
    },
    {
        name: 'Wasabi Direct',
        // ✅ FALLBACK : Si Cloudflare indisponible
        url: ENVIRONMENT.WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',
        region: 'eu-central',
    },
    {
        name: 'Backend Direct',
        url: '', // Sera rempli avec l'URL du backend
        region: 'fallback',
    },
];
```

## ⚠️ Pourquoi l'ajouter dans .env ?

Même si la valeur par défaut existe, il est recommandé de l'ajouter dans `.env` pour :
1. **Clarté** : Voir explicitement la configuration
2. **Flexibilité** : Changer facilement si besoin
3. **Cohérence** : Toutes les URLs CDN au même endroit

## ✅ Conclusion

- **Rôle** : Fallback si Cloudflare indisponible
- **Existe déjà** : Oui, avec valeur par défaut
- **Nécessaire dans .env ?** : Recommandé mais pas obligatoire
- **Utilité** : Garantit que les vidéos fonctionnent même si Cloudflare est down



