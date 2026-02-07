# 🔍 Instructions de Debug OAuth Google

## ✅ Logs de debug ajoutés

J'ai ajouté des logs de debug dans `LoginScreen.tsx` et `RegisterScreen.tsx` pour identifier le problème exact.

## 📋 Étapes de debug

### 1. Lancer l'application avec les logs

```bash
cd mobile
npx expo start
# Dans un autre terminal
npx react-native log-android
```

### 2. Tenter une connexion Google

1. Ouvrir l'application
2. Cliquer sur "Continuer avec Google"
3. Observer les logs dans la console

### 3. Vérifier les logs

Vous devriez voir dans les logs :

```
[OAuth Debug] Request: { ... }
[OAuth Debug] Redirect URI: yukpomnang://
[OAuth Debug] Platform: android
[OAuth Debug] Android Client ID: XXXX-XXXX.apps.googleusercontent.com
[OAuth Debug] Expo Client ID: XXXX-XXXX.apps.googleusercontent.com
```

**Important** : Notez l'URI de redirection exacte affichée dans les logs.

### 4. Comparer avec Google Cloud Console

1. Aller sur : https://console.cloud.google.com/apis/credentials
2. Ouvrir votre client OAuth Android
3. Vérifier que l'URI de redirection dans les logs correspond **exactement** à une des URI dans "Authorized redirect URIs"

### 5. Vérifier le SHA-1

Le SHA-1 utilisé pour signer l'application doit correspondre à celui dans Google Cloud Console.

**Obtenir le SHA-1 de l'APK installé** :
```bash
# Si vous avez l'APK
keytool -printcert -jarfile path/to/app.apk | grep SHA1

# Ou pour le keystore debug
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

## 🔧 Solutions selon les logs

### Si l'URI de redirection ne correspond pas

Si les logs montrent une URI différente de celles configurées dans Google Cloud Console :

1. **Ajouter l'URI exacte** dans Google Cloud Console
2. **Ou** forcer l'URI dans le code (voir ci-dessous)

### Si le Client ID ne correspond pas

Vérifier que :
- Le Client ID Android dans les logs = Client ID Android dans Google Cloud Console
- Le Client ID Android est bien celui du client **Android**, pas du client Web

### Si le SHA-1 ne correspond pas

1. Obtenir le SHA-1 de l'APK actuellement installé
2. Ajouter ce SHA-1 dans Google Cloud Console (client OAuth Android)
3. Rebuild l'application

## 🔧 Solution alternative : Forcer le redirect URI

Si le problème persiste, vous pouvez forcer le redirect URI dans le code. Modifiez `LoginScreen.tsx` et `RegisterScreen.tsx` :

```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  // Forcer le redirect URI pour Android
  redirectUri: Platform.OS === 'android' 
    ? 'yukpomnang://' 
    : undefined,
});
```

**Important** : Assurez-vous que cette URI est bien configurée dans Google Cloud Console.

## 📝 Checklist de vérification

Après avoir lancé l'application et consulté les logs :

- [ ] URI de redirection dans les logs notée
- [ ] URI de redirection correspond à une URI dans Google Cloud Console
- [ ] Client ID Android dans les logs = Client ID Android dans Google Cloud Console
- [ ] SHA-1 de l'APK correspond à celui dans Google Cloud Console
- [ ] Package name dans Google Cloud Console = `com.yukpomnang.mobile`

## 🆘 Si le problème persiste

1. **Créer un nouveau client OAuth Android** dans Google Cloud Console
2. **Utiliser le nouveau Client ID** dans le code
3. **Rebuild complètement** l'application
4. **Tester** avec le nouveau client

