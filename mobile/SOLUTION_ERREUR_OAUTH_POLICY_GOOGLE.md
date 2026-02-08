# 🔧 Solution : Erreur "doesn't comply with Google's OAuth 2.0 policy"

## ❌ Erreur actuelle

```
Accès bloqué : erreur d'autorisation
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure.
Error 400: invalid_request
```

## 🔍 Cause

L'application **Yukpomnang** n'est pas vérifiée dans Google Cloud Console. Google bloque l'accès OAuth pour les applications non vérifiées, sauf pour les utilisateurs de test.

## ✅ Solutions (par ordre de priorité)

### Solution 1 : Ajouter l'utilisateur à la liste des testeurs (RAPIDE)

Cette solution permet de tester immédiatement sans attendre la vérification complète.

#### Étape 1 : Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** > **OAuth consent screen**

#### Étape 2 : Configurer l'écran de consentement OAuth

1. Vérifiez que l'**User Type** est configuré :
   - **External** : Pour permettre à n'importe quel utilisateur Google de se connecter (nécessite vérification)
   - **Internal** : Uniquement pour les comptes Google Workspace de votre organisation

2. Si vous êtes en mode **External**, vous devez ajouter des **test users** :

#### Étape 3 : Ajouter des utilisateurs de test

1. Dans la section **OAuth consent screen**, faites défiler jusqu'à **Test users**
2. Cliquez sur **+ ADD USERS**
3. Ajoutez l'adresse email Google de l'utilisateur qui veut se connecter :
   - Exemple : `lelehernandez2007@gmail.com`
4. Cliquez sur **ADD**

#### Étape 4 : Vérifier le statut de publication

1. Assurez-vous que l'application est en mode **Testing** (pas encore publiée)
2. En mode **Testing**, seuls les utilisateurs de test peuvent se connecter
3. Si vous voulez que tous les utilisateurs puissent se connecter, vous devez publier l'application (nécessite vérification)

### Solution 2 : Vérifier la configuration OAuth Android

Même si l'application est en mode testing, la configuration Android doit être correcte.

#### Étape 1 : Vérifier le Client ID Android

1. Allez dans **APIs & Services** > **Credentials**
2. Trouvez votre **OAuth 2.0 Client ID** de type **Android**
3. Vérifiez que :
   - **Package name** : `com.yukpomnang.mobile`
   - **SHA-1 certificate fingerprint** : Votre fingerprint est configuré
   - **Authorized redirect URIs** : Les URI suivantes sont ajoutées :
     ```
     yukpomnang://
     com.yukpomnang.mobile://
     exp+yukpomnang-mobile://
     ```

#### Étape 2 : Vérifier que le Client ID est dans eas.json

Vérifiez que `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` est configuré dans `mobile/eas.json` :

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "votre-client-id-android.apps.googleusercontent.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "votre-client-id-android.apps.googleusercontent.com"
      }
    }
  }
}
```

**⚠️ IMPORTANT** : Actuellement, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` n'est **PAS** dans `eas.json`. Il faut l'ajouter !

### Solution 3 : Publier l'application (pour accès public)

Si vous voulez que tous les utilisateurs puissent se connecter sans être dans la liste des testeurs :

#### Étape 1 : Compléter l'écran de consentement OAuth

1. Allez dans **OAuth consent screen**
2. Remplissez tous les champs requis :
   - **App name** : Yukpomnang
   - **User support email** : Votre email
   - **Developer contact information** : Votre email
   - **App logo** : Logo de l'application (optionnel mais recommandé)
   - **Application home page** : https://yukpomnang.com
   - **Application privacy policy link** : https://yukpomnang.com/privacy
   - **Application terms of service link** : https://yukpomnang.com/terms
   - **Authorized domains** : yukpomnang.com

#### Étape 2 : Configurer les scopes

1. Dans **Scopes**, ajoutez uniquement les scopes nécessaires :
   - `openid` (requis)
   - `profile` (pour obtenir le nom et la photo)
   - `email` (pour obtenir l'email)

#### Étape 3 : Soumettre pour vérification

1. Une fois tous les champs remplis, cliquez sur **SAVE AND CONTINUE**
2. Cliquez sur **BACK TO DASHBOARD**
3. Cliquez sur **PUBLISH APP** pour soumettre l'application à Google pour vérification
4. Google peut prendre **plusieurs jours à plusieurs semaines** pour vérifier l'application

## 🚀 Actions immédiates à effectuer

### 1. Ajouter EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID dans eas.json

```bash
cd mobile
```

Modifiez `eas.json` et ajoutez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans les sections `preview` et `production` :

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

**Pour obtenir le Client ID Android** :
1. Allez sur [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Trouvez votre **OAuth 2.0 Client ID** de type **Android**
3. Copiez le **Client ID** (format : `XXXX-XXXX.apps.googleusercontent.com`)

### 2. Ajouter l'utilisateur comme test user

1. Allez sur [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Faites défiler jusqu'à **Test users**
3. Cliquez sur **+ ADD USERS**
4. Ajoutez : `lelehernandez2007@gmail.com`
5. Cliquez sur **ADD**

### 3. Vérifier la configuration Android dans Google Cloud

1. Allez sur [Credentials](https://console.cloud.google.com/apis/credentials)
2. Cliquez sur votre client OAuth Android
3. Vérifiez :
   - ✅ Package name : `com.yukpomnang.mobile`
   - ✅ SHA-1 fingerprint : Configuré
   - ✅ Authorized redirect URIs : 
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`

### 4. Rebuild l'application

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
```

## 📋 Checklist de vérification

- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` ajouté dans `eas.json`
- [ ] Utilisateur ajouté comme test user dans Google Cloud Console
- [ ] Client OAuth Android configuré avec :
  - [ ] Package name : `com.yukpomnang.mobile`
  - [ ] SHA-1 fingerprint configuré
  - [ ] Authorized redirect URIs configurées
- [ ] Application rebuild avec la nouvelle configuration

## 🔗 Liens utiles

- [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [Documentation Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

## ⚠️ Notes importantes

1. **Mode Testing** : En mode testing, seuls les utilisateurs de test peuvent se connecter. C'est la solution la plus rapide pour tester.

2. **Mode Production** : Pour permettre à tous les utilisateurs de se connecter, l'application doit être vérifiée par Google, ce qui peut prendre plusieurs semaines.

3. **Client ID Android** : Le `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` est **obligatoire** pour Android. Sans lui, l'application utilisera le client ID Expo par défaut, ce qui peut causer des problèmes.

4. **Propagation** : Les changements dans Google Cloud Console peuvent prendre **2-5 minutes** à se propager.



