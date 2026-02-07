# ✅ Corrections d'alignement OAuth Google Android

## 🔍 Problèmes identifiés

### Problème 1 : Redirect URI non explicite
Le `redirectUri` n'était pas explicitement défini dans `Google.useAuthRequest()`, ce qui pouvait causer des incohérences avec la configuration Google Cloud Console.

### Problème 2 : Génération automatique non alignée
`expo-auth-session` génère automatiquement le redirect URI, mais sans garantie d'alignement avec `app.config.js`.

## ✅ Corrections appliquées

### 1. Utilisation de `Linking.createURL()`

**Avant** :
```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  // Pas de redirectUri explicite
});
```

**Après** :
```typescript
import * as Linking from 'expo-linking';

const redirectUri = Linking.createURL('/');
// Génère : yukpomnang:// (basé sur le scheme dans app.config.js)

const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  redirectUri: redirectUri, // ✅ Forcé pour garantir l'alignement
});
```

### 2. Logs de debug améliorés

Les logs affichent maintenant :
- Le redirect URI forcé (`redirectUri`)
- Le redirect URI dans la request (`googleRequest.redirectUri`)
- Le résultat de `Linking.createURL('/')`

Cela permet de vérifier que tout est aligné.

## 📋 Alignement vérifié

### Configuration cohérente :

1. **`app.config.js`** :
   - `scheme: "yukpomnang"` ✅
   - `android.package: "com.yukpomnang.mobile"` ✅

2. **`AndroidManifest.xml`** :
   - `android:scheme="yukpomnang"` ✅
   - `android:scheme="com.yukpomnang.mobile"` ✅
   - `android:scheme="exp+yukpomnang-mobile"` ✅

3. **Code OAuth** :
   - `redirectUri: Linking.createURL('/')` → génère `yukpomnang://` ✅
   - Aligné avec `app.config.js` ✅

## 🎯 Résultat attendu

Avec `Linking.createURL('/')`, le redirect URI généré sera :
- **Android** : `yukpomnang://` (basé sur `scheme` dans `app.config.js`)
- **iOS** : `yukpomnang://` (basé sur `CFBundleURLSchemes` dans `app.config.js`)

Cet URI doit correspondre **exactement** à celui configuré dans Google Cloud Console.

## 📝 Vérification dans Google Cloud Console

Assurez-vous que dans Google Cloud Console (client OAuth Android), les URI de redirection incluent :
- `yukpomnang://` ✅ (celui généré par `Linking.createURL('/')`)
- `com.yukpomnang.mobile://` (format alternatif)
- `exp+yukpomnang-mobile://` (format Expo)

## 🔧 Prochaines étapes

1. **Rebuild l'application** :
   ```bash
   cd mobile
   rm -rf android/app/build android/build android/.gradle
   npx expo prebuild --clean
   npx expo run:android
   ```

2. **Tester la connexion Google** et vérifier les logs :
   - Le redirect URI dans les logs doit être `yukpomnang://`
   - Vérifier qu'il correspond à celui dans Google Cloud Console

3. **Si le problème persiste** :
   - Vérifier que `yukpomnang://` est bien dans Google Cloud Console
   - Vérifier le SHA-1 fingerprint
   - Vérifier que le Client ID Android correspond

## ✅ Fichiers modifiés

- `mobile/src/screens/auth/LoginScreen.tsx`
- `mobile/src/screens/auth/RegisterScreen.tsx`

Les deux fichiers utilisent maintenant `Linking.createURL('/')` pour garantir l'alignement avec la configuration Expo.

