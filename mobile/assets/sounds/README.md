# Sons personnalisés pour notifications Yukpomnang

## 📱 Fichiers requis

Pour activer les sons personnalisés dans l'application :

### 1. **call_ringtone.mp3** (Obligatoire)
Sonnerie pour les appels entrants (audio/vidéo)

**Spécifications recommandées :**
- Format : MP3
- Durée : 5-10 secondes (en boucle automatique)
- Qualité : 128 kbps
- Taille : < 500 KB

## 🎵 Options pour obtenir un son

### Option 1 : Sons libres de droits
Téléchargez depuis ces sites gratuits :
- **Freesound.org** : https://freesound.org/search/?q=phone+ringtone
- **Zapsplat** : https://www.zapsplat.com/sound-effect-category/mobile-phone-ringtones/
- **Pixabay** : https://pixabay.com/sound-effects/search/ringtone/

### Option 2 : Créer votre propre son
Utilisez des outils en ligne :
- **TwistedWave** : https://twistedwave.com/online
- **Audacity** (gratuit) : https://www.audacityteam.org/

### Option 3 : Sons système Android
Utilisez les sons intégrés d'Android :
```
adb pull /system/media/audio/ringtones/[nom_fichier].ogg
# Puis convertir en MP3
```

## 📝 Une fois le fichier obtenu

1. **Renommer** le fichier en `call_ringtone.mp3`
2. **Placer** dans ce dossier (`mobile/assets/sounds/`)
3. **Vérifier** que le fichier est bien nommé (sensible à la casse)
4. **Ajouter** au git : `git add assets/sounds/call_ringtone.mp3`

## 🔄 Activer dans la configuration

Le fichier `app.json` sera automatiquement mis à jour pour inclure :

```json
[
  "expo-notifications",
  {
    "icon": "./assets/notification-icon.png",
    "color": "#6366F1",
    "sounds": ["./assets/sounds/call_ringtone.mp3"],
    "androidMode": "default",
    "androidCollapsedTitle": "Yukpomnang"
  }
]
```

## 🚀 Rebuild l'application

Après avoir ajouté le fichier :
```bash
npx eas build --platform android --profile preview
```

## ⚠️ Notes importantes

- Le fichier **DOIT** être tracké par git (EAS ne lit que les fichiers git)
- Format MP3 uniquement (OGG aussi supporté mais moins compatible)
- Éviter les fichiers > 1 MB
- Le son sera joué en boucle jusqu'à réponse/refus de l'appel

