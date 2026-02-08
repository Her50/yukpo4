# ✅ Configuration OAuth Google Android - Automatique

## 🎯 Ce qui a été fait automatiquement

### 1. ✅ Mise à jour de `eas.json`
- Ajout de `EXPO_PUBLIC_GOOGLE_CLIENT_ID` dans les profils `preview` et `production`
- Ajout de `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (vide, à remplir) dans les profils `preview` et `production`

### 2. ✅ Scripts d'aide créés
- `mobile/scripts/get-sha1-fingerprint.ps1` - Obtient le SHA-1 fingerprint (Windows)
- `mobile/scripts/get-sha1-fingerprint.sh` - Obtient le SHA-1 fingerprint (Linux/Mac)
- `mobile/scripts/setup-google-oauth.ps1` - Script interactif de configuration complète

### 3. ✅ Amélioration du code
- Messages d'erreur spécifiques dans `LoginScreen.tsx` et `RegisterScreen.tsx`
- Détection automatique de l'erreur "Custom URI scheme is not enabled"
- Vérification de la présence du Client ID Android avant lancement
- Messages d'aide pointant vers le guide de résolution

### 4. ✅ Documentation créée
- `mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md` - Guide complet
- `mobile/RESUME_FIX_GOOGLE_OAUTH.md` - Résumé
- `mobile/INSTRUCTIONS_OAUTH_GOOGLE.md` - Instructions rapides
- `mobile/.env.example` - Template de configuration

## 📋 Actions manuelles requises

### Étape 1 : Obtenir le SHA-1 fingerprint

**Option A : Script automatique (recommandé)**
```powershell
cd mobile
.\scripts\setup-google-oauth.ps1
```

**Option B : Script simple**
```powershell
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

### Étape 2 : Configurer Google Cloud Console

1. Aller sur : https://console.cloud.google.com/apis/credentials
2. Créer/modifier le client OAuth Android :
   - Package name : `com.yukpomnang.mobile`
   - SHA-1 fingerprint : [Utiliser le SHA-1 de l'étape 1]
   - Authorized redirect URIs :
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`
3. Copier le Client ID Android (format : `XXXX-XXXX.apps.googleusercontent.com`)

### Étape 3 : Ajouter le Client ID dans le projet

**Pour build local** :
Modifiez `mobile/.env` et ajoutez :
```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=votre-client-id-android.apps.googleusercontent.com
```

**Pour EAS Build** :
```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id-android.apps.googleusercontent.com
```

### Étape 4 : Rebuild l'application

```bash
cd mobile
rm -rf android/app/build android/build android/.gradle
npx expo prebuild --clean
npx expo run:android
```

## 🚀 Script de configuration rapide

Pour une configuration interactive complète :

```powershell
cd mobile
.\scripts\setup-google-oauth.ps1
```

Ce script :
- ✅ Obtient automatiquement le SHA-1 fingerprint
- ✅ Vérifie la configuration actuelle
- ✅ Affiche les instructions pour Google Cloud Console
- ✅ Permet d'entrer le Client ID Android directement

## 📚 Documentation

- **Instructions rapides** : `mobile/INSTRUCTIONS_OAUTH_GOOGLE.md`
- **Guide complet** : `mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md`
- **Résumé** : `mobile/RESUME_FIX_GOOGLE_OAUTH.md`

## ⚠️ Important

Le fichier `.env` est protégé et ne peut pas être modifié automatiquement. Vous devez :
1. Copier `mobile/.env.example` vers `mobile/.env` (si ce n'est pas déjà fait)
2. Ajouter manuellement `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans `.env`

Ou utilisez le script interactif qui vous guidera :
```powershell
cd mobile
.\scripts\setup-google-oauth.ps1
```



