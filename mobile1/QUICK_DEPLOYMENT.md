# 🚀 Déploiement Rapide - Yukpomnang Mobile

## 📱 Option 1: Expo Go (Recommandé pour les tests)

### Avantages
- ✅ **Gratuit** et facile d'accès
- ✅ **Pas de build** nécessaire
- ✅ **Tests instantanés** sur votre téléphone
- ✅ **Partage facile** avec d'autres testeurs

### Étapes
1. **Installer Expo Go** sur votre téléphone :
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Déployer l'application** :
   ```bash
   cd mobile
   .\scripts\deploy-expo-go.ps1
   ```

3. **Scanner le QR code** avec Expo Go

4. **Tester l'application** sur votre téléphone

### URL d'accès
- **Expo Go**: Scannez le QR code
- **Web**: Lien fourni dans le terminal

---

## 🏗️ Option 2: EAS Build (Build natif)

### Avantages
- ✅ **Application native** (APK/IPA)
- ✅ **Performance optimale**
- ✅ **Pas besoin d'Expo Go**
- ✅ **Distribution facile**

### Étapes
1. **Configurer EAS** :
   ```bash
   cd mobile
   npm install -g eas-cli
   eas login
   ```

2. **Déployer l'application** :
   ```bash
   .\scripts\deploy-eas-build.ps1 -Platform android -Profile preview
   ```

3. **Télécharger l'APK** depuis le lien fourni

4. **Installer sur votre téléphone**

### URL d'accès
- **APK**: Lien de téléchargement fourni après le build
- **TestFlight**: Pour iOS (nécessite un compte Apple Developer)

---

## 🔧 Configuration des Clés API

### 1. Copier le fichier de configuration
```bash
cd mobile
copy mobile.env .env
```

### 2. Configurer les clés API dans `.env`
```bash
# API Backend (OBLIGATOIRE)
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com

# Google Translate (OBLIGATOIRE)
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here

# Google Maps (OBLIGATOIRE)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# WebSocket (OBLIGATOIRE)
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com/ws
```

### 3. Obtenir les clés API
- **Google Translate**: [Google Cloud Console](https://console.cloud.google.com/)
- **Google Maps**: [Google Cloud Console](https://console.cloud.google.com/)

---

## 📱 Test de l'Application

### Fonctionnalités à tester
- [ ] **Authentification** : Login/Register
- [ ] **Géolocalisation** : Récupération de position
- [ ] **Services** : Liste et recherche
- [ ] **Chat IA** : Interaction avec l'IA
- [ ] **Navigation** : Tous les écrans
- [ ] **Performance** : Temps de chargement

### En cas de problème
1. **Vérifiez la connexion réseau**
2. **Consultez les logs** dans le terminal
3. **Redémarrez l'application**
4. **Vérifiez les clés API**

---

## 🔗 Liens Utiles

### Applications
- **Expo Go iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Expo Go Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Documentation
- **Expo**: [docs.expo.dev](https://docs.expo.dev)
- **EAS Build**: [docs.expo.dev/build](https://docs.expo.dev/build)
- **React Native**: [reactnative.dev](https://reactnative.dev)

### Support
- **Email**: support@yukpomnang.com
- **Discord**: [Serveur Yukpomnang](https://discord.gg/yukpomnang)
- **GitHub**: [Issues](https://github.com/yukpomnang/mobile/issues)

---

## 🎯 Prochaines Étapes

### Après les tests
1. **Corriger les bugs** identifiés
2. **Optimiser les performances**
3. **Ajouter des fonctionnalités**
4. **Préparer la production**

### Déploiement en production
1. **Configurer les credentials** iOS/Android
2. **Build de production** avec EAS
3. **Soumettre aux stores** (App Store/Play Store)
4. **Monitorer les performances**

---

## 💡 Conseils

### Pour les développeurs
- **Utilisez Expo Go** pour les tests rapides
- **Utilisez EAS Build** pour les tests approfondis
- **Testez sur différents appareils**
- **Vérifiez les permissions**

### Pour les testeurs
- **Téléchargez Expo Go** pour les tests
- **Testez toutes les fonctionnalités**
- **Signalez les bugs** avec des captures d'écran
- **Testez la connectivité** en différents endroits

---

## 🚨 Dépannage

### Problèmes courants
1. **QR code ne fonctionne pas** : Vérifiez le réseau WiFi
2. **Application ne se charge pas** : Vérifiez les clés API
3. **Géolocalisation ne fonctionne pas** : Vérifiez les permissions
4. **Chat IA ne répond pas** : Vérifiez la connexion WebSocket

### Solutions
1. **Redémarrez l'application**
2. **Vérifiez la connexion Internet**
3. **Consultez les logs** dans le terminal
4. **Contactez le support** si nécessaire

