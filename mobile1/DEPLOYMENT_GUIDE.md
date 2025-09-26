# 🚀 Guide de Déploiement - Yukpomnang Mobile

## 📋 Prérequis

### 1. Comptes Requis
- [ ] **Expo Account** : [expo.dev](https://expo.dev)
- [ ] **Apple Developer** : [developer.apple.com](https://developer.apple.com) (99$/an)
- [ ] **Google Play Console** : [play.google.com/console](https://play.google.com/console) (25$ une fois)

### 2. Outils Installés
- [ ] **Node.js** (v18+)
- [ ] **Expo CLI** : `npm install -g @expo/cli`
- [ ] **EAS CLI** : `npm install -g eas-cli`
- [ ] **Git** (pour le versioning)

### 3. Configuration Initiale
```bash
# Se connecter à Expo
expo login

# Se connecter à EAS
eas login

# Configurer le projet
eas build:configure
```

## 🔧 Configuration du Projet

### 1. Configuration EAS
Le fichier `eas.json` est déjà configuré avec :
- **Development** : Build de développement
- **Preview** : Build de test (TestFlight/Internal Testing)
- **Production** : Build de production (App Store/Play Store)

### 2. Configuration des Credentials
```bash
# Configurer les credentials iOS
eas credentials

# Configurer les credentials Android
eas credentials --platform android
```

### 3. Variables d'Environnement
```bash
# Créer le fichier .env
cp config.env .env

# Modifier selon votre configuration
nano .env
```

## 📱 Déploiement iOS (App Store)

### Étape 1: Préparation
```bash
# Vérifier la configuration
eas build:configure --platform ios

# Vérifier les credentials
eas credentials --platform ios
```

### Étape 2: Build de Production
```bash
# Build pour iOS
eas build --platform ios --profile production

# Ou utiliser le script PowerShell
./scripts/build.ps1 -Platform ios -Profile production
```

### Étape 3: Soumission à l'App Store
```bash
# Soumettre à l'App Store
eas submit --platform ios

# Ou utiliser le script PowerShell
./scripts/submit.ps1 -Platform ios
```

### Étape 4: Processus App Store
1. **Build terminé** → Téléchargement automatique
2. **App Store Connect** → Vérification automatique
3. **Review Apple** → 24-48h (première soumission)
4. **Publication** → Automatique après approbation

## 🤖 Déploiement Android (Play Store)

### Étape 1: Préparation
```bash
# Vérifier la configuration
eas build:configure --platform android

# Vérifier les credentials
eas credentials --platform android
```

### Étape 2: Build de Production
```bash
# Build pour Android
eas build --platform android --profile production

# Ou utiliser le script PowerShell
./scripts/build.ps1 -Platform android -Profile production
```

### Étape 3: Soumission au Play Store
```bash
# Soumettre au Play Store
eas submit --platform android

# Ou utiliser le script PowerShell
./scripts/submit.ps1 -Platform android
```

### Étape 4: Processus Play Store
1. **Build terminé** → Upload automatique
2. **Play Console** → Vérification automatique
3. **Review Google** → 1-3 jours
4. **Publication** → Automatique après approbation

## 🧪 Tests et Validation

### 1. Build de Test
```bash
# Build de preview pour tests
eas build --platform all --profile preview

# Tester sur TestFlight (iOS)
# Tester sur Internal Testing (Android)
```

### 2. Tests Recommandés
- [ ] **Authentification** : Login/Register
- [ ] **Géolocalisation** : Récupération position
- [ ] **API** : Toutes les fonctionnalités
- [ ] **Navigation** : Tous les écrans
- [ ] **Performance** : Temps de chargement
- [ ] **Compatibilité** : Différents appareils

## 🔄 Mises à Jour

### 1. Mise à Jour du Code
```bash
# Modifier le code
# Commiter les changements
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push

# Build et déploiement
eas build --platform all --profile production
eas submit --platform all
```

### 2. Mise à Jour des Dependencies
```bash
# Mettre à jour les packages
npm update

# Vérifier les breaking changes
npm audit

# Rebuild si nécessaire
eas build --platform all --profile production
```

## 📊 Monitoring et Analytics

### 1. Expo Analytics
- **Builds** : Suivi des builds
- **Errors** : Gestion des erreurs
- **Performance** : Métriques de performance

### 2. App Store Analytics
- **Downloads** : Téléchargements
- **Reviews** : Avis utilisateurs
- **Crashes** : Rapports de crash

## 🚨 Dépannage

### Problèmes Courants

#### 1. Build Échoue
```bash
# Vérifier les logs
eas build:list

# Vérifier la configuration
eas build:configure

# Nettoyer le cache
eas build --clear-cache
```

#### 2. Credentials Problématiques
```bash
# Réinitialiser les credentials
eas credentials --clear-credentials

# Reconfigurer
eas credentials
```

#### 3. Soumission Échoue
```bash
# Vérifier les métadonnées
eas submit --platform ios --latest

# Vérifier les screenshots
eas submit --platform android --latest
```

## 📈 Optimisation

### 1. Performance
- **Bundle Size** : Optimiser la taille
- **Loading Time** : Réduire les temps de chargement
- **Memory Usage** : Optimiser l'utilisation mémoire

### 2. App Store Optimization (ASO)
- **Keywords** : Mots-clés pertinents
- **Screenshots** : Images attractives
- **Description** : Description claire
- **Reviews** : Gestion des avis

## 🔒 Sécurité

### 1. Code Signing
- **iOS** : Certificats Apple
- **Android** : Keystore sécurisé

### 2. API Security
- **HTTPS** : Obligatoire en production
- **JWT** : Tokens sécurisés
- **Rate Limiting** : Limitation des requêtes

## 📞 Support

### Ressources
- **Expo Docs** : [docs.expo.dev](https://docs.expo.dev)
- **EAS Docs** : [docs.expo.dev/build](https://docs.expo.dev/build)
- **Apple Developer** : [developer.apple.com](https://developer.apple.com)
- **Google Play** : [support.google.com/googleplay](https://support.google.com/googleplay)

### Contact
- **Email** : support@yukpomnang.com
- **Discord** : [Serveur Yukpomnang](https://discord.gg/yukpomnang)
- **GitHub** : [Issues](https://github.com/yukpomnang/mobile/issues)

