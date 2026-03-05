# Instructions pour les fichiers audio de notification

## Fichiers requis pour une UX optimale

Pour compléter l'amélioration du service de notifications sonores, créez les fichiers suivants dans `mobile/assets/sounds/` :

### 1. order_notification.mp3
- **Usage**: Notification de nouvelle commande pour les prestataires
- **Style**: Son doux mais distinctif, type "ding-dong"
- **Durée**: 2-3 secondes
- **Volume**: Moyen

### 2. delivery_request.mp3  
- **Usage**: Notification de demande de livraison pour les coursiers
- **Style**: Son urgent mais pas stressant, type "alerte douce"
- **Durée**: 2-3 secondes
- **Volume**: Élevé (les coursiers peuvent être en déplacement)

### 3. courier_alert.mp3
- **Usage**: Alertes spécifiques coursier (acceptation, pickup proche, etc.)
- **Style**: Son court et percutant, type "beep double"
- **Durée**: 1-2 secondes
- **Volume**: Élevé

### 4. ready_notification.mp3
- **Usage**: Notification "prêt" (commande prête, livraison prête)
- **Style**: Son positif et encourageant, type "chime"
- **Durée**: 2 secondes
- **Volume**: Moyen

### 5. delivery_alert.mp3 (existe déjà)
- **Usage**: Notification générale de livraison
- **Style**: Son standard de notification
- **Durée**: 2-3 secondes

## Sources recommandées pour les sons

### Options gratuites
1. **Google Actions Sounds** (déjà utilisés en fallback)
   - https://actions.google.com/sounds/v1/
   
2. **Freesound.org**
   - https://freesound.org/
   - Licence CC0 (public domain)

3. **Zapsplat**
   - https://www.zapsplat.com/
   - Sons gratuits avec attribution

### Options premium
1. **Epidemic Sound**
   - Bibliothèque professionnelle
   - Abonnement mensuel

2. **AudioJungle**
   - Sons payants à l'unité
   - Haute qualité

## Caractéristiques techniques recommandées

- **Format**: MP3 ou M4A
- **Qualité**: 128-192 kbps
- **Fréquence**: 44.1 kHz
- **Taille**: < 100 KB par fichier
- **Canal**: Mono (pour les notifications)

## Intégration

Une fois les fichiers créés, le service `NotificationSoundService` les utilisera automatiquement :

```typescript
// Dans notificationSoundService.ts
case 'order':
    soundSource = require('../../assets/sounds/order_notification.mp3');
    break;
case 'delivery_request':
    soundSource = require('../../assets/sounds/delivery_request.mp3');
    break;
// etc.
```

## Test

Pour tester les sons :
1. Lancez l'app en mode développement
2. Déclenchez différents types de notifications
3. Vérifiez que chaque type a un son distinct
4. Testez en background (Android) et en mode silencieux (iOS)

## Priorité

1. **Critique**: `delivery_request.mp3` (pour les coursiers)
2. **Important**: `order_notification.mp3` (pour les prestataires)
3. **Moyen**: `courier_alert.mp3` et `ready_notification.mp3`

Les fallbacks en ligne fonctionnent déjà, donc l'app restera opérationnelle même sans ces fichiers.
