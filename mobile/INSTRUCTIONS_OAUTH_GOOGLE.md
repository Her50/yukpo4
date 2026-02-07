# 🚀 Instructions rapides : Configuration OAuth Google Android

## ✅ Configuration automatique effectuée

J'ai automatiquement mis à jour :
- ✅ `eas.json` avec les variables OAuth Google
- ✅ Scripts d'aide pour obtenir le SHA-1 fingerprint
- ✅ Amélioration de la gestion des erreurs dans le code

## 📋 Actions manuelles requises

### 1. Obtenir le SHA-1 fingerprint

**Windows (PowerShell)** :
```powershell
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

**Ou utiliser le script de configuration complet** :
```powershell
cd mobile
.\scripts\setup-google-oauth.ps1
```

### 2. Configurer Google Cloud Console

1. **Aller sur** : https://console.cloud.google.com/apis/credentials

2. **Créer ou modifier le client OAuth Android** :
   - Cliquez sur **+ CREATE CREDENTIALS** > **OAuth client ID**
   - Sélectionnez **Android**
   - **Package name** : `com.yukpomnang.mobile`
   - **SHA-1 fingerprint** : Collez le SHA-1 obtenu à l'étape 1

3. **Ajouter les URI de redirection** :
   Dans la section **Authorized redirect URIs**, ajoutez :
   ```
   yukpomnang://
   com.yukpomnang.mobile://
   exp+yukpomnang-mobile://
   ```

4. **Copier le Client ID Android** :
   - Format : `XXXX-XXXX.apps.googleusercontent.com`
   - Vous en aurez besoin pour l'étape suivante

### 3. Configurer le Client ID dans le projet

**Option A : Fichier .env (build local)**

Modifiez `mobile/.env` et ajoutez :
```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=votre-client-id-android.apps.googleusercontent.com
```

**Option B : EAS Secrets (build cloud)**

```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value votre-client-id-android.apps.googleusercontent.com
```

**Option C : Utiliser le script interactif**

```powershell
cd mobile
.\scripts\setup-google-oauth.ps1
```

### 4. Rebuild l'application

```bash
cd mobile

# Nettoyer
rm -rf android/app/build android/build android/.gradle

# Rebuild
npx expo prebuild --clean
npx expo run:android
```

## ✅ Vérification

1. Lancer l'application
2. Tenter une connexion/inscription avec Google
3. Vérifier que l'erreur ne se produit plus

## 📚 Documentation complète

- **Guide détaillé** : `mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md`
- **Résumé** : `mobile/RESUME_FIX_GOOGLE_OAUTH.md`

## ⚠️ Notes importantes

1. **SHA-1 multiple** : Si vous utilisez plusieurs keystores (debug, release), ajoutez **tous** les SHA-1 dans Google Cloud Console

2. **Temps de propagation** : Les changements dans Google Cloud Console peuvent prendre quelques minutes

3. **Client ID différent** : Le Client ID Android est **différent** du Client ID Web/iOS

4. **Variables d'environnement** : 
   - Pour build local : utilisez `.env`
   - Pour EAS Build : utilisez les secrets EAS ou `eas.json`

