# Configuration WebRTC pour les appels vidéo/audio

## Installation

Pour activer les appels vidéo/audio en temps réel dans le chat, suivez ces étapes :

### 1. Installer le package WebRTC

```bash
cd mobile
npx expo install react-native-webrtc
```

### 2. Configurer app.json

Ajoutez les permissions nécessaires dans `app.json` :

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-webrtc",
        {
          "cameraPermission": "L'application a besoin d'accéder à votre caméra pour les appels vidéo.",
          "microphonePermission": "L'application a besoin d'accéder à votre microphone pour les appels audio."
        }
      ]
    ],
    "android": {
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "L'application a besoin d'accéder à votre caméra pour les appels vidéo.",
        "NSMicrophoneUsageDescription": "L'application a besoin d'accéder à votre microphone pour les appels audio."
      }
    }
  }
}
```

### 3. Activer WebRTC dans InAppCallModal

Dans `mobile/src/components/InAppCallModal.tsx`, décommentez les sections WebRTC marquées par `// WEBRTC:` et remplacez le composant par `WebRTCCallModal.tsx`.

### 4. Configurer le serveur de signaling

Le serveur de signaling WebRTC doit être configuré dans le backend :

- **Endpoint WebSocket**: `wss://yukpomnang.onrender.com/ws/webrtc`
- **Format des messages**: JSON avec type `offer`, `answer`, `ice-candidate`

### 5. Rebuild l'application

Après l'installation, vous devez rebuilder l'application :

```bash
# Pour Android
npx eas build --platform android --profile preview

# Pour iOS
npx eas build --platform ios --profile preview
```

## Architecture WebRTC

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client A  │────────>│   Signaling  │<────────│   Client B  │
│  (Mobile)   │ WebSocket│    Server    │WebSocket│  (Mobile)   │
└─────────────┘         └──────────────┘         └─────────────┘
      │                                                   │
      │                                                   │
      └───────────────────────────────────────────────────┘
                      P2P WebRTC Connection
                    (Audio/Video Streaming)
```

## Composants

- **WebRTCCallModal**: Composant principal pour les appels vidéo/audio
- **useWebRTC**: Hook personnalisé pour gérer la connexion WebRTC
- **SignalingService**: Service pour gérer les messages de signaling

## Fonctionnalités

- ✅ Appels audio HD
- ✅ Appels vidéo HD (720p/1080p)
- ✅ Basculement caméra avant/arrière
- ✅ Mute/Unmute microphone
- ✅ Speaker on/off
- ✅ Affichage de la durée d'appel
- ✅ Gestion des connexions perdues
- ✅ Reconnexion automatique

## Dépannage

### Problème: "No peer connection"
- Vérifiez que le serveur de signaling est en ligne
- Vérifiez les permissions caméra/microphone

### Problème: "ICE connection failed"
- Vérifiez la configuration STUN/TURN servers
- Vérifiez le réseau (NAT traversal)

### Problème: "Permission denied"
- Demandez les permissions dans l'app settings
- Vérifiez app.json configuration

## Configuration STUN/TURN

Pour une meilleure compatibilité réseau, configurez des serveurs STUN/TURN :

```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN server (à configurer)
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'user',
    credential: 'pass'
  }
];
```



