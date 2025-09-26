# 📱 Guide Complet - Voir les Logs de l'Application Expo

## 🎯 **Objectif**
Voir les logs de l'application mobile en temps réel pour diagnostiquer le problème d'authentification.

## 🔧 **Méthodes pour Voir les Logs**

### **1. Expo CLI (Recommandé)**

#### **Étape 1: Démarrer le serveur de développement**
```bash
cd mobile
npx expo start --tunnel
```

#### **Étape 2: Scanner le QR Code**
- Ouvrez l'app **Expo Go** sur votre téléphone
- Scannez le QR code affiché dans le terminal
- L'app se lancera avec les logs en temps réel

#### **Étape 3: Voir les Logs**
- Les logs s'affichent directement dans le terminal
- Vous verrez tous les `console.log()` de l'app
- Les erreurs sont affichées en rouge

### **2. Android Studio (Pour APK)**

#### **Étape 1: Activer le débogage USB**
1. **Paramètres** > **À propos du téléphone**
2. **Appuyez 7 fois** sur "Numéro de build"
3. **Retour** > **Options pour les développeurs**
4. **Activez "Débogage USB"**

#### **Étape 2: Connecter le téléphone**
```bash
# Vérifier la connexion
adb devices

# Voir les logs en temps réel
adb logcat | grep -E "(AuthContext|AppNavigator|Yukpomnang|ReactNative)"
```

#### **Étape 3: Filtrer les logs**
```bash
# Logs spécifiques à l'app
adb logcat | grep "yukpomnang"

# Logs d'erreurs
adb logcat | grep "ERROR"

# Logs de débogage
adb logcat | grep "DEBUG"
```

### **3. Flipper (Interface Graphique)**

#### **Étape 1: Installer Flipper**
- Téléchargez Flipper depuis [flipper.fb.com](https://flipper.fb.com)
- Installez et lancez Flipper

#### **Étape 2: Connecter l'app**
- Connectez votre téléphone via USB
- Sélectionnez votre appareil dans Flipper
- Ouvrez l'onglet "Logs"

### **4. React Native Debugger**

#### **Étape 1: Installer React Native Debugger**
```bash
npm install -g react-native-debugger
```

#### **Étape 2: Lancer le debugger**
```bash
react-native-debugger
```

#### **Étape 3: Activer le débogage**
- Secouez votre téléphone
- Appuyez sur "Debug JS Remotely"
- Les logs s'affichent dans le debugger

## 🔍 **Logs à Chercher**

### **✅ Logs de Succès (Devraient Apparaître)**
```
[AuthContext] Token reçu, décodage JWT...
[AuthContext] JWT décodé: ID=XX, Email=..., Role=user
[AuthContext] Utilisateur créé depuis JWT: {...}
[AuthContext] setUser appelé avec: {...}
[AuthContext] Re-render forcé terminé
[AppNavigator] État actuel: {user: true, loading: false, ...}
[AppNavigator] Utilisateur connecté, affichage MainStack
```

### **❌ Logs d'Erreur (Problèmes Possibles)**
```
[AuthContext] Erreur décodage JWT
[AuthContext] Token expiré
[AuthContext] Aucun token dans la réponse
[AppNavigator] État actuel: {user: false, loading: true}
[AppNavigator] Affichage LoadingScreen (en boucle)
```

### **🔍 Logs de Débogage**
```
[AuthContext] Initialisation utilisateur...
[AuthContext] Token trouvé au démarrage
[AuthContext] Utilisateur initialisé depuis token
[AppNavigator] Render #X
[AppNavigator] Mise à jour écran
```

## 🚨 **Problèmes Courants**

### **1. Pas de Logs du Tout**
- **Cause**: L'app utilise une version sans nos corrections
- **Solution**: Attendre le build EAS et installer la nouvelle APK

### **2. Logs AuthContext OK mais Pas de Navigation**
- **Cause**: Problème dans l'AppNavigator
- **Solution**: Vérifier que `useAuth()` retourne les bonnes valeurs

### **3. Erreur de Token**
- **Cause**: Problème de communication avec le backend
- **Solution**: Vérifier la connexion internet et les variables d'environnement

### **4. LoadingScreen en Boucle**
- **Cause**: `loading` reste à `true`
- **Solution**: Vérifier le timeout de sécurité dans AuthContext

## 📋 **Checklist de Débogage**

### **Avant de Commencer**
- [ ] Téléphone connecté via USB
- [ ] Débogage USB activé
- [ ] App Expo Go installée (pour développement)
- [ ] Terminal ouvert et prêt

### **Pendant le Test**
- [ ] Ouvrir l'app
- [ ] Essayer de se connecter/inscrire
- [ ] Regarder les logs en temps réel
- [ ] Noter les erreurs ou comportements inattendus

### **Après le Test**
- [ ] Copier les logs pertinents
- [ ] Identifier le problème
- [ ] Appliquer la solution appropriée

## 🎯 **Résultat Attendu**

Avec nos corrections, vous devriez voir :
1. **Au démarrage**: `[AuthContext] Initialisation utilisateur...`
2. **Pendant l'authentification**: `[AuthContext] Token reçu, décodage JWT...`
3. **Après l'authentification**: `[AppNavigator] Utilisateur connecté, affichage MainStack`
4. **Navigation**: Basculement vers HomeScreen

Si ce n'est pas le cas, le problème est dans l'application installée, pas dans notre logique ! 🎯

