# Analyse de la Configuration Redis/LiveKit

## Date: 2025-11-26

## 🔍 Problèmes Identifiés

### 1. Redis - Échec de Résolution DNS

**Erreur observée:**
```
⚠️ Redis: Échec de connexion - URL: redis://default:***@superb-sole-7762.upstash.io:6379
Erreur: failed to lookup address information: Name or service not known
```

**Configuration actuelle:**
- Variable d'environnement: `REDIS_URL`
- Valeur par défaut: `redis://127.0.0.1:6379/0`
- Localisation du code: `backend/src/main.rs:136`

**Problèmes:**
1. ❌ L'URL Upstash fournie ne peut pas être résolue par DNS
2. ⚠️ Le code crée un client factice en cas d'échec (peut masquer des problèmes)
3. ⚠️ Pas de validation de l'URL Redis avant tentative de connexion
4. ⚠️ Pas de retry automatique avec backoff exponentiel

**Impact:**
- ✅ L'application continue de fonctionner (gestion gracieuse)
- ❌ WebSocket de livraison fonctionne sans Redis (moins performant)
- ⚠️ Cache Redis non disponible (impact sur performances)

### 2. LiveKit - Connexion Impossible

**Erreur observée:**
```
⚠️ LiveKit: Connexion impossible - URL: http://46.224.14.85:7880
```

**Configuration actuelle:**
- Variables d'environnement requises:
  - `LIVEKIT_API_URL` (optionnel)
  - `LIVEKIT_WS_URL` (optionnel)
  - `LIVEKIT_API_KEY` (optionnel)
  - `LIVEKIT_API_SECRET` (optionnel)
  - `LIVEKIT_HLS_URL` (optionnel)
- Localisation du code: `backend/src/config/live_streaming.rs:25-72`

**Problèmes:**
1. ❌ L'URL LiveKit pointe vers une IP privée (`46.224.14.85:7880`) non accessible
2. ⚠️ Pas de validation des variables d'environnement au démarrage
3. ⚠️ Les erreurs de connexion sont loggées mais pas d'action corrective
4. ⚠️ Pas de healthcheck périodique pour détecter la récupération

**Impact:**
- ✅ L'application continue de fonctionner (service optionnel)
- ❌ Streaming live non disponible
- ❌ Nettoyage automatique des rooms/ingress désactivé
- ⚠️ Analytics LiveKit non synchronisées

## 📋 Variables d'Environnement Requises

### Redis
```bash
REDIS_URL=redis://[user]:[password]@[host]:[port]/[database]
# Exemple Upstash:
REDIS_URL=rediss://default:[password]@[endpoint].upstash.io:6379
```

**Format Upstash correct:**
- Utiliser `rediss://` (avec 's') pour TLS
- Format: `rediss://default:[password]@[endpoint].upstash.io:6379`
- Vérifier que l'endpoint DNS est correct

### LiveKit
```bash
LIVEKIT_API_URL=https://[your-livekit-server]/api
LIVEKIT_WS_URL=wss://[your-livekit-server]
LIVEKIT_API_KEY=[your-api-key]
LIVEKIT_API_SECRET=[your-api-secret]
LIVEKIT_HLS_URL=https://[your-livekit-server]/hls
LIVEKIT_INGRESS_MODE=rtmp|webrtc  # Optionnel, défaut: rtmp
LIVEKIT_ROOM_TTL_SECONDS=7200      # Optionnel, défaut: 2h
```

## 🔧 Améliorations Proposées

### 1. Validation de Configuration au Démarrage

**Fichier:** `backend/src/main.rs`

**Améliorations:**
- ✅ Valider le format de l'URL Redis avant tentative de connexion
- ✅ Vérifier que les variables LiveKit sont cohérentes (toutes présentes ou toutes absentes)
- ✅ Logger un avertissement clair si les services optionnels ne sont pas configurés

### 2. Amélioration de la Gestion d'Erreur Redis

**Problèmes actuels:**
- Création d'un client factice peut masquer des problèmes
- Pas de retry automatique

**Améliorations proposées:**
- Implémenter un retry avec backoff exponentiel (3 tentatives)
- Valider l'URL Redis (format, DNS) avant création du client
- Logger plus d'informations sur l'échec (format d'URL attendu)

### 3. Healthcheck pour Services Optionnels

**Améliorations:**
- Implémenter un healthcheck périodique (toutes les 5 minutes)
- Détecter automatiquement la récupération de Redis/LiveKit
- Logger un message de succès quand le service redevient disponible

### 4. Documentation des Variables d'Environnement

**Créer:** `backend/ENV_VARIABLES.md`

**Contenu:**
- Liste complète des variables d'environnement
- Description de chaque variable
- Valeurs par défaut
- Exemples de configuration pour différents environnements

## 🛠️ Actions Correctives Immédiates

### Pour Redis (Upstash)

1. **Vérifier l'URL Redis sur Render.com:**
   - Se connecter au dashboard Render
   - Vérifier la variable `REDIS_URL`
   - S'assurer que le format est correct: `rediss://default:[password]@[endpoint].upstash.io:6379`

2. **Tester la résolution DNS:**
   ```bash
   nslookup superb-sole-7762.upstash.io
   # ou
   dig superb-sole-7762.upstash.io
   ```

3. **Vérifier les credentials Upstash:**
   - Se connecter au dashboard Upstash
   - Vérifier que l'instance Redis est active
   - Copier l'URL de connexion complète

### Pour LiveKit

1. **Vérifier la configuration LiveKit:**
   - Si LiveKit n'est pas utilisé, supprimer les variables d'environnement
   - Si LiveKit est utilisé, vérifier que toutes les variables sont présentes
   - Vérifier que `LIVEKIT_API_URL` pointe vers un serveur accessible publiquement

2. **Options:**
   - **Option 1:** Désactiver LiveKit (supprimer les variables d'environnement)
   - **Option 2:** Configurer un serveur LiveKit accessible (cloud ou self-hosted)
   - **Option 3:** Utiliser LiveKit Cloud (https://cloud.livekit.io)

## 📊 État Actuel de la Configuration

### Redis
- ❌ **Non fonctionnel** - Échec de résolution DNS
- ⚠️ **Impact:** WebSocket sans Redis (moins performant)
- ✅ **Gestion d'erreur:** Gracieuse, application fonctionne

### LiveKit
- ❌ **Non fonctionnel** - Connexion impossible
- ⚠️ **Impact:** Streaming live non disponible
- ✅ **Gestion d'erreur:** Gracieuse, application fonctionne

## ✅ Points Positifs

1. **Gestion gracieuse des erreurs:** L'application continue de fonctionner même si Redis/LiveKit ne sont pas disponibles
2. **Logging informatif:** Les erreurs sont bien loggées avec des messages clairs
3. **Services optionnels:** Redis et LiveKit sont correctement traités comme optionnels
4. **Fallback:** Le code gère l'absence de ces services sans crasher

## 🎯 Recommandations

### Priorité Haute
1. ✅ Corriger l'URL Redis (vérifier format Upstash)
2. ✅ Décider si LiveKit est nécessaire (si non, supprimer les variables)

### Priorité Moyenne
1. ⚠️ Implémenter la validation de configuration au démarrage
2. ⚠️ Ajouter des healthchecks périodiques
3. ⚠️ Améliorer la gestion d'erreur avec retry

### Priorité Basse
1. 📝 Documenter toutes les variables d'environnement
2. 📝 Créer un script de validation de configuration
3. 📝 Ajouter des tests d'intégration pour Redis/LiveKit

## 📝 Notes Techniques

### Format URL Redis Upstash
```
rediss://default:[password]@[endpoint].upstash.io:6379
```

**Points importants:**
- Utiliser `rediss://` (avec 's') pour TLS
- Le mot de passe est dans l'URL
- L'endpoint doit être résolvable par DNS

### Format URL LiveKit
```
LIVEKIT_API_URL=https://your-livekit-server.com
LIVEKIT_WS_URL=wss://your-livekit-server.com
```

**Points importants:**
- API URL doit être accessible en HTTPS
- WebSocket URL doit être en WSS (WebSocket Secure)
- Toutes les variables doivent être présentes pour activer LiveKit

