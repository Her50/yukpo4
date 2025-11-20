# 🔔 Sons de notification pour l'application

## Fichiers optionnels

Vous pouvez ajouter des fichiers audio locaux pour améliorer l'expérience utilisateur. Si les fichiers ne sont pas présents, l'application utilise des sons en ligne comme fallback.

### Fichiers recommandés :

1. **`order_notification.mp3`** ou **`order_notification.wav`**
   - Usage : Notification pour nouvelle commande
   - Format : MP3 ou WAV
   - Durée recommandée : 1-2 secondes
   - Volume : Normalisé

2. **`courier_assigned.mp3`** ou **`courier_assigned.wav`**
   - Usage : Notification pour coursier assigné
   - Format : MP3 ou WAV
   - Durée recommandée : 1-2 secondes
   - Volume : Normalisé

3. **`order_ready.mp3`** ou **`order_ready.wav`**
   - Usage : Notification pour commande prête
   - Format : MP3 ou WAV
   - Durée recommandée : 1-2 secondes
   - Volume : Normalisé

## Où trouver des sons gratuits ?

### Sources recommandées :
1. **Freesound** : https://freesound.org/
   - Recherchez : "notification", "alert", "beep", "chime"
   - Filtrez par licence CC0 (domaine public)

2. **Pixabay** : https://pixabay.com/sound-effects/
   - Recherchez : "notification", "alert", "beep"
   - Tous les sons sont gratuits et libres d'utilisation

3. **Notification Sounds** : https://notificationsounds.com/
   - Collection de sons de notification
   - Téléchargement gratuit

4. **Google Actions Sounds** (déjà utilisé comme fallback) :
   - https://actions.google.com/sounds/
   - Sons de haute qualité, gratuits

## Comment ajouter des sons locaux

1. **Téléchargez** un fichier audio (MP3 ou WAV)
2. **Renommez-le** selon le type :
   - `order_notification.mp3` pour nouvelles commandes
   - `courier_assigned.mp3` pour coursier assigné
   - `order_ready.mp3` pour commande prête
3. **Placez-le** dans ce dossier (`mobile/src/assets/sounds/`)
4. **Modifiez** `notificationSoundService.ts` pour utiliser les fichiers locaux :

```typescript
// Dans loadSound(), remplacer les URLs par :
case 'order':
  try {
    soundSource = require('../../assets/sounds/order_notification.mp3');
  } catch {
    soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' };
  }
  break;
```

5. **Rebuild** l'application

## Fallback actuel

Si aucun fichier local n'est trouvé, le service utilise automatiquement des sons en ligne de Google Actions :
- **order** : `digital_watch_alarm_long.ogg`
- **courier** : `beep_short.ogg`
- **ready** : `beep_short.ogg`

⚠️ **Note** : Les sons en ligne nécessitent une connexion internet.

## Test

Pour tester les notifications sonores :
1. Ouvrez l'écran `ProviderOrderManagementScreen`
2. Attendez une nouvelle commande ou simulez-en une
3. Le son devrait se jouer automatiquement

## Configuration

Le volume est configuré à **0.7** (70%) par défaut dans `notificationSoundService.ts`. Vous pouvez l'ajuster selon vos préférences.

## Notes techniques

- Les sons sont préchargés au premier appel pour une lecture plus rapide
- Le service gère automatiquement le nettoyage des ressources
- Compatible avec le mode silencieux iOS (si configuré)
- Les sons ne se répètent pas (isLooping: false)

