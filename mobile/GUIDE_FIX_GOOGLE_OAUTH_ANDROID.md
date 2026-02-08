# 🔧 Guide de correction : OAuth Google Android - "Custom URI scheme is not enabled"

## ❌ Problème

Erreur lors de la connexion/inscription avec Google sur Android :
```
Error 400: invalid_request
Custom URI scheme is not enabled for your Android client.
flowName=GeneralOAuthFlow
```

## 🔍 Cause

Le schéma URI personnalisé (`yukpomnang://` ou `com.yukpomnang.mobile:/`) n'est pas configuré dans la console Google Cloud pour le client Android OAuth.

## ✅ Solution : Configuration dans Google Cloud Console

### Étape 1 : Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet (ou créez-en un si nécessaire)
3. Allez dans **APIs & Services** > **Credentials**

### Étape 2 : Trouver ou créer le client OAuth Android

1. Dans la liste des **OAuth 2.0 Client IDs**, cherchez le client Android
   - Il devrait avoir le type "Android"
   - Si vous ne le trouvez pas, créez-en un :
     - Cliquez sur **+ CREATE CREDENTIALS** > **OAuth client ID**
     - Sélectionnez **Android** comme type d'application
     - Entrez le **Package name** : `com.yukpomnang.mobile`
     - Entrez le **SHA-1 certificate fingerprint** (voir ci-dessous)

### Étape 3 : Obtenir le SHA-1 fingerprint

#### Pour le build de développement (debug) :

```bash
# Windows (PowerShell)
cd android
.\gradlew signingReport

# Ou directement avec keytool
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

#### Pour le build de production (release) :

```bash
# Si vous avez un keystore de production
keytool -list -v -keystore votre-keystore.jks -alias votre-alias
```

**Important** : Vous devez ajouter **TOUS** les SHA-1 fingerprints que vous utilisez (debug ET release) dans la console Google Cloud.

### Étape 4 : Configurer les URI de redirection autorisés

1. Cliquez sur votre client OAuth Android pour l'éditer
2. Dans la section **Authorized redirect URIs**, ajoutez les URI suivants :

```
yukpomnang://
com.yukpomnang.mobile://
exp+yukpomnang-mobile://
```

**Note** : `expo-auth-session` peut utiliser différents formats selon la configuration. Il est recommandé d'ajouter les trois formats ci-dessus.

### Étape 5 : Vérifier la configuration du client

Assurez-vous que votre client OAuth Android a :
- ✅ **Application type** : Android
- ✅ **Package name** : `com.yukpomnang.mobile`
- ✅ **SHA-1 certificate fingerprint** : Votre fingerprint (debug et/ou release)
- ✅ **Authorized redirect URIs** : Les URI listés ci-dessus

### Étape 6 : Vérifier le Client ID Android dans le code

Vérifiez que le `androidClientId` est correctement configuré dans vos fichiers d'authentification :

**Fichiers à vérifier :**
- `mobile/src/screens/auth/LoginScreen.tsx` (ligne 47)
- `mobile/src/screens/auth/RegisterScreen.tsx` (ligne 56)

**Configuration actuelle :**
```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, // ⚠️ Doit être défini
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
});
```

**Action requise :**
1. Créez un fichier `.env` dans le dossier `mobile/` (si ce n'est pas déjà fait)
2. Ajoutez la variable :
   ```
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=votre-client-id-android.apps.googleusercontent.com
   ```
3. Remplacez `votre-client-id-android` par le Client ID Android de votre console Google Cloud

### Étape 7 : Rebuild l'application

Après avoir modifié la configuration :

```bash
cd mobile

# Nettoyer le build Android
rm -rf android/app/build android/build android/.gradle

# Rebuild
npx expo prebuild --clean
npx expo run:android

# Ou avec EAS Build
eas build --platform android --profile preview
```

## 🔍 Vérification

### Test 1 : Vérifier les logs

Lancez l'application et tentez une connexion Google. Vérifiez les logs :

```bash
# Android
npx react-native log-android

# Ou avec adb
adb logcat | grep -i "oauth\|google\|auth"
```

### Test 2 : Vérifier l'URI de redirection

L'URI de redirection utilisé par `expo-auth-session` devrait être visible dans les logs. Il devrait ressembler à :
- `yukpomnang://` 
- `com.yukpomnang.mobile://`
- ou `exp+yukpomnang-mobile://`

## 📝 Notes importantes

1. **SHA-1 Fingerprint** : Vous devez ajouter le SHA-1 fingerprint de **chaque** keystore que vous utilisez (debug, release, etc.)

2. **Temps de propagation** : Les changements dans Google Cloud Console peuvent prendre quelques minutes à se propager

3. **Client ID différent** : Le Client ID Android est **différent** du Client ID Web/iOS. Assurez-vous d'utiliser le bon.

4. **Variables d'environnement** : Pour EAS Build, les variables d'environnement doivent être définies dans `eas.json` ou dans les secrets EAS :
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id
   ```

## 🆘 Dépannage

### Problème : "Client ID not found"
- Vérifiez que le Client ID Android est correct dans `.env` ou `eas.json`
- Vérifiez que la variable d'environnement est bien chargée (redémarrer Metro bundler)

### Problème : "SHA-1 fingerprint mismatch"
- Vérifiez que le SHA-1 dans Google Cloud Console correspond à celui de votre keystore
- Pour le debug, utilisez le SHA-1 du keystore de debug
- Pour la production, utilisez le SHA-1 du keystore de release

### Problème : "Redirect URI mismatch"
- Vérifiez que les URI dans Google Cloud Console correspondent exactement à ceux utilisés par l'app
- Ajoutez tous les formats possibles (yukpomnang://, com.yukpomnang.mobile://, etc.)

## 📚 Ressources

- [Documentation Expo Auth Session](https://docs.expo.dev/guides/authentication/#google)
- [Google OAuth Android Setup](https://developers.google.com/identity/sign-in/android/start-integrating)
- [Google Cloud Console](https://console.cloud.google.com/)

## ✅ Checklist de résolution

- [ ] Client OAuth Android créé dans Google Cloud Console
- [ ] SHA-1 fingerprint ajouté (debug et/ou release)
- [ ] URI de redirection autorisés configurés (yukpomnang://, com.yukpomnang.mobile://, exp+yukpomnang-mobile://)
- [ ] Variable `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` définie dans `.env` ou `eas.json`
- [ ] Application rebuildée après modifications
- [ ] Test de connexion Google effectué avec succès



