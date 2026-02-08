# 🔍 Diagnostic OAuth Google Android

## ✅ Variables déjà configurées

Si `EXPO_PUBLIC_GOOGLE_CLIENT_ID` et `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` sont déjà configurées, le problème vient de la **configuration Google Cloud Console**.

## ❌ Erreur actuelle

```
Error 400: invalid_request
Custom URI scheme is not enabled for your Android client.
```

Cette erreur signifie que dans Google Cloud Console, le client OAuth Android n'a **PAS** :
- ❌ Le SHA-1 fingerprint configuré
- ❌ Les URI de redirection autorisées configurées

## 🔧 Solution : Configuration Google Cloud Console

### Étape 1 : Obtenir le SHA-1 fingerprint

```powershell
cd mobile
.\scripts\get-sha1-fingerprint.ps1 debug
```

### Étape 2 : Configurer dans Google Cloud Console

1. **Aller sur** : https://console.cloud.google.com/apis/credentials

2. **Trouver votre client OAuth Android** :
   - Cherchez dans la liste des "OAuth 2.0 Client IDs"
   - Le client Android devrait avoir le type "Android"
   - Si vous ne le trouvez pas, créez-en un nouveau

3. **Cliquer sur le client Android pour l'éditer**

4. **Vérifier/Configurer** :
   - ✅ **Package name** : `com.yukpomnang.mobile`
   - ✅ **SHA-1 certificate fingerprint** : [Ajouter le SHA-1 obtenu à l'étape 1]
   - ✅ **Authorized redirect URIs** : Ajouter ces 3 URI :
     ```
     yukpomnang://
     com.yukpomnang.mobile://
     exp+yukpomnang-mobile://
     ```

5. **Sauvegarder** les modifications

### Étape 3 : Vérifier que le Client ID correspond

Assurez-vous que le Client ID Android dans Google Cloud Console correspond à celui configuré dans :
- `mobile/.env` (variable `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`)
- Ou dans les secrets EAS

### Étape 4 : Attendre la propagation

Les changements dans Google Cloud Console peuvent prendre **2-5 minutes** à se propager.

### Étape 5 : Rebuild l'application

```bash
cd mobile
rm -rf android/app/build android/build android/.gradle
npx expo prebuild --clean
npx expo run:android
```

## 🔍 Vérification rapide

Pour vérifier si le problème vient de Google Cloud Console :

1. **Ouvrez** : https://console.cloud.google.com/apis/credentials
2. **Trouvez** votre client OAuth Android
3. **Vérifiez** :
   - [ ] Le SHA-1 fingerprint est présent
   - [ ] Les URI de redirection sont configurées
   - [ ] Le Package name est `com.yukpomnang.mobile`

Si l'un de ces éléments manque, c'est la cause du problème.

## 📝 Checklist de résolution

- [ ] SHA-1 fingerprint obtenu
- [ ] SHA-1 ajouté dans Google Cloud Console (client OAuth Android)
- [ ] URI de redirection ajoutées dans Google Cloud Console :
  - [ ] `yukpomnang://`
  - [ ] `com.yukpomnang.mobile://`
  - [ ] `exp+yukpomnang-mobile://`
- [ ] Package name vérifié : `com.yukpomnang.mobile`
- [ ] Client ID Android correspond à celui dans `.env` ou EAS secrets
- [ ] Attente de 2-5 minutes pour la propagation
- [ ] Application rebuildée
- [ ] Test de connexion Google effectué

## ⚠️ Points importants

1. **SHA-1 multiple** : Si vous utilisez plusieurs keystores (debug, release), ajoutez **TOUS** les SHA-1 dans Google Cloud Console

2. **Client ID différent** : Le Client ID Android est **différent** du Client ID Web. Assurez-vous d'utiliser le bon.

3. **URI exactes** : Les URI de redirection doivent correspondre **exactement** à celles utilisées par l'application.

## 🆘 Si le problème persiste

1. Vérifiez les logs de l'application pour voir l'URI de redirection utilisée
2. Vérifiez que le Client ID Android dans le code correspond à celui dans Google Cloud Console
3. Vérifiez que le SHA-1 correspond au keystore utilisé pour signer l'application



