# 🎵 Comment ajouter la sonnerie d'appel

## ⚡ Solution rapide (2 minutes)

### Téléchargez un son gratuit :

1. **Visitez** : https://pixabay.com/sound-effects/search/ringtone/
2. **Choisissez** une sonnerie (par exemple "smartphone-calling-ring")
3. **Téléchargez** en MP3
4. **Renommez** en `call_ringtone.mp3`
5. **Placez** dans ce dossier (`mobile/assets/sounds/`)

### Ou utilisez YouTube Audio Library :

1. https://www.youtube.com/audiolibrary
2. Cherchez "ringtone" ou "phone ring"
3. Téléchargez MP3
4. Renommez en `call_ringtone.mp3`

## 🔄 Après avoir ajouté le fichier

```powershell
# 1. Vérifier que le fichier est là
ls call_ringtone.mp3

# 2. Ajouter au git
git add call_ringtone.mp3

# 3. Activer dans app.json
# (modifier la section expo-notifications pour ajouter sounds)

# 4. Rebuild
npx eas build --platform android --profile preview
```

## ✅ Le fichier est prêt quand :

- ✅ Nom exact : `call_ringtone.mp3`
- ✅ Format : MP3
- ✅ Taille : < 1 MB
- ✅ Durée : 5-10 secondes

## 🎯 Recommandations

- Son court (5-10s) car il sera joué en boucle
- Volume modéré (pas trop fort)
- Format MP3 128kbps suffit
- Éviter les sons trop longs ou lourds

---

**Note** : Pour l'instant, l'app utilise le son système par défaut. Le son personnalisé sera actif après rebuild avec le fichier.

