# 🚨 Actions immédiates : Résoudre l'erreur OAuth Google

## ❌ Problème actuel

Erreur lors de la connexion Google sur mobile :
```
Accès bloqué : erreur d'autorisation
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy
Error 400: invalid_request
```

## ✅ Solution rapide (2 actions)

### Action 1 : Ajouter l'utilisateur comme test user dans Google Cloud Console

1. **Aller sur** : https://console.cloud.google.com/apis/credentials/consent
2. **Faire défiler** jusqu'à la section **Test users**
3. **Cliquer** sur **+ ADD USERS**
4. **Ajouter** l'email : `lelehernandez2007@gmail.com`
5. **Cliquer** sur **ADD**

**⏱️ Temps** : 2 minutes  
**✅ Résultat** : L'utilisateur pourra se connecter immédiatement

### Action 2 : Ajouter EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID dans eas.json

**⚠️ CRITIQUE** : Cette variable est **manquante** dans `eas.json` !

#### Étape 1 : Obtenir le Client ID Android

1. **Aller sur** : https://console.cloud.google.com/apis/credentials
2. **Trouver** le **OAuth 2.0 Client ID** de type **Android**
3. **Copier** le **Client ID** (format : `XXXX-XXXX.apps.googleusercontent.com`)

#### Étape 2 : Ajouter dans eas.json

Modifiez `mobile/eas.json` et ajoutez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans les sections `preview` et `production` :

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "VOTRE-CLIENT-ID-ANDROID.apps.googleusercontent.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "VOTRE-CLIENT-ID-ANDROID.apps.googleusercontent.com"
      }
    }
  }
}
```

**Remplacez** `VOTRE-CLIENT-ID-ANDROID.apps.googleusercontent.com` par le Client ID Android que vous avez copié.

## 📋 Vérifications supplémentaires

### Vérifier la configuration OAuth Android dans Google Cloud

1. **Aller sur** : https://console.cloud.google.com/apis/credentials
2. **Cliquer** sur votre client OAuth Android
3. **Vérifier** :
   - ✅ **Package name** : `com.yukpomnang.mobile`
   - ✅ **SHA-1 certificate fingerprint** : Configuré
   - ✅ **Authorized redirect URIs** : Contient :
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`

## 🔄 Après les modifications

### Rebuild l'application

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
```

Ou si vous utilisez EAS Build :

```bash
cd mobile
eas build --platform android --profile preview
```

## ⏱️ Délais

- **Ajout test user** : Immédiat (2-5 minutes de propagation)
- **Modification eas.json** : Nécessite un rebuild de l'application
- **Propagation Google Cloud** : 2-5 minutes

## 📚 Documentation complète

Pour plus de détails, consultez : `mobile/SOLUTION_ERREUR_OAUTH_POLICY_GOOGLE.md`

