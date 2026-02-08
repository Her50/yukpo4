# 🔧 Résumé : Correction OAuth Google Android

## ❌ Problème identifié

Erreur lors de la connexion/inscription avec Google sur Android :
```
Error 400: invalid_request
Custom URI scheme is not enabled for your Android client.
```

## ✅ Solution mise en place

### 1. Guide de configuration créé
📄 **Fichier** : `mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md`

Ce guide explique comment :
- Configurer le client OAuth Android dans Google Cloud Console
- Obtenir le SHA-1 fingerprint
- Configurer les URI de redirection autorisés
- Définir les variables d'environnement nécessaires

### 2. Scripts d'aide créés
📄 **Fichiers** :
- `mobile/scripts/get-sha1-fingerprint.ps1` (Windows PowerShell)
- `mobile/scripts/get-sha1-fingerprint.sh` (Linux/Mac)

**Usage** :
```powershell
# Windows - Debug keystore
.\scripts\get-sha1-fingerprint.ps1 debug

# Windows - Release keystore
.\scripts\get-sha1-fingerprint.ps1 release -KeystorePath "chemin/keystore.jks" -Alias "alias" -Password "password"
```

```bash
# Linux/Mac - Debug keystore
./scripts/get-sha1-fingerprint.sh debug

# Linux/Mac - Release keystore
./scripts/get-sha1-fingerprint.sh release "chemin/keystore.jks" "alias" "password"
```

### 3. Amélioration de la gestion des erreurs
✅ **Fichiers modifiés** :
- `mobile/src/screens/auth/LoginScreen.tsx`
- `mobile/src/screens/auth/RegisterScreen.tsx`

**Améliorations** :
- Messages d'erreur spécifiques selon le type d'erreur OAuth
- Détection de l'erreur "Custom URI scheme is not enabled"
- Vérification de la présence du Client ID Android avant lancement
- Messages d'aide pointant vers le guide de résolution

## 📋 Actions requises pour résoudre le problème

### Étape 1 : Obtenir le SHA-1 fingerprint
```powershell
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

### Étape 2 : Configurer Google Cloud Console
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** > **Credentials**
3. Créer ou modifier le client OAuth Android :
   - **Package name** : `com.yukpomnang.mobile`
   - **SHA-1 fingerprint** : Copier le SHA-1 obtenu à l'étape 1
   - **Authorized redirect URIs** : Ajouter :
     - `yukpomnang://`
     - `com.yukpomnang.mobile://`
     - `exp+yukpomnang-mobile://`

### Étape 3 : Configurer le Client ID Android
Créer/modifier le fichier `.env` dans `mobile/` :
```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=votre-client-id-android.apps.googleusercontent.com
```

**Ou** pour EAS Build, ajouter dans `eas.json` :
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "votre-client-id-android.apps.googleusercontent.com"
      }
    }
  }
}
```

### Étape 4 : Rebuild l'application
```bash
cd mobile

# Nettoyer
rm -rf android/app/build android/build android/.gradle

# Rebuild
npx expo prebuild --clean
npx expo run:android
```

## 🔍 Vérification

Après avoir effectué les étapes ci-dessus :
1. Lancer l'application
2. Tenter une connexion/inscription avec Google
3. Vérifier que l'erreur ne se produit plus

## 📚 Documentation

- **Guide complet** : `mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md`
- **Documentation Expo** : https://docs.expo.dev/guides/authentication/#google
- **Google OAuth Android** : https://developers.google.com/identity/sign-in/android/start-integrating

## ⚠️ Notes importantes

1. **SHA-1 multiple** : Si vous utilisez plusieurs keystores (debug, release, staging), ajoutez **tous** les SHA-1 dans Google Cloud Console

2. **Temps de propagation** : Les changements dans Google Cloud Console peuvent prendre quelques minutes

3. **Client ID différent** : Le Client ID Android est **différent** du Client ID Web/iOS

4. **Variables d'environnement** : Pour EAS Build, utilisez les secrets EAS :
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id
   ```

## ✅ Checklist

- [ ] SHA-1 fingerprint obtenu (debug et/ou release)
- [ ] Client OAuth Android configuré dans Google Cloud Console
- [ ] SHA-1 ajouté dans le client OAuth Android
- [ ] URI de redirection autorisés configurés
- [ ] Variable `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` définie
- [ ] Application rebuildée
- [ ] Test de connexion Google effectué avec succès



