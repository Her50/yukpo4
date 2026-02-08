# 🔍 Vérifier et configurer les variables OAuth

## 📍 Où sont stockées les variables d'environnement ?

Les variables d'environnement Expo peuvent être configurées de **3 façons** :

### 1. EAS Secrets (Recommandé pour EAS Build)
- Stockées dans le cloud Expo
- Utilisées uniquement lors des builds EAS (cloud)
- **Non visibles** dans le code source
- **Commandes** :
  ```bash
  # Lister les secrets
  eas secret:list --scope project
  
  # Créer un secret
  eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id
  
  # Voir la valeur d'un secret (masquée)
  eas secret:view --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  ```

### 2. eas.json (Alternative)
- Stockées directement dans le fichier `eas.json`
- **Visibles** dans le code source (⚠️ attention à la sécurité)
- Utilisées lors des builds EAS
- **Format** :
  ```json
  {
    "build": {
      "preview": {
        "env": {
          "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "votre-client-id"
        }
      }
    }
  }
  ```

### 3. Fichier .env (Build local uniquement)
- Utilisé uniquement pour les builds locaux
- **Non utilisé** par EAS Build
- Chargé par `app.config.js` via `dotenv`

## ✅ Vérifier si EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID existe

### Méthode 1 : Vérifier EAS Secrets

```bash
cd mobile
eas secret:list --scope project
```

Cherchez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans la liste.

### Méthode 2 : Vérifier eas.json

Ouvrez `mobile/eas.json` et cherchez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans les sections `preview` et `production`.

### Méthode 3 : Vérifier lors du build

Si la variable n'est pas définie, vous verrez un warning dans les logs :
```
⚠️ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID non défini
```

## 🔧 Ajouter EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

### Option A : EAS Secrets (Recommandé)

```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id-android.apps.googleusercontent.com
```

**Avantages** :
- ✅ Sécurisé (pas dans le code source)
- ✅ Utilisé automatiquement par EAS Build
- ✅ Facile à mettre à jour

### Option B : eas.json (Alternative)

Si vous préférez utiliser `eas.json`, je peux l'ajouter pour vous. Il suffit de me donner le Client ID Android.

**Avantages** :
- ✅ Visible dans le code (facile à vérifier)
- ✅ Versionné avec Git

**Inconvénients** :
- ⚠️ Visible dans le code source (moins sécurisé)

## 📋 Obtenir le Client ID Android

1. **Aller sur** : https://console.cloud.google.com/apis/credentials
2. **Trouver** le **OAuth 2.0 Client ID** de type **Android**
3. **Copier** le **Client ID** (format : `XXXX-XXXX.apps.googleusercontent.com`)

## 🎯 Recommandation

**Utilisez EAS Secrets** pour `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` car :
- C'est plus sécurisé
- C'est la méthode recommandée par Expo
- Les secrets sont automatiquement utilisés lors des builds EAS

Si vous voulez que je l'ajoute dans `eas.json` à la place, dites-le moi et je le ferai.



