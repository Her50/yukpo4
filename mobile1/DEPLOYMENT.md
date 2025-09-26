# Guide de Déploiement - Yukpomnang Mobile

Ce guide vous accompagne dans le déploiement de l'application mobile Yukpomnang sur l'App Store (iOS) et le Google Play Store (Android).

## 📋 Prérequis

### Comptes requis
- [ ] Compte Apple Developer (99$/an)
- [ ] Compte Google Play Console (25$ une fois)
- [ ] Compte Expo
- [ ] Compte EAS (Expo Application Services)

### Outils requis
- [ ] Node.js (v16+)
- [ ] Expo CLI
- [ ] EAS CLI
- [ ] Xcode (pour iOS)
- [ ] Android Studio (pour Android)

## 🚀 Configuration initiale

### 1. Installation des outils

```bash
# Installer Expo CLI
npm install -g @expo/cli

# Installer EAS CLI
npm install -g @expo/eas-cli

# Se connecter à Expo
eas login
```

### 2. Configuration du projet

```bash
cd mobile

# Initialiser EAS
eas build:configure

# Configurer les profils de build
eas build:configure --platform all
```

### 3. Variables d'environnement

```bash
# Ajouter les variables d'environnement
eas secret:create --scope project --name API_URL --value "https://your-api.com"
eas secret:create --scope project --name GOOGLE_MAPS_KEY --value "your_key"
eas secret:create --scope project --name GOOGLE_PLACES_KEY --value "your_key"
```

## 📱 Déploiement iOS (App Store)

### 1. Configuration Apple Developer

1. **Créer un App ID**
   - Aller sur [Apple Developer Console](https://developer.apple.com)
   - Créer un nouvel App ID : `com.yukpomnang.mobile`
   - Activer les services requis (Push Notifications, etc.)

2. **Créer un certificat de distribution**
   - Générer un certificat de distribution iOS
   - Télécharger et installer le certificat

3. **Créer un profil de provisioning**
   - Créer un profil de provisioning pour la distribution
   - Inclure l'App ID et le certificat

### 2. Configuration EAS pour iOS

```bash
# Configurer les credentials iOS
eas credentials

# Sélectionner iOS
# Choisir "Set up new iOS credentials"
# Suivre les instructions pour configurer les certificats
```

### 3. Build iOS

```bash
# Build de test
eas build --platform ios --profile preview

# Build de production
eas build --platform ios --profile production
```

### 4. Soumission à l'App Store

```bash
# Soumettre à l'App Store
eas submit --platform ios

# Ou manuellement via Xcode
# 1. Télécharger le fichier .ipa
# 2. Ouvrir avec Xcode
# 3. Utiliser Application Loader ou Xcode Organizer
```

### 5. Processus de review Apple

- [ ] Remplir les métadonnées de l'app
- [ ] Ajouter les captures d'écran
- [ ] Définir les catégories et mots-clés
- [ ] Configurer les prix et disponibilité
- [ ] Soumettre pour review (2-7 jours)

## 🤖 Déploiement Android (Google Play Store)

### 1. Configuration Google Play Console

1. **Créer une application**
   - Aller sur [Google Play Console](https://play.google.com/console)
   - Créer une nouvelle application
   - Remplir les informations de base

2. **Configurer les services**
   - Activer Google Play Services
   - Configurer les permissions
   - Définir les politiques de confidentialité

### 2. Configuration EAS pour Android

```bash
# Configurer les credentials Android
eas credentials

# Sélectionner Android
# Choisir "Set up new Android credentials"
# Générer une clé de signature
```

### 3. Build Android

```bash
# Build de test
eas build --platform android --profile preview

# Build de production
eas build --platform android --profile production
```

### 4. Soumission au Google Play Store

```bash
# Soumettre au Google Play Store
eas submit --platform android

# Ou manuellement
# 1. Télécharger le fichier .aab
# 2. Aller sur Google Play Console
# 3. Créer une nouvelle release
# 4. Uploader le fichier .aab
```

### 5. Processus de review Google

- [ ] Remplir les métadonnées de l'app
- [ ] Ajouter les captures d'écran
- [ ] Définir les catégories et mots-clés
- [ ] Configurer les prix et disponibilité
- [ ] Soumettre pour review (1-3 jours)

## 🔧 Configuration des profils de build

### eas.json

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## 📊 Monitoring et Analytics

### 1. Configuration des analytics

```bash
# Installer les packages d'analytics
npm install @expo/analytics
npm install expo-analytics-segment
```

### 2. Configuration des crash reports

```bash
# Installer Sentry
npm install @sentry/react-native
```

### 3. Configuration des notifications push

```bash
# Installer les packages de notifications
npm install expo-notifications
npm install expo-device
```

## 🚨 Gestion des erreurs

### Erreurs communes

1. **Erreur de certificat iOS**
   ```bash
   # Régénérer les certificats
   eas credentials --clear-credentials
   eas credentials
   ```

2. **Erreur de signature Android**
   ```bash
   # Régénérer la clé de signature
   eas credentials --clear-credentials
   eas credentials
   ```

3. **Erreur de build**
   ```bash
   # Nettoyer le cache
   eas build --clear-cache
   ```

## 📈 Optimisation des performances

### 1. Optimisation des images

```bash
# Optimiser les images
npx expo install expo-image
```

### 2. Optimisation du bundle

```bash
# Analyser la taille du bundle
eas build --platform all --profile production --analyze
```

### 3. Configuration des métadonnées

```json
{
  "expo": {
    "name": "Yukpomnang",
    "slug": "yukpomnang-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    }
  }
}
```

## 🔄 Mises à jour

### 1. Mises à jour OTA (Over-The-Air)

```bash
# Publier une mise à jour
eas update --branch production --message "Bug fixes and improvements"
```

### 2. Mises à jour natives

```bash
# Build une nouvelle version
eas build --platform all --profile production
```

## 📞 Support

### Ressources utiles

- [Documentation Expo](https://docs.expo.dev/)
- [Documentation EAS](https://docs.expo.dev/build/introduction/)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

### Contact

- **Email** : dev@yukpomnang.com
- **Slack** : #mobile-team
- **GitHub** : [yukpomnang/mobile](https://github.com/yukpomnang/mobile)

---

**Bon déploiement ! 🚀**

