# 🔔 Fichiers audio pour les sonneries d'appel

## Fichiers requis

Pour que les sonneries d'appel fonctionnent correctement, vous devez placer un fichier audio dans ce dossier :

### `ringtone.mp3`
- **Usage** : Sonnerie pour les appels WebRTC (audio et vidéo)
- **Format** : MP3
- **Durée recommandée** : 5-10 secondes (en boucle)
- **Volume** : Normalisé (le code ajuste automatiquement)

## Où trouver des sonneries gratuites ?

### Sources recommandées :
1. **Zedge** : https://www.zedge.net/ringtones
2. **Freesound** : https://freesound.org/
3. **Notification Sounds** : https://notificationsounds.com/

## Fallback

Si le fichier `ringtone.mp3` n'est pas présent, l'application utilise un son de secours en ligne :
- URL : https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg
- ⚠️ Nécessite une connexion internet

## Comment ajouter la sonnerie

1. Téléchargez un fichier audio MP3
2. Renommez-le en `ringtone.mp3`
3. Placez-le dans ce dossier (`mobile/src/assets/sounds/`)
4. Rebuild l'application

## Test

Pour tester la sonnerie :
1. Lancez un appel depuis un appareil
2. La sonnerie devrait se jouer automatiquement :
   - **Émetteur** : Sonnerie d'attente (volume 50%)
   - **Destinataire** : Sonnerie d'appel entrant (volume 100%)

## Notes techniques

- La sonnerie joue en boucle jusqu'à ce que l'appel soit accepté/refusé
- Elle fonctionne même si le téléphone est en mode silencieux
- Le volume est ajusté automatiquement selon le type d'appel

