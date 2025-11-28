# Analyse Redis et LiveKit - Problèmes Identifiés

## Date
2025-11-27

---

## 1. PROBLÈME REDIS - TLS Non Fonctionnel ❌

### Problème Identifié
L'erreur indique : `can't connect with TLS, the feature is not enabled`

### Analyse
- ✅ L'URL Redis utilise déjà `rediss://` (avec double 's')
- ✅ La feature `native-tls` est activée dans `Cargo.toml`
- ❌ **Le problème** : Le client Redis `redis` avec `native-tls` peut avoir des problèmes de compatibilité

### Solution Proposée
**Option 1 : Utiliser `rustls` au lieu de `native-tls`** (Recommandé)
- `rustls` est plus moderne et mieux maintenu
- Meilleure compatibilité avec les services cloud

**Option 2 : Vérifier la configuration TLS du client**
- Le client Redis peut nécessiter une configuration TLS explicite

---

## 2. PROBLÈME LIVEKIT - Connexion Impossible ❌

### Variables d'Environnement Fournies
```
LIVEKIT_API_URL=http://46.224.14.85:7880
LIVEKIT_WS_URL=ws://46.224.14.85:7880
LIVEKIT_API_KEY=APIPHE9xDv5RPaP
LIVEKIT_API_SECRET=qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
LIVEKIT_HLS_URL=http://46.224.14.85:8080/live
LIVEKIT_INGRESS_MODE=rtmp
LIVEKIT_INGRESS_REGION=eu-central
LIVEKIT_INGRESS_NAME=prod-ingress-1
LIVEKIT_INGRESS_ROOM=live-events
```

### Problèmes Identifiés

#### 1. **Connexion Refusée** (Connection Refused)
- Le serveur LiveKit à `46.224.14.85:7880` n'est pas accessible depuis Render
- **Causes possibles** :
  - Serveur LiveKit non démarré
  - Firewall bloquant les connexions depuis Render
  - IP/Port incorrects
  - Serveur LiveKit sur un réseau privé non accessible depuis Internet

#### 2. **URL HTTP vs HTTPS**
- L'URL utilise `http://` (non sécurisé)
- Certains services cloud bloquent HTTP non sécurisé
- **Recommandation** : Utiliser `https://` si disponible

#### 3. **Timeout de Connexion**
- Le code fait 3 tentatives avec backoff exponentiel (2s, 4s, 8s)
- Toutes les tentatives échouent
- **Cause** : Le serveur n'est pas accessible

### Solutions Proposées

#### Solution 1 : Vérifier l'Accessibilité du Serveur
```bash
# Depuis Render, tester la connexion
curl -v http://46.224.14.85:7880/twirp/livekit.RoomService/ListRooms
```

#### Solution 2 : Utiliser HTTPS si Disponible
- Si le serveur LiveKit supporte HTTPS, utiliser `https://` au lieu de `http://`

#### Solution 3 : Vérifier le Firewall
- S'assurer que le port 7880 est ouvert depuis Render
- Vérifier les règles de firewall du serveur LiveKit

#### Solution 4 : Vérifier que le Serveur LiveKit est Démarré
- Se connecter au serveur et vérifier que LiveKit est en cours d'exécution
- Vérifier les logs du serveur LiveKit

#### Solution 5 : Améliorer les Messages d'Erreur
- Ajouter plus de détails dans les logs pour diagnostiquer le problème
- Logger l'erreur exacte de connexion

---

## 🔧 CORRECTIONS À APPLIQUER

### 1. Redis - Passer à `rustls` ✅

**Fichier :** `backend/Cargo.toml`

**Changement :**
```toml
# Avant
redis = { version = "0.26", features = ["tokio-comp", "aio", "native-tls"] }

# Après
redis = { version = "0.26", features = ["tokio-comp", "aio", "rustls-tls"] }
```

**Raison :** `rustls` est plus moderne et mieux maintenu que `native-tls`

---

### 2. LiveKit - Améliorer les Messages d'Erreur ✅

**Fichiers :** 
- `backend/src/tasks/livekit_cleanup.rs`
- `backend/src/tasks/live_analytics.rs`

**Changements :**
- Logger l'erreur exacte de connexion
- Ajouter des suggestions de diagnostic
- Vérifier si le serveur répond (ping/health check)

---

### 3. LiveKit - Ajouter un Health Check ✅

**Fichier :** `backend/src/tasks/livekit_cleanup.rs`

**Ajout :** Fonction pour vérifier si le serveur LiveKit est accessible avant d'essayer de l'utiliser

---

## 📊 RÉSUMÉ

### Redis
- **Problème** : TLS non fonctionnel malgré `rediss://` et `native-tls`
- **Solution** : Passer à `rustls-tls` au lieu de `native-tls`
- **Impact** : Connexion Redis fonctionnelle

### LiveKit
- **Problème** : Connexion refusée au serveur `46.224.14.85:7880`
- **Causes possibles** :
  1. Serveur non démarré
  2. Firewall bloquant
  3. IP/Port incorrects
  4. Réseau privé non accessible
- **Solutions** :
  1. Vérifier l'accessibilité du serveur
  2. Utiliser HTTPS si disponible
  3. Vérifier le firewall
  4. Améliorer les messages d'erreur
- **Impact** : Service optionnel, non bloquant pour le démarrage

---

**Date de création :** 2025-11-27  
**Dernière mise à jour :** 2025-11-27

