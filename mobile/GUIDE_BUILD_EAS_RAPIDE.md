# 🚀 Guide Rapide - Build EAS

## Étape 1 : Se connecter à EAS

Ouvrez un terminal dans le dossier `mobile/` et exécutez :

```bash
eas login
```

Vous serez invité à entrer :
- **Email ou username** : `hernandezlele` (selon votre compte Expo)
- **Mot de passe** : Votre mot de passe Expo

## Étape 2 : Lancer le build

Une fois connecté, lancez le build :

```bash
npx eas build --platform android --profile preview
```

## Alternative : Utiliser le script interactif

Vous pouvez aussi utiliser le script `BUILD-EAS.bat` qui propose un menu :

```bash
# Depuis le dossier mobile/
.\BUILD-EAS.bat
```

Puis choisissez :
- Option 2 : Se connecter à Expo
- Option 4 : Lancer le Build EAS Preview

## ⏱️ Temps de build

Le build prend généralement **15-25 minutes**. Vous recevrez :
- Un lien pour suivre la progression en temps réel
- Un lien de téléchargement de l'APK une fois terminé

## 📋 Voir vos builds

Pour voir la liste de vos builds :

```bash
eas build:list
```

## 🔍 Vérifier la configuration

Avant de lancer le build, vous pouvez vérifier votre configuration :

```bash
eas build:configure
```

## ⚠️ Notes importantes

1. **Compte Expo** : Assurez-vous d'avoir un compte Expo (gratuit) sur https://expo.dev
2. **Projet ID** : Votre projet a déjà un ID configuré dans `app.json` : `944bbf0d-5541-4e56-ba75-87ffc4c5e51f`
3. **Crédentials** : EAS gère automatiquement les credentials Android (keystore) pour vous
4. **APK** : Le profil `preview` génère un APK téléchargeable directement

## 🆘 En cas de problème

Si le build échoue :
1. Vérifiez les logs : `eas build:list` puis `eas build:view [BUILD_ID]`
2. Vérifiez votre connexion internet
3. Vérifiez que vous êtes bien connecté : `eas whoami`

## ✅ Avantages d'EAS Build

- ✅ Pas de problèmes Gradle locaux
- ✅ Build dans le cloud (pas besoin de configurer Android Studio)
- ✅ Gestion automatique des credentials
- ✅ Support multi-plateforme (Android + iOS)
- ✅ Historique des builds

