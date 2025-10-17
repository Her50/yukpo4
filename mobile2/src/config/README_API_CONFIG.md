# Configuration API Mobile

## Problème résolu : Recherche de services

Le problème "0 service trouvé" était dû à une différence d'URL API entre le frontend et le mobile :

- **Frontend** : utilisait `localhost:3001` en développement
- **Mobile** : utilisait `https://yukpomnang.onrender.com` (production)

## Solution appliquée

1. **Configuration centralisée** : Tous les fichiers utilisent maintenant `process.env.EXPO_PUBLIC_API_URL` avec fallback vers `localhost:3001`

2. **Fichiers corrigés** :
   - `src/config/environment.ts` : URL par défaut changée vers `localhost:3001`
   - `src/services/yukpoclient.ts` : utilise la configuration centralisée
   - `src/services/api.ts` : utilise la configuration centralisée
   - `src/screens/MesServicesScreen.tsx` : URLs corrigées
   - `src/components/ServiceManagementCard.tsx` : URLs corrigées
   - `src/screens/RechargeTokensScreen.tsx` : URLs corrigées
   - `src/components/ServiceCard.tsx` : URLs corrigées
   - `src/screens/ChatbotAI.tsx` : URLs corrigées
   - `src/config/appConfig.ts` : URLs corrigées
   - `src/screens/FormulaireYukpoIntelligent.tsx` : URLs corrigées
   - `src/services/websocketService.ts` : URLs WebSocket corrigées
   - `src/components/ChatModalAdvanced.tsx` : URLs WebSocket corrigées
   - `src/config/websocket.ts` : URLs WebSocket corrigées

## Configuration requise

Pour utiliser l'API locale, créez un fichier `.env` dans le dossier `mobile/` avec :

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_WS_URL=ws://localhost:3001/ws
EXPO_PUBLIC_ENVIRONMENT=development
```

Pour utiliser l'API de production, utilisez :

```env
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com/ws
EXPO_PUBLIC_ENVIRONMENT=production
```

## Test

Maintenant, la recherche de services devrait fonctionner correctement car le mobile utilise la même API que le frontend.

