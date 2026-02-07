# 🎯 Guide étape par étape : Publier OAuth depuis Google Cloud Console

## 📍 Vous êtes ici : Page "Présentation" (Overview)

Vous voyez les métriques OAuth avec une erreur dans le graphique. C'est normal, l'application n'est pas encore publiée.

## ✅ Étapes suivantes

### Étape 1 : Aller à l'écran de consentement OAuth

Dans la **sidebar gauche**, cliquez sur **"Audience"** (ou **"Accès aux données"** selon votre interface).

**OU** allez directement sur :
https://console.cloud.google.com/apis/credentials/consent?project=yukpomnang-460203

### Étape 2 : Vérifier le statut de l'application

Sur la page "Audience" / "OAuth consent screen", vous verrez :
- **User type** : External ou Internal
- **Publishing status** : Testing ou In production

### Étape 3 : Compléter l'écran de consentement OAuth

Si l'application est en mode **Testing**, vous devez compléter tous les champs requis :

#### Informations de base (App information)
- **App name** : `Yukpomnang`
- **User support email** : Votre email de support
- **App logo** : Logo de l'application (optionnel)
- **Application home page** : `https://yukpomnang.com`
- **Application privacy policy link** : `https://yukpomnang.com/privacy`
- **Application terms of service link** : `https://yukpomnang.com/terms`
- **Authorized domains** : `yukpomnang.com` (sans `https://`)

#### Scopes (Permissions)
Cliquez sur **"ADD OR REMOVE SCOPES"** et ajoutez uniquement :
- ✅ `openid` (requis)
- ✅ `profile` (pour nom et photo)
- ✅ `email` (pour email)

#### Informations développeur (Developer contact information)
- **Email** : Votre email de contact

### Étape 4 : Sauvegarder

1. Cliquez sur **"SAVE AND CONTINUE"** après chaque section
2. Passez en revue toutes les sections
3. Cliquez sur **"BACK TO DASHBOARD"** une fois terminé

### Étape 5 : Publier l'application

1. Dans le tableau de bord, cherchez le bouton **"PUBLISH APP"** ou **"Publier l'application"**
2. Cliquez dessus
3. Confirmez la publication

**⚠️ Important** : Après publication, l'application passera de **"Testing"** à **"In production"**, permettant à **tous les utilisateurs** de se connecter.

### Étape 6 : Vérifier la configuration OAuth Android

Pendant que vous êtes dans Google Cloud Console, vérifiez aussi la configuration Android :

1. Dans la sidebar, cliquez sur **"Clients"** (ou allez sur : https://console.cloud.google.com/apis/credentials?project=yukpomnang-460203)
2. Trouvez votre **OAuth 2.0 Client ID** de type **Android**
3. Cliquez dessus pour l'éditer
4. Vérifiez :
   - ✅ **Package name** : `com.yukpomnang.mobile`
   - ✅ **SHA-1 certificate fingerprint** : Configuré
   - ✅ **Authorized redirect URIs** : Contient :
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`

## 🔄 Navigation rapide

### Liens directs depuis votre projet :

1. **Écran de consentement OAuth** :
   https://console.cloud.google.com/apis/credentials/consent?project=yukpomnang-460203

2. **Credentials (Clients OAuth)** :
   https://console.cloud.google.com/apis/credentials?project=yukpomnang-460203

3. **Présentation (Métriques)** :
   https://console.cloud.google.com/auth/overview?project=yukpomnang-460203

## ⏱️ Délais

- **Publication** : Immédiat (2-5 minutes de propagation)
- **Vérification Google** (si requise) : 1-4 semaines
- **Pendant la vérification** : L'application peut rester en mode Testing

## 📋 Checklist

- [ ] Aller sur la page "Audience" / "OAuth consent screen"
- [ ] Compléter toutes les informations requises
- [ ] Ajouter les scopes (openid, profile, email)
- [ ] Sauvegarder toutes les sections
- [ ] Cliquer sur "PUBLISH APP"
- [ ] Vérifier la configuration OAuth Android dans "Clients"
- [ ] Vérifier que `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` est configuré dans EAS Secrets

## 🆘 Si vous ne trouvez pas "PUBLISH APP"

Si le bouton "PUBLISH APP" n'apparaît pas, c'est peut-être parce que :
1. L'application est déjà publiée (vérifiez le statut)
2. Certains champs requis ne sont pas remplis
3. Vous devez d'abord compléter toutes les sections

Dans ce cas, vérifiez que tous les champs avec un astérisque (*) sont remplis.

