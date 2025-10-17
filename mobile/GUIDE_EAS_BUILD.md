# Guide Configuration EAS Build pour Yukpomnang Mobile

## 📋 Prérequis

Avant de lancer le build EAS, assurez-vous d'avoir :

1. **Node.js** version 18+ installé
2. **npm** ou **yarn** à jour
3. **Expo CLI** installé globalement : `npm install -g expo-cli`
4. **EAS CLI** installé globalement : `npm install -g eas-cli`
5. Un compte Expo (gratuit) sur https://expo.dev
6. Être connecté à votre compte : `eas login`

## 🔧 Configuration Actuelle

### Configuration EAS (eas.json)
- ✅ Profile `preview` configuré pour Android
- ✅ Variables d'environnement définies
- ✅ Gradle optimisé avec 4GB de mémoire
- ✅ Hermes activé pour de meilleures performances
- ✅ Build APK (pas AAB) pour installation directe

### Configuration App (app.config.js)
- ✅ Plugins Expo configurés (Location, Camera, Maps, etc.)
- ✅ Permissions Android définies
- ✅ Mises à jour Expo désactivées
- ✅ Project ID EAS configuré

## 🚀 Étapes pour le Build

### 1. Vérifier l'installation d'EAS CLI

```bash
cd mobile
eas --version
```

Si EAS CLI n'est pas installé :
```bash
npm install -g eas-cli
```

### 2. Se connecter à Expo

```bash
eas login
```

Utilisez les identifiants du compte `hernandezlele` (owner dans app.json).

### 3. Configurer le projet (première fois uniquement)

```bash
eas build:configure
```

Cette commande va :
- Vérifier le fichier `eas.json`
- Créer le lien avec votre projet Expo
- Configurer les credentials Android

### 4. Vérifier la configuration localement

Avant de lancer le build sur les serveurs EAS, testez la configuration :

```bash
# Nettoyer le cache
npm run clean

# Tester le prebuild (génère les dossiers android/ios)
npm run prebuild:android

# Vérifier que tout compile
cd android && ./gradlew clean && cd ..
```

### 5. Lancer le Build EAS

#### Option A : Build Preview (Recommandé)
```bash
npm run build:preview
# ou directement
npx eas build --platform android --profile preview
```

#### Option B : Build Local (pour tester)
Si vous voulez construire localement sans utiliser les serveurs EAS :
```bash
npm run build:android-local
```

⚠️ **Note** : Le build local nécessite :
- Android SDK installé
- Java JDK 17
- Gradle configuré

### 6. Suivre le Build

Après avoir lancé la commande :
1. EAS va uploader votre code
2. Le build se fera sur les serveurs Expo
3. Vous recevrez un lien pour suivre la progression
4. Le build prend environ 10-20 minutes

Vous pouvez suivre le build sur : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile-new/builds

### 7. Télécharger et installer l'APK

Une fois le build terminé :
1. Téléchargez l'APK depuis le lien fourni
2. Transférez-le sur votre téléphone Android
3. Installez-le (vous devez autoriser l'installation depuis des sources inconnues)

## 🛠️ Résolution de Problèmes

### Erreur : "Not logged in"
```bash
eas logout
eas login
```

### Erreur : "Project not configured"
```bash
eas build:configure
```

### Erreur : "Gradle build failed"
Vérifiez les logs du build. Les causes communes :
- Problèmes de mémoire Gradle (déjà optimisé dans notre config)
- Conflits de dépendances
- Problèmes de version Kotlin (géré automatiquement)

### Erreur : "Metro bundler failed"
Les scripts post-install devraient corriger cela automatiquement.
Si le problème persiste :
```bash
npm run clean:deep
npm install
```

### L'app ne fonctionne plus en local

Pour restaurer le fonctionnement local :

```bash
# Nettoyer complètement
npm run clean:deep

# Ou manuellement
rm -rf node_modules
rm -rf .expo
rm -rf android
rm -rf ios
rm package-lock.json

# Réinstaller
npm install

# Lancer en mode développement
npm start
```

## 📱 Commandes Utiles

```bash
# Voir tous les builds
eas build:list

# Annuler un build en cours
eas build:cancel

# Voir les credentials Android
eas credentials

# Tester la config sans build
eas build --platform android --profile preview --no-wait

# Build avec plus de logs
eas build --platform android --profile preview --verbose
```

## 🔑 Credentials Android

EAS gère automatiquement les credentials (keystore) pour signer votre APK.
- **credentialsSource**: "remote" (stockés sur Expo)
- **withoutCredentials**: false (credentials requis)

Si vous voulez utiliser vos propres credentials :
```bash
eas credentials
```

## 📊 Variables d'Environnement

Définies dans `eas.json` pour le profil preview :
```json
{
  "EXPO_PUBLIC_API_URL": "https://yukpomnang.onrender.com",
  "EXPO_PUBLIC_ENVIRONMENT": "production",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSy...",
  "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSy...",
  "NODE_ENV": "production"
}
```

Ces variables sont accessibles dans le code via :
```typescript
process.env.EXPO_PUBLIC_API_URL
```

## 🎯 Prochaines Étapes

Après un build réussi :

1. **Test de l'APK** sur un appareil physique
2. **Validation des fonctionnalités** :
   - GPS / Géolocalisation
   - Caméra / Photos
   - API Backend
   - Google Maps
   - Notifications
3. **Optimisation** si nécessaire
4. **Build Production** avec le profil `production` pour le Play Store

## 📝 Notes Importantes

- ⏱️ Le premier build prend plus de temps (15-25 min)
- 💾 Les builds suivants sont plus rapides grâce au cache
- 📱 Le profil `preview` génère un APK installable directement
- 🏪 Pour le Play Store, utilisez le profil `production` qui génère un AAB
- 🔄 Les mises à jour OTA sont désactivées (builds standalone)

## 🆘 Support

En cas de problème :
1. Vérifier les logs du build EAS
2. Consulter https://docs.expo.dev/build/introduction/
3. Vérifier le statut d'Expo : https://status.expo.dev/

---

**Dernière mise à jour** : Configuration optimisée pour Expo SDK 54 et React Native 0.79.5

