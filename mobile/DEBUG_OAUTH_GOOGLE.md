# 🔍 Debug OAuth Google - Tout est configuré mais erreur persiste

## ✅ Configuration vérifiée

Si tout est configuré (variables + Google Cloud Console), le problème peut venir de :

## 🔍 Causes possibles

### 1. SHA-1 mismatch
Le SHA-1 utilisé pour signer l'application ne correspond **PAS** à celui dans Google Cloud Console.

**Solution** :
- Obtenir le SHA-1 de l'APK actuellement installé
- Vérifier qu'il correspond à celui dans Google Cloud Console

### 2. URI de redirection incorrecte
L'URI de redirection générée par `expo-auth-session` ne correspond pas exactement à celles configurées.

**Vérification** :
- Regarder les logs de l'application pour voir l'URI exacte utilisée
- Vérifier que les URI dans Google Cloud Console correspondent exactement

### 3. Client ID mismatch
Le Client ID Android dans le code ne correspond pas au client OAuth Android dans Google Cloud Console.

**Vérification** :
- Comparer `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` avec le Client ID dans Google Cloud Console
- S'assurer qu'il s'agit bien du client **Android**, pas du client Web

### 4. Application non rebuildée
L'application n'a pas été rebuildée après les changements de configuration.

**Solution** :
```bash
cd mobile
rm -rf android/app/build android/build android/.gradle
npx expo prebuild --clean
npx expo run:android
```

### 5. Cache/Propagation
Les changements dans Google Cloud Console peuvent prendre du temps à se propager.

**Solution** :
- Attendre 5-10 minutes après les modifications
- Vider le cache de l'application Android
- Réinstaller l'application

## 🔧 Actions de debug

### Étape 1 : Vérifier le SHA-1 de l'application installée

**Pour l'APK installé** :
```bash
# Obtenir le SHA-1 de l'APK signé
keytool -printcert -jarfile path/to/your/app.apk | grep SHA1
```

**Pour le keystore utilisé** :
```powershell
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

**Comparer** avec celui dans Google Cloud Console.

### Étape 2 : Vérifier l'URI de redirection utilisée

Ajouter des logs dans le code pour voir l'URI exacte :

```typescript
// Dans LoginScreen.tsx ou RegisterScreen.tsx
console.log('[OAuth] Request:', googleRequest);
console.log('[OAuth] Redirect URI:', googleRequest?.redirectUri);
```

### Étape 3 : Vérifier le Client ID utilisé

Ajouter des logs pour vérifier :

```typescript
console.log('[OAuth] Android Client ID:', process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
console.log('[OAuth] Platform:', Platform.OS);
```

### Étape 4 : Vérifier les logs Android

```bash
# Voir les logs en temps réel
adb logcat | grep -i "oauth\|google\|auth"

# Ou avec React Native
npx react-native log-android
```

## 🎯 Solution probable : URI de redirection

`expo-auth-session` génère l'URI de redirection basée sur :
- Le `scheme` dans `app.config.js` (actuellement `"yukpomnang"`)
- Le package name Android (actuellement `"com.yukpomnang.mobile"`)

Les URI possibles générées sont :
- `yukpomnang://` (basé sur le scheme)
- `com.yukpomnang.mobile://` (basé sur le package name)
- `exp+yukpomnang-mobile://` (format Expo)

**Vérifiez dans Google Cloud Console** que ces 3 URI sont bien configurées **exactement** comme ci-dessus (sans slash final pour les deux premiers, avec slash pour le troisième).

## 🔧 Solution rapide : Forcer le redirect URI

Si le problème persiste, vous pouvez forcer le redirect URI dans la configuration :

```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  redirectUri: Platform.OS === 'android' 
    ? 'yukpomnang://' 
    : undefined, // Laisser Expo gérer pour iOS/Web
});
```

## 📋 Checklist de vérification

- [ ] SHA-1 de l'APK correspond à celui dans Google Cloud Console
- [ ] Client ID Android dans le code = Client ID Android dans Google Cloud Console
- [ ] Les 3 URI de redirection sont configurées dans Google Cloud Console :
  - [ ] `yukpomnang://`
  - [ ] `com.yukpomnang.mobile://`
  - [ ] `exp+yukpomnang-mobile://`
- [ ] Package name dans Google Cloud Console = `com.yukpomnang.mobile`
- [ ] Application rebuildée après les changements
- [ ] Cache vidé / Application réinstallée
- [ ] Attente de 5-10 minutes après modifications Google Cloud Console

## 🆘 Si rien ne fonctionne

1. **Créer un nouveau client OAuth Android** dans Google Cloud Console
2. **Utiliser le nouveau Client ID** dans le code
3. **Rebuild complètement** l'application
4. **Tester** avec le nouveau client



