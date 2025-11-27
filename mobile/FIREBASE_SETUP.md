# Configuration Firebase pour Push Notifications Android

## Problème
L'application mobile nécessite Firebase Cloud Messaging (FCM) pour les push notifications sur Android. Sans configuration Firebase, vous verrez l'erreur :
```
Default FirebaseApp is not initialized in this process com.yukpomnang.mobile
Code: E_REGISTRATION_FAILED
```

## Solution

### 1. Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Ajoutez une application Android avec le package name : `com.yukpomnang.mobile`

### 2. Télécharger google-services.json

1. Dans Firebase Console, allez dans **Project Settings** > **Your apps** > **Android app**
2. Téléchargez le fichier `google-services.json`
3. Placez-le dans le dossier `mobile/android/app/`

### 3. Configurer app.json

Le fichier `app.json` est déjà configuré avec :
```json
"android": {
  "googleServicesFile": "./google-services.json"
}
```

### 4. Rebuild l'application

Après avoir ajouté `google-services.json`, vous devez rebuilder l'application :

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
```

### 5. Vérifier la configuration

Une fois configuré, les push notifications devraient fonctionner sans erreur `E_REGISTRATION_FAILED`.

## Documentation Expo

Pour plus de détails, consultez :
- [Expo Push Notifications FCM Guide](https://docs.expo.dev/push-notifications/fcm-credentials/)

## Notes

- Le fichier `google-services.json` est sensible et ne doit PAS être commité dans Git
- Ajoutez `google-services.json` au `.gitignore`
- Pour la production, utilisez EAS Build qui gère automatiquement les credentials Firebase

