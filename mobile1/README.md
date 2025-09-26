# 📱 Yukpomnang Mobile

Application mobile React Native pour la plateforme Yukpomnang, compatible iOS et Android.

## 🚀 Démarrage Rapide

### Option 1: Expo Go (Recommandé pour les tests)
```bash
# Démarrer l'application
.\scripts\start-app.ps1

# Ou manuellement
npm install
npx expo start --tunnel
```

### Option 2: EAS Build (Build natif)
```bash
# Build pour Android
.\scripts\deploy-eas-build.ps1 -Platform android -Profile preview

# Build pour iOS
.\scripts\deploy-eas-build.ps1 -Platform ios -Profile preview
```

## 📱 Installation d'Expo Go

- **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

## 🔧 Configuration

1. **Copier le fichier de configuration** :
   ```bash
   copy mobile.env .env
   ```

2. **Configurer les clés API** dans `.env` :
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
   EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=your_key_here
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
   ```

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:coverage

# Vérification TypeScript
npm run type-check

# Linting
npm run lint
```

## 📚 Documentation

- [Guide de déploiement rapide](QUICK_DEPLOYMENT.md)
- [Configuration des clés API](API_CONFIGURATION.md)
- [Guide de test](TEST_GUIDE.md)
- [Guide de déploiement complet](DEPLOYMENT_GUIDE.md)

## 🔗 Liens Utiles

- [Expo](https://expo.dev)
- [React Native](https://reactnative.dev)
- [EAS Build](https://docs.expo.dev/build)
- [EAS Submit](https://docs.expo.dev/submit)

## 📞 Support

- Email: support@yukpomnang.com
- Discord: [Serveur Yukpomnang](https://discord.gg/yukpomnang)
- GitHub: [Issues](https://github.com/yukpomnang/mobile/issues)