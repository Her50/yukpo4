# 🌐 Publier l'application OAuth pour tous les utilisateurs

## 🎯 Objectif

Permettre à **tous les utilisateurs** (pas seulement les test users) de créer un compte via Google OAuth.

## ❌ Problème actuel

L'application est en mode **"Testing"** dans Google Cloud Console, ce qui signifie que seuls les utilisateurs de test peuvent se connecter. Pour permettre à tous les utilisateurs de se connecter, l'application doit être **publiée et vérifiée** par Google.

## ✅ Solution : Publier l'application OAuth

### Étape 1 : Accéder à l'écran de consentement OAuth

1. **Aller sur** : https://console.cloud.google.com/apis/credentials/consent
2. Sélectionnez votre projet Google Cloud

### Étape 2 : Compléter l'écran de consentement OAuth

Remplissez **tous** les champs requis :

#### Informations de base
- **App name** : `Yukpomnang`
- **User support email** : Votre email de support
- **App logo** : Logo de l'application (optionnel mais recommandé)
- **Application home page** : `https://yukpomnang.com`
- **Application privacy policy link** : `https://yukpomnang.com/privacy` (ou votre URL de politique de confidentialité)
- **Application terms of service link** : `https://yukpomnang.com/terms` (ou votre URL de conditions d'utilisation)
- **Authorized domains** : `yukpomnang.com` (sans `https://`)

#### Scopes (Permissions)

Cliquez sur **ADD OR REMOVE SCOPES** et ajoutez uniquement les scopes nécessaires :

- ✅ `openid` (requis pour OAuth)
- ✅ `profile` (pour obtenir le nom et la photo de profil)
- ✅ `email` (pour obtenir l'adresse email)

**⚠️ Important** : N'ajoutez que les scopes strictement nécessaires. Plus vous demandez de permissions, plus la vérification sera longue.

#### Informations développeur

- **Developer contact information** : Votre email de contact

### Étape 3 : Sauvegarder et continuer

1. Cliquez sur **SAVE AND CONTINUE** après chaque section
2. Passez en revue toutes les sections
3. Cliquez sur **BACK TO DASHBOARD** une fois terminé

### Étape 4 : Publier l'application

1. Dans le tableau de bord de l'écran de consentement OAuth, vous verrez le statut de votre application
2. Si l'application est en mode **Testing**, vous verrez un bouton **PUBLISH APP**
3. Cliquez sur **PUBLISH APP**
4. Confirmez la publication

### Étape 5 : Soumettre pour vérification (si nécessaire)

**Si Google demande une vérification** :

1. Google peut demander une vérification si :
   - Vous demandez des scopes sensibles
   - L'application est utilisée par plus de 100 utilisateurs
   - L'application accède à des données utilisateur sensibles

2. **Processus de vérification** :
   - Google examinera votre application
   - Vous devrez peut-être fournir des informations supplémentaires
   - Le processus peut prendre **plusieurs jours à plusieurs semaines**

3. **Pendant la vérification** :
   - L'application peut rester en mode **Testing**
   - Seuls les test users peuvent se connecter
   - Une fois vérifiée, tous les utilisateurs pourront se connecter

### Étape 6 : Vérifier le statut

1. Retournez sur l'écran de consentement OAuth
2. Vérifiez le statut :
   - **Testing** : Seuls les test users peuvent se connecter
   - **In production** : Tous les utilisateurs peuvent se connecter (après vérification si nécessaire)

## 🔧 Configuration technique requise

### 1. Vérifier la configuration OAuth Android

Assurez-vous que votre client OAuth Android est correctement configuré :

1. **Aller sur** : https://console.cloud.google.com/apis/credentials
2. **Cliquer** sur votre client OAuth Android
3. **Vérifier** :
   - ✅ **Package name** : `com.yukpomnang.mobile`
   - ✅ **SHA-1 certificate fingerprint** : Configuré (debug et release)
   - ✅ **Authorized redirect URIs** : 
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`

### 2. Vérifier les variables d'environnement

#### Option A : EAS Secrets (Recommandé pour EAS Build)

Vérifiez que `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` est configuré dans EAS Secrets :

```bash
cd mobile
eas secret:list --scope project
```

Si elle n'existe pas, créez-la :

```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id-android.apps.googleusercontent.com
```

#### Option B : eas.json (Alternative)

Si vous préférez utiliser `eas.json`, ajoutez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans les sections `preview` et `production`.

## ⏱️ Délais et attentes

### Publication immédiate
- **Mode Testing → In Production** : Immédiat (si pas de vérification requise)
- **Propagation** : 2-5 minutes

### Vérification Google (si requise)
- **Délai** : 1-4 semaines (parfois plus)
- **Pendant la vérification** : L'application reste en mode Testing
- **Après vérification** : Tous les utilisateurs peuvent se connecter

## 📋 Checklist de publication

- [ ] Écran de consentement OAuth complété avec :
  - [ ] App name
  - [ ] User support email
  - [ ] Application home page
  - [ ] Privacy policy link
  - [ ] Terms of service link
  - [ ] Authorized domains
  - [ ] Scopes (openid, profile, email)
- [ ] Application publiée (bouton "PUBLISH APP" cliqué)
- [ ] Client OAuth Android configuré correctement
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` configuré dans EAS Secrets ou eas.json
- [ ] Application rebuild avec la nouvelle configuration

## 🔗 Liens utiles

- [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [Documentation Google OAuth 2.0 Verification](https://support.google.com/cloud/answer/9110914)

## ⚠️ Notes importantes

1. **Privacy Policy et Terms of Service** : Ces pages doivent être accessibles publiquement. Si vous ne les avez pas encore, créez-les rapidement.

2. **Scopes minimaux** : Ne demandez que les scopes strictement nécessaires pour accélérer la vérification.

3. **Mode Testing temporaire** : Si vous avez besoin de tester immédiatement, vous pouvez ajouter des test users en attendant la vérification complète.

4. **Vérification automatique** : Pour certaines applications simples avec des scopes basiques (openid, profile, email), Google peut approuver automatiquement sans vérification manuelle.

