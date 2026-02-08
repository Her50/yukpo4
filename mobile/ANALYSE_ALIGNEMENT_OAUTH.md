# 🔍 Analyse d'alignement OAuth Google Android

## ✅ Configuration actuelle analysée

### 1. `app.config.js`
```javascript
scheme: "yukpomnang"  // ✅
android: {
  package: "com.yukpomnang.mobile"  // ✅
  intentFilters: [
    {
      data: [
        { scheme: "yukpomnang" }  // ✅
      ]
    }
  ]
}
```

### 2. `AndroidManifest.xml`
```xml
<data android:scheme="yukpomnang"/>  // ✅
<data android:scheme="com.yukpomnang.mobile"/>  // ✅
<data android:scheme="exp+yukpomnang-mobile"/>  // ✅
```

### 3. `LoginScreen.tsx` et `RegisterScreen.tsx`
```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  // ⚠️ PAS de redirectUri explicite
});
```

## 🔍 Problèmes d'alignement identifiés

### Problème 1 : Redirect URI non explicite

`expo-auth-session` génère automatiquement le redirect URI, mais il peut y avoir des incohérences. Il est recommandé de forcer le redirect URI pour Android.

**Solution** : Ajouter `redirectUri` explicitement pour Android.

### Problème 2 : Format URI potentiellement incorrect

`expo-auth-session` peut générer des URI avec ou sans slash final. Il faut s'assurer que le format correspond exactement à celui dans Google Cloud Console.

**Formats possibles générés** :
- `yukpomnang://` (avec `://`)
- `yukpomnang:/` (avec `:/`)
- `com.yukpomnang.mobile://`
- `exp+yukpomnang-mobile://`

### Problème 3 : Client ID fallback

Si `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` n'est pas défini, le code utilise `expoClientId` comme fallback, ce qui peut causer des problèmes.

## 🔧 Corrections recommandées

### Correction 1 : Forcer le redirect URI

Modifier `LoginScreen.tsx` et `RegisterScreen.tsx` :

```typescript
import * as Linking from 'expo-linking';

// Dans le composant
const redirectUri = Linking.createURL('/');
// Ou explicitement :
const redirectUri = Platform.OS === 'android' 
  ? 'yukpomnang://' 
  : Linking.createURL('/');

const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
  redirectUri: redirectUri, // ✅ Forcer le redirect URI
});
```

### Correction 2 : Utiliser `Linking.createURL()`

`Linking.createURL()` génère l'URI basée sur la configuration Expo, ce qui garantit l'alignement :

```typescript
import * as Linking from 'expo-linking';

const redirectUri = Linking.createURL('/');
// Génère : yukpomnang:// (basé sur le scheme dans app.config.js)
```

### Correction 3 : Vérifier que androidClientId est défini

Ajouter une vérification plus stricte :

```typescript
const androidClientId = Platform.OS === 'android' 
  ? (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || (() => {
      console.error('[OAuth] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID non défini pour Android!');
      return undefined;
    })())
  : undefined;

const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: androidClientId,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  redirectUri: Platform.OS === 'android' ? Linking.createURL('/') : undefined,
});
```

## 📋 Checklist d'alignement

- [ ] `scheme` dans `app.config.js` = `"yukpomnang"`
- [ ] `package` dans `app.config.js` = `"com.yukpomnang.mobile"`
- [ ] Schemes dans `AndroidManifest.xml` incluent `yukpomnang`, `com.yukpomnang.mobile`, `exp+yukpomnang-mobile`
- [ ] `redirectUri` explicite dans `Google.useAuthRequest` (recommandé)
- [ ] `androidClientId` défini et non vide sur Android
- [ ] URI de redirection dans Google Cloud Console correspondent exactement

## 🎯 Solution recommandée

Utiliser `Linking.createURL('/')` pour générer le redirect URI, ce qui garantit l'alignement avec la configuration Expo.



