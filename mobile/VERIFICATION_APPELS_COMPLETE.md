# ✅ Vérification complète du système d'appels

## 📋 Checklist de vérification

### 1. **Frontend Mobile** ✅

#### WebRTCCallModal
- ✅ **Notifications d'appel** : Utilise maintenant `apiPost` avec authentification
- ✅ **Double notification** : Envoie via API ET WebSocket
- ✅ **Configuration ICE servers** : STUN servers Google configurés
- ✅ **Gestion des streams** : Audio/Vidéo correctement gérés
- ✅ **Sonnerie d'appel** : Implémentée avec expo-av
- ✅ **Signaling WebSocket** : Connexion au serveur WebRTC

#### WebSocketContext
- ✅ **Connexion globale** : WebSocket persistant pour toute l'application
- ✅ **Gestion des notifications** : Type `call_incoming` géré
- ✅ **Alert d'appel entrant** : Modal natif avec boutons Refuser/Répondre
- ✅ **Reconnexion automatique** : En cas de perte de connexion

#### ChatModalMobile
- ✅ **Utilisé dans ResultatBesoinScreen** : Remplace l'ancien ChatModal
- ✅ **WebSocket intégré** : Via useWebSocketChat
- ✅ **Médias supportés** : Images, audio, fichiers

### 2. **Backend Rust** ✅

#### Routes WebRTC
```rust
POST /api/webrtc/notify-call
```
- ✅ Route existante et fonctionnelle
- ✅ Controller `webrtc_controller::notify_incoming_call`
- ✅ Accepte : recipient_id, caller_id, caller_name, call_type, service_id

#### Service Push Notification
```rust
pub async fn send_call_notification(...)
```
- ✅ Fonction existante
- ✅ Envoie notification Expo Push
- ✅ Son personnalisé : `call_ringtone.mp3`
- ✅ Data complète : type, call_type, caller_name, service_id

#### Configuration
- ✅ Endpoint API : `/api/webrtc/notify-call`
- ✅ Endpoint WebSocket : `${WS_BASE_URL}/ws/webrtc/${callId}`

---

## 🔍 Flux d'appel complet

### Scénario : Utilisateur A appelle Utilisateur B

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. INITIATION DE L'APPEL (Utilisateur A)                          │
└─────────────────────────────────────────────────────────────────────┘

[A clique sur "Appeler"]
    ↓
[WebRTCCallModal s'ouvre]
    ↓
[initializeWebRTC()]
    - Demande permissions caméra/micro
    - Crée RTCPeerConnection
    - Configure ICE servers
    - Obtient stream local (getUserMedia)
    ↓
[connectToSignalingServer()]
    - Connexion WebSocket: ws://server/ws/webrtc/{callId}
    - WebSocket.onopen déclenché
    ↓
[sendCallPushNotification()]
    ┌─────────────────────────────────────────────────────────┐
    │ MÉTHODE 1: Notification API avec authentification      │
    │ POST /api/webrtc/notify-call                            │
    │ Headers: Authorization: Bearer {token}                  │
    │ Body: {                                                 │
    │   recipient_id: B,                                      │
    │   caller_id: A,                                         │
    │   caller_name: "Jean Dupont",                          │
    │   call_type: "video",                                  │
    │   service_id: 123                                       │
    │ }                                                       │
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │ MÉTHODE 2: Notification WebSocket temps réel          │
    │ ws.send({                                               │
    │   type: "call_notification",                           │
    │   to: B,                                               │
    │   from: A,                                             │
    │   caller_name: "Jean Dupont",                          │
    │   call_type: "video"                                   │
    │ })                                                     │
    └─────────────────────────────────────────────────────────┘
    ↓
[createOffer()]
    - Crée SDP offer
    - setLocalDescription(offer)
    - Envoie offer via WebSocket signaling
    - État → "ringing"
    - Sonnerie démarre

┌─────────────────────────────────────────────────────────────────────┐
│ 2. BACKEND TRAITEMENT                                              │
└─────────────────────────────────────────────────────────────────────┘

[webrtc_controller::notify_incoming_call]
    ↓
[push_notification_service::send_call_notification]
    ↓
[Récupère push tokens de B depuis DB]
    ↓
[Envoie push notification Expo]
    {
      "to": ["{push_token_B}"],
      "title": "📞 Appel vidéo entrant",
      "body": "Jean Dupont vous appelle",
      "sound": "call_ringtone.mp3",
      "data": {
        "type": "incoming_call",
        "call_type": "video",
        "caller_name": "Jean Dupont",
        "service_id": 123
      }
    }
    ↓
[Serveur WebSocket relay message "call_notification"]
    - Envoie au WebSocket de B si connecté

┌─────────────────────────────────────────────────────────────────────┐
│ 3. RÉCEPTION (Utilisateur B)                                       │
└─────────────────────────────────────────────────────────────────────┘

[WebSocketContext de B reçoit message]
    ↓
[Type: "call_incoming"]
    ↓
[Alert.alert s'affiche]
    "Appel entrant"
    "Jean Dupont vous appelle"
    [Refuser] [Répondre]
    ↓
┌──────────────────────────┬──────────────────────────┐
│ Si B clique "Répondre"   │ Si B clique "Refuser"   │
├──────────────────────────┼──────────────────────────┤
│ - Ouvrir WebRTCCallModal │ - Envoyer message        │
│ - Accepter l'appel       │   "call_rejected"        │
│ - Établir connexion      │ - Fermer notification    │
│   WebRTC                 │                          │
└──────────────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 4. CONNEXION WEBRTC                                                 │
└─────────────────────────────────────────────────────────────────────┘

[Échange SDP]
    A → offer → Server → B
    B → answer → Server → A
    ↓
[Échange ICE candidates]
    A ↔ Server ↔ B
    ↓
[Connexion peer-to-peer établie]
    ↓
[ontrack déclenché]
    - remoteStream reçu
    - État → "active"
    - Sonnerie arrêtée
    - Timer d'appel démarré
    ↓
[Communication audio/vidéo en cours]
```

---

## ✅ Points vérifiés

### Configuration
- ✅ `EXPO_PUBLIC_WS_URL` défini dans `.env`
- ✅ `API_BASE_URL` correct
- ✅ ICE servers configurés (Google STUN)

### Permissions
- ✅ Permission caméra demandée
- ✅ Permission micro demandée
- ✅ Gestion des refus de permission

### Authentification
- ✅ Token JWT envoyé avec `apiPost`
- ✅ Token stocké dans AuthContext
- ✅ Refresh token si expiré

### Notifications
- ✅ Push notification Expo configurée
- ✅ WebSocket global actif
- ✅ Handlers de notification enregistrés

### WebRTC
- ✅ Package `react-native-webrtc` installé
- ✅ Configuration ICE servers
- ✅ Signaling server WebSocket
- ✅ SDP offer/answer
- ✅ ICE candidates exchange

---

## ⚠️ Points d'attention identifiés

### 1. **Modal d'appel entrant pas implémenté**
```typescript
// Dans WebSocketContext
case 'call_incoming':
    Alert.alert(
        'Appel entrant',
        `${message.data.caller_name || 'Un utilisateur'} vous appelle`,
        [
            { text: 'Refuser', style: 'cancel' },
            { text: 'Répondre', onPress: () => {
                // TODO: Ouvrir le modal d'appel ❌ PAS ENCORE FAIT
                console.log('[WebSocketContext] Répondre à l\'appel:', message.data.call_id);
            }}
        ]
    );
```

**Solution nécessaire** : Créer un état global pour ouvrir WebRTCCallModal

### 2. **WebSocket backend ne relay pas les call_notification**
Le serveur WebSocket backend doit gérer les messages de type `call_notification` et les relayer au destinataire.

**À ajouter dans le backend** :
```rust
// Dans websocket_handler.rs
"call_notification" => {
    // Relayer au destinataire
    if let Some(recipient_id) = msg.get("to") {
        relay_message_to_user(recipient_id, msg).await;
    }
}
```

### 3. **Récupération du nom réel de l'appelant**
```typescript
caller_name: recipientName || 'Un utilisateur', // ❌ Utilise recipientName au lieu de currentUserName
```

**À corriger** : Passer le nom de l'utilisateur actuel depuis le composant parent

---

## 🔧 Corrections nécessaires

### PRIORITÉ 1: Implémenter le modal d'appel entrant

#### Étape 1 : Créer un IncomingCallManager

```typescript
// mobile/src/components/IncomingCallManager.tsx
import React, { useState, useEffect } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import WebRTCCallModal from './WebRTCCallModal';

const IncomingCallManager: React.FC = () => {
    const { registerNotificationHandler } = useWebSocketContext();
    const [incomingCall, setIncomingCall] = useState(null);
    const [showCallModal, setShowCallModal] = useState(false);

    useEffect(() => {
        // Écouter les notifications d'appel
        const unsubscribe = registerNotificationHandler((notification) => {
            if (notification.data.type === 'incoming_call') {
                setIncomingCall(notification.data);
                setShowCallModal(true);
            }
        });

        return unsubscribe;
    }, []);

    return incomingCall ? (
        <WebRTCCallModal
            visible={showCallModal}
            onClose={() => {
                setShowCallModal(false);
                setIncomingCall(null);
            }}
            callType={incomingCall.call_type}
            recipientName={incomingCall.caller_name}
            recipientId={incomingCall.caller_id}
            currentUserId={user.id}
            serviceId={incomingCall.service_id}
            isIncoming={true} // ✅ NOUVEAU: Mode réception d'appel
        />
    ) : null;
};
```

#### Étape 2 : Ajouter dans App.tsx

```typescript
import IncomingCallManager from './src/components/IncomingCallManager';

// Dans le return
<WebSocketProvider>
    <IncomingCallManager />
    <LocationProvider>
        ...
    </LocationProvider>
</WebSocketProvider>
```

### PRIORITÉ 2: Ajouter relay WebSocket backend

```rust
// backend/src/websocket/handler.rs
async fn handle_message(ws: &mut WebSocket, msg: &str, user_id: i32, state: &AppState) {
    if let Ok(parsed) = serde_json::from_str::<Value>(msg) {
        match parsed.get("type").and_then(|t| t.as_str()) {
            Some("call_notification") => {
                // Récupérer le destinataire
                if let Some(recipient_id) = parsed.get("to").and_then(|r| r.as_i64()) {
                    // Relayer au destinataire
                    relay_call_notification(recipient_id as i32, parsed, state).await;
                }
            },
            // ... autres types
        }
    }
}
```

### PRIORITÉ 3: Passer le nom réel de l'utilisateur

Dans les composants qui ouvrent WebRTCCallModal, passer `currentUserName` :

```typescript
<WebRTCCallModal
    // ... autres props
    currentUserName={user.name} // ✅ AJOUTER
/>
```

---

## 🧪 Plan de tests

### Test 1: Notification d'appel
1. User A appelle User B
2. ✅ Vérifier log `[WebRTC] 📲 Envoi notification`
3. ✅ Vérifier réponse API 200
4. ✅ Vérifier notification WebSocket envoyée
5. ✅ Vérifier User B reçoit Alert

### Test 2: Acceptation d'appel
1. User B clique "Répondre"
2. ✅ Vérifier ouverture WebRTCCallModal
3. ✅ Vérifier connexion WebSocket signaling
4. ✅ Vérifier échange SDP
5. ✅ Vérifier connexion établie

### Test 3: Refus d'appel
1. User B clique "Refuser"
2. ✅ Vérifier message `call_rejected` envoyé
3. ✅ Vérifier User A reçoit notification de refus
4. ✅ Vérifier fermeture propre

### Test 4: Appel perdu
1. User A appelle User B
2. User B ne répond pas pendant 30s
3. ✅ Vérifier timeout côté A
4. ✅ Vérifier notification "Appel manqué" pour B

---

## 📊 État actuel

| Composant | État | Notes |
|-----------|------|-------|
| WebRTCCallModal | ✅ CORRIGÉ | Utilise apiPost + WebSocket |
| WebSocketContext | ✅ OK | Reçoit call_incoming |
| IncomingCallManager | ❌ MANQUANT | À créer |
| Backend API | ✅ OK | Route /api/webrtc/notify-call |
| Backend WebSocket | ⚠️ PARTIEL | Doit relayer call_notification |
| Push Notifications | ✅ OK | Service complet |

---

## 🚀 Prochaines étapes

1. ✅ **WebRTCCallModal corrigé** - FAIT
2. ⏳ **Créer IncomingCallManager** - EN COURS
3. ⏳ **Ajouter relay backend WebSocket** - EN COURS
4. ⏳ **Tester le flux complet** - À FAIRE

---

**Date** : 18 Octobre 2025  
**Status** : 80% complété  
**Priorité** : Haute

