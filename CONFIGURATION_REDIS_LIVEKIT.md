# 🔧 Configuration Redis et LiveKit pour Yukpomnang

## 📋 Vue d'ensemble

Ce guide vous aide à configurer **Redis** (cache) et **LiveKit** (streaming) sur Render.com.

---

## 🔴 PARTIE 1 : Configuration Redis (Upstash)

### Étape 1 : Créer un compte Upstash (Gratuit)

1. Allez sur **https://console.upstash.com**
2. Cliquez sur **"Sign Up"** (utilisez GitHub/Google pour plus de rapidité)
3. Connectez-vous

### Étape 2 : Créer une base Redis

1. Dans le dashboard Upstash, cliquez sur **"Create Database"**
2. Remplissez le formulaire :
   - **Name** : `yukpomnang-cache`
   - **Type** : `Regional` (gratuit)
   - **Region** : `us-east-1` (ou la région la plus proche)
   - **Primary Region** : Sélectionnez la même région
3. Cliquez sur **"Create"**

### Étape 3 : Récupérer l'URL Redis

1. Une fois la base créée, cliquez dessus
2. Dans l'onglet **"Details"**, trouvez la section **"REST API"** ou **"Redis URL"**
3. Copiez l'URL qui ressemble à :
   ```
   redis://default:VOTRE_PASSWORD@superb-sole-7762.upstash.io:6379
   ```
   ou
   ```
   redis://default:VOTRE_PASSWORD@redis-xxxxx.upstash.io:6379
   ```

### Étape 4 : Ajouter sur Render.com

1. Allez sur **https://dashboard.render.com**
2. Sélectionnez votre service **"yukpomnang"**
3. Cliquez sur l'onglet **"Environment"**
4. Cherchez la variable `REDIS_URL` :
   - Si elle existe : **Modifiez-la** avec la nouvelle URL
   - Si elle n'existe pas : Cliquez **"Add Environment Variable"** et ajoutez :
     - **Key** : `REDIS_URL`
     - **Value** : Collez l'URL Redis copiée
5. Cliquez sur **"Save Changes"**
6. Le service va redémarrer automatiquement

---

## 🎥 PARTIE 2 : Configuration LiveKit

### Option A : LiveKit Cloud (Recommandé - Gratuit jusqu'à 10GB/mois)

#### Étape 1 : Créer un compte LiveKit Cloud

1. Allez sur **https://cloud.livekit.io**
2. Cliquez sur **"Sign Up"** (utilisez GitHub/Google)
3. Connectez-vous

#### Étape 2 : Créer un projet

1. Dans le dashboard, cliquez sur **"Create Project"**
2. Remplissez :
   - **Project Name** : `yukpomnang-live`
   - **Region** : Sélectionnez la région la plus proche
3. Cliquez sur **"Create"**

#### Étape 3 : Récupérer les clés API

1. Dans votre projet, allez dans **"Settings"** > **"API Keys"**
2. Cliquez sur **"Create API Key"**
3. Remplissez :
   - **Name** : `yukpomnang-backend`
   - **Permissions** : Cochez toutes les permissions (ou au minimum : `room:create`, `room:list`, `room:delete`)
4. Cliquez sur **"Create"**
5. **IMPORTANT** : Copiez immédiatement :
   - **API Key** (commence par `API...`)
   - **API Secret** (longue chaîne de caractères)
   - ⚠️ **Vous ne pourrez plus voir le secret après !**

#### Étape 4 : Récupérer les URLs

Dans les **"Settings"** de votre projet, trouvez :
- **Server URL** : `https://votre-projet.livekit.cloud` (ou similaire)
- **WebSocket URL** : `wss://votre-projet.livekit.cloud` (ou similaire)

### Option B : LiveKit Self-Hosted (Avancé)

Si vous avez votre propre serveur LiveKit :

1. Assurez-vous que le serveur est accessible depuis Internet
2. Utilisez l'URL publique de votre serveur
3. Configurez les clés API dans votre serveur LiveKit

---

## 🔧 PARTIE 3 : Configuration sur Render.com

### Variables à ajouter/modifier

Allez sur **Render.com** > Votre service > **"Environment"** et ajoutez/modifiez :

#### Pour Redis :
```bash
REDIS_URL=redis://default:VOTRE_PASSWORD@votre-host.upstash.io:6379
```

#### Pour LiveKit :
```bash
LIVEKIT_API_URL=https://votre-projet.livekit.cloud
LIVEKIT_WS_URL=wss://votre-projet.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=votre_secret_long_ici
LIVEKIT_HLS_URL=https://votre-projet.livekit.cloud
```

### Format complet des variables LiveKit

| Variable | Description | Exemple |
|----------|-------------|---------|
| `LIVEKIT_API_URL` | URL de l'API LiveKit (HTTPS) | `https://yukpomnang-live.livekit.cloud` |
| `LIVEKIT_WS_URL` | URL WebSocket (WSS) | `wss://yukpomnang-live.livekit.cloud` |
| `LIVEKIT_API_KEY` | Clé API (commence par API) | `APIxxxxxxxxxxxxx` |
| `LIVEKIT_API_SECRET` | Secret API | `xxxxxxxxxxxxxxxxxxxxx` |
| `LIVEKIT_HLS_URL` | URL HLS pour streaming | `https://yukpomnang-live.livekit.cloud` |

---

## ✅ Vérification après configuration

### Après avoir ajouté les variables :

1. **Attendez le redémarrage** du service sur Render (2-3 minutes)
2. **Vérifiez les logs** sur Render.com > Logs
3. Vous devriez voir :
   ```
   ✅ Connexion Redis établie avec succès
   ✅ LiveKit disponible. Nettoyage automatique activé.
   ✅ LiveKit disponible. Synchronisation analytics activée.
   ```

### Si vous voyez encore des erreurs :

- **Redis** : Vérifiez que l'URL est correcte et que la base Upstash est active
- **LiveKit** : Vérifiez que toutes les variables sont correctes et que le projet LiveKit est actif

---

## 🆘 Dépannage

### Redis : "Name or service not known"
- Vérifiez que l'URL Redis est correcte
- Vérifiez que la base Upstash existe toujours
- Essayez de créer une nouvelle base Redis

### LiveKit : "Connexion refusée"
- Vérifiez que `LIVEKIT_API_URL` utilise `https://` (pas `http://`)
- Vérifiez que `LIVEKIT_WS_URL` utilise `wss://` (pas `ws://`)
- Vérifiez que les clés API sont correctes
- Vérifiez que le projet LiveKit est actif

---

## 📞 Support

Si vous avez des problèmes :
1. Vérifiez les logs sur Render.com
2. Vérifiez que toutes les variables sont correctement définies
3. Vérifiez que les services (Upstash/LiveKit) sont actifs

---

**🎉 Une fois configuré, Redis et LiveKit seront automatiquement connectés au prochain redémarrage !**

