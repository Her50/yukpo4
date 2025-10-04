# Yukpomnang Mobile

Application mobile pour Yukpomnang construite avec React Native et Expo SDK 51.

## 🚀 Technologies

- **React Native**: 0.75.4
- **React**: 18.3.1
- **Expo SDK**: 51.0.0
- **TypeScript**: 5.3.0
- **React Navigation**: 6.x
- **React Native Maps**: 1.18.0
- **React Native Paper**: 5.12.5

## 📱 Fonctionnalités

- ✅ Authentification sécurisée
- ✅ Recherche et création de services
- ✅ Géolocalisation avec carte interactive
- ✅ Support multimédia (photos, audio, documents)
- ✅ Chat en temps réel
- ✅ Notifications push
- ✅ Gestion du profil utilisateur
- ✅ Historique des transactions
- ✅ Mode hors ligne

## 🛠️ Installation

1. Cloner le repository
```bash
git clone https://github.com/yourusername/yukpomnang.git
cd yukpomnang/mobile
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env
# Éditer .env avec vos clés API
```

## 🏃‍♂️ Développement

### Démarrer le serveur de développement
```bash
npx expo start
```

### Lancer sur Android
```bash
npx expo run:android
```

### Lancer sur iOS
```bash
npx expo run:ios
```

## 🏗️ Build

### Build de preview (APK)
```bash
npx eas build --platform android --profile preview
```

### Build de production
```bash
npx eas build --platform all --profile production
```

## 📁 Structure du projet

```
mobile/
├── src/
│   ├── components/     # Composants réutilisables
│   ├── screens/        # Écrans de l'application
│   ├── navigation/     # Configuration de navigation
│   ├── services/       # Services API et utilitaires
│   ├── contexts/       # Contextes React
│   ├── theme/          # Thème et styles globaux
│   └── utils/          # Fonctions utilitaires
├── assets/             # Images et ressources
├── app.json            # Configuration Expo
├── eas.json            # Configuration EAS Build
├── babel.config.js     # Configuration Babel
├── metro.config.js     # Configuration Metro
├── tsconfig.json       # Configuration TypeScript
└── package.json        # Dépendances et scripts
```

## 🔑 Variables d'environnement

```env
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
EXPO_PUBLIC_ENVIRONMENT=production
```

## 🧪 Tests

```bash
npm test
```

## 📝 Licence

Ce projet est sous licence MIT.
