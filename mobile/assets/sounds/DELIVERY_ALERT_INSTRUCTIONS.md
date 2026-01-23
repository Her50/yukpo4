# 🚚 Comment ajouter le son d'alerte de livraison (delivery_alert.mp3)

## ⚡ Solution rapide (2 minutes)

### Téléchargez un son gratuit :

1. **Visitez** : https://pixabay.com/sound-effects/search/alert/
2. **Choisissez** un son d'alerte (par exemple "notification", "alert", "beep")
3. **Téléchargez** en MP3
4. **Renommez** en `delivery_alert.mp3`
5. **Placez** dans ce dossier (`mobile/assets/sounds/`)

### Ou utilisez ces sites gratuits :

- **Freesound.org** : https://freesound.org/search/?q=notification+alert
- **Zapsplat** : https://www.zapsplat.com/sound-effect-category/notification-sounds/
- **YouTube Audio Library** : https://www.youtube.com/audiolibrary (cherchez "notification")

## 🎯 Recommandations pour le son

- **Durée** : 1-3 secondes (court et percutant)
- **Volume** : Modéré à fort (pour attirer l'attention des coursiers)
- **Format** : MP3 128kbps
- **Taille** : < 500 KB
- **Type** : Son d'alerte/notification clair et distinctif

## 🔄 Après avoir ajouté le fichier

```powershell
# 1. Vérifier que le fichier est là
cd mobile/assets/sounds
ls delivery_alert.mp3

# 2. Ajouter au git
git add delivery_alert.mp3

# 3. Commit
git commit -m "feat: ajouter son d'alerte pour notifications de livraison"

# 4. Rebuild l'application (nécessaire pour que le son soit inclus)
npx eas build --platform android --profile preview
```

## ✅ Le fichier est prêt quand :

- ✅ Nom exact : `delivery_alert.mp3`
- ✅ Format : MP3
- ✅ Taille : < 500 KB
- ✅ Durée : 1-3 secondes
- ✅ Présent dans `mobile/assets/sounds/`

## 📱 Utilisation dans l'app

Le son sera automatiquement utilisé pour :
- Les notifications de livraison disponibles pour les coursiers
- Le canal Android `delivery_notifications` (configuré dans `pushNotifications.ts`)
- Répété toutes les 30 secondes jusqu'à acceptation ou expiration (5 minutes)

## ⚠️ Notes importantes

- Le fichier **DOIT** être tracké par git (EAS ne lit que les fichiers git)
- Format MP3 recommandé (meilleure compatibilité)
- Le son sera joué via le système de notifications Android/iOS
- Si le fichier n'existe pas, le système utilisera le son par défaut

## 🎵 Exemples de sons appropriés

- Son de cloche/notification
- Bip d'alerte court
- Son de notification moderne
- Alerte sonore distincte

**Éviter** :
- Sons trop longs (> 5 secondes)
- Sons trop complexes
- Musiques ou mélodies longues

