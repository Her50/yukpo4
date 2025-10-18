# Configuration Backend Yukpomnang - Échanges et Notifications

## ✅ Routes HTTP activées

### Chat et Messagerie
- ✅ `POST /api/services/{id}/message` - Envoyer un message texte
- ✅ `POST /api/services/{id}/audio` - Envoyer un message audio
- ✅ `GET /api/services/{id}/interactions` - Récupérer l'historique des messages
- ✅ `POST /api/chat/notify-message` - Envoyer notification push pour message

### Appels WebRTC
- ✅ `POST /api/webrtc/notify-call` - Envoyer notification push d'appel entrant
- ✅ WebSocket `/ws/webrtc/{room_id}` - Signaling WebRTC (déjà configuré)

### Notifications
- ✅ `GET /api/notifications/user/{user_id}` - Récupérer les notifications
- ✅ `GET /api/notifications/user/{user_id}/unread-count` - Compter non lues
- ✅ `PATCH /api/notifications/{id}/read` - Marquer comme lue
- ✅ `PATCH /api/notifications/user/{user_id}/mark-all-read` - Tout marquer comme lu

### Push Notifications
- ✅ `POST /api/push/register` - Enregistrer un token push Expo
- ✅ `PATCH /api/push/deactivate` - Désactiver un token
- ✅ `POST /api/push/send` - Envoyer une push (admin/test)

### Utilisateur et Historiques
- ✅ `GET /api/users/balance` - Récupérer le solde
- ✅ `GET /api/users/consumption-history` - Historique de consommation
- ✅ `GET /api/users/payment-history` - Historique des paiements
- ✅ `GET /api/user/conversations` - Liste des conversations (structure créée)

## 📁 Tables PostgreSQL

### ✅ Tables existantes
- `user_push_tokens` - Tokens push Expo pour chaque appareil
- `notifications` - Notifications utilisateur
- `token_consumption_logs` - Historique des consommations
- `purchase_history` - Historique des paiements
- `services` - Services créés
- `alerts` - Alertes prestataires

### 📡 Données stockées dans MongoDB
- Interactions (messages, appels, reviews)
- Historique détaillé des échanges
- Métadonnées des conversations

## 🔧 Services configurés

### ✅ Push Notification Service
- Intégration Expo Push Notifications API
- Envoi multi-token (tous les appareils de l'utilisateur)
- Son personnalisé par type de notification
- Retry automatique en cas d'échec

### ✅ Notification Service
- Création de notifications en base
- Types : NewMessage, IncomingCall, ServiceActivated, etc.
- Comptage des non-lues
- Marquage comme lu

### ✅ WebRTC Controller
- Notifications d'appels entrants
- Support audio et vidéo
- Integration avec push notifications

### ✅ Chat Controller
- Notifications de nouveaux messages
- Aperçu du message dans la notification
- Création automatique de notification en base

## 🔄 Flux de messagerie

### Envoi de message
1. Client → `POST /api/services/{id}/message` (texte)
2. Backend sauvegarde dans MongoDB
3. Backend crée une alerte pour le prestataire
4. Backend envoie notification push via Expo API
5. Prestataire reçoit la notification

### Réception de messages
1. Client/Prestataire → `GET /api/services/{id}/interactions`
2. Backend retourne tous les messages/interactions depuis MongoDB
3. Client affiche les messages triés par date

### Appels audio/vidéo
1. Émetteur → `POST /api/webrtc/notify-call`
2. Backend envoie push notification au destinataire
3. Destinataire reçoit notification avec sonnerie
4. WebSocket WebRTC gère la signalisation
5. Connexion peer-to-peer établie

## ⚙️ Configuration requise

### Variables d'environnement
```bash
DATABASE_URL=postgresql://...
MONGO_URI=mongodb://...
JWT_SECRET=...
```

### Services externes
- ✅ PostgreSQL (données utilisateurs, services)
- ✅ MongoDB (interactions, historique)
- ✅ Expo Push Notifications API
- ✅ WebSocket pour WebRTC signaling

## 🧪 Test des endpoints

### Tester la messagerie
```bash
# Envoyer un message
curl -X POST https://yukpomnang.onrender.com/api/services/123/message \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello!"}'

# Récupérer les messages
curl https://yukpomnang.onrender.com/api/services/123/interactions \
  -H "Authorization: Bearer TOKEN"
```

### Tester les notifications
```bash
# Compter non lues
curl https://yukpomnang.onrender.com/api/notifications/user/123/unread-count \
  -H "Authorization: Bearer TOKEN"

# Récupérer toutes
curl https://yukpomnang.onrender.com/api/notifications/user/123 \
  -H "Authorization: Bearer TOKEN"
```

### Tester push notification
```bash
# Enregistrer un token
curl -X POST https://yukpomnang.onrender.com/api/push/register \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"push_token":"ExponentPushToken[xxx]","device_type":"android"}'
```

## ⚠️ Notes importantes

1. **MongoDB requis** : Les interactions (messages, calls) sont stockées dans MongoDB
2. **Expo Push Tokens** : Les utilisateurs doivent s'enregistrer au premier lancement
3. **WebSocket** : Le serveur WebRTC doit être démarré pour les appels
4. **Sonneries** : Les sons custom doivent être hébergés ou inclus dans l'app

## 🚀 Prochaines étapes

1. Déployer le backend avec les nouvelles routes
2. Tester l'enregistrement des push tokens
3. Vérifier que MongoDB est accessible
4. Tester l'envoi de messages et notifications
5. Tester les appels WebRTC avec sonneries

