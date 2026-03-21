# 🔔 Fichiers audio pour les notifications

## 📋 Usage des fichiers audio

Les fichiers dans ce dossier sont utilisés pour :
- **Sonneries d'appel WebRTC** (ringtone.mp3)
- **Notifications système** (delivery_alert.mp3)
- **Alertes livraison** (sons courts)

## 🗣️ Message de bienvenue - TTS (Text-to-Speech)

**Important** : Le message de bienvenue n'utilise AUCUN fichier audio !
- Il est généré par **TTS (Text-to-Speech)** d'Expo
- Message court dans la langue de l'utilisateur
- Aucun fichier audio requis pour la bienvenue

## Fichiers requis

### `ringtone.mp3` (optionnel)
- **Usage** : Sonnerie pour les appels WebRTC (audio et vidéo)
- **Format** : MP3
- **Durée recommandée** : 5-10 secondes (en boucle)
- **Volume** : Normalisé (le code ajuste automatiquement)

### `delivery_alert.mp3` (optionnel)
- **Usage** : Notifications de livraison et commandes
- **Format** : MP3
- **Durée recommandée** : 1-2 secondes
- **Volume** : Normalisé

## Où trouver des sons gratuits ?

### Sources recommandées :
1. **Zedge** : https://www.zedge.net/ringtones
2. **Freesound** : https://freesound.org/
3. **Notification Sounds** : https://notificationsounds.com/

## Fallback

Si les fichiers locaux manquent, l'application utilise des URLs en ligne :
- Ringtone : https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg
- Notification : https://actions.google.com/sounds/v1/notifications/notification_simple.ogg
- ⚠️ Nécessite une connexion internet

## Comment ajouter des sons

1. Téléchargez des fichiers audio MP3
2. Placez-les dans ce dossier (`mobile/src/assets/sounds/`)
3. Rebuild l'application

## Test

Pour tester les sons :
1. Déclenchez une notification de livraison
2. Lancez un appel WebRTC
3. Les sons devraient jouer automatiquement avec le bon volume

## Notes techniques

- Les sons fonctionnent même si le téléphone est en mode silencieux
- Le volume est ajusté automatiquement selon le type de notification
- Le TTS de bienvenue est optimisé pour un démarrage instantané

