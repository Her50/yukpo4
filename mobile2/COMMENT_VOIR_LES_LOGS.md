# 📱 Comment visualiser les logs de l'application mobile React Native

## Méthode 1 : Metro Bundler (Recommandé pour le développement)

Le Metro Bundler affiche automatiquement les `console.log()` dans son terminal.

### Étapes :
1. Assurez-vous que Metro est en cours d'exécution :
   ```bash
   cd mobile
   npm start
   # ou
   npx react-native start
   ```

2. Les logs s'affichent directement dans le terminal Metro

3. Pour voir les logs en détail, appuyez sur `d` dans le terminal Metro pour ouvrir le menu développeur

## Méthode 2 : React Native Debugger (Le plus complet)

### Installation :
```bash
# Windows
choco install react-native-debugger
# ou télécharger depuis https://github.com/jhen0409/react-native-debugger/releases
```

### Utilisation :
1. Lancer React Native Debugger
2. Configurer le port (par défaut 19000 pour Expo, 8081 pour React Native CLI)
3. Dans l'app mobile, secouer le téléphone ou appuyer sur `Ctrl+M` (Android) / `Cmd+D` (iOS)
4. Sélectionner "Debug" dans le menu
5. Les logs apparaissent dans la console du debugger

## Méthode 3 : Chrome DevTools

### Étapes :
1. Dans l'app mobile, ouvrir le menu développeur :
   - **Android** : Secouer le téléphone ou `Ctrl+M` ou `adb shell input keyevent 82`
   - **iOS** : Secouer le téléphone ou `Cmd+D`

2. Sélectionner "Debug"

3. Ouvrir Chrome et aller à : `chrome://inspect`

4. Cliquer sur "inspect" sous votre application

5. Les logs `console.log()` s'affichent dans l'onglet Console

## Méthode 4 : Logs natifs (Android/iOS)

### Android (Logcat) :
```bash
# Voir tous les logs
adb logcat

# Filtrer par tag ReactNativeJS
adb logcat | grep ReactNativeJS

# Sauvegarder les logs dans un fichier
adb logcat > logs_mobile.txt
```

### iOS :
```bash
# Voir les logs dans Xcode
# Xcode > Window > Devices and Simulators > Sélectionner l'appareil > Console

# Ou en ligne de commande
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "YourApp"'
```

## Méthode 5 : Expo Go (Si vous utilisez Expo)

### Étapes :
1. Lancer l'app avec Expo :
   ```bash
   npx expo start
   ```

2. Appuyer sur `m` dans le terminal pour ouvrir le menu
3. Les logs s'affichent directement dans le terminal

4. Pour des logs plus détaillés, installer Expo DevTools :
   ```bash
   npx expo start --dev-client
   ```

## Méthode 6 : Créer un Logger personnalisé (Fichier de logs)

Si vous voulez sauvegarder les logs dans un fichier :

### Installation :
```bash
npm install react-native-fs
```

### Code (mobile/src/utils/logger.ts) :
```typescript
import RNFS from 'react-native-fs';

const LOG_FILE = `${RNFS.DocumentDirectoryPath}/app_logs.txt`;

export const logger = {
  log: async (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(logMessage); // Afficher aussi dans la console
    
    try {
      await RNFS.appendFile(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
      console.error('Erreur écriture log:', error);
    }
  },
  
  getLogs: async () => {
    try {
      return await RNFS.readFile(LOG_FILE, 'utf8');
    } catch (error) {
      return 'Aucun log disponible';
    }
  },
  
  clearLogs: async () => {
    try {
      await RNFS.unlink(LOG_FILE);
    } catch (error) {
      console.error('Erreur suppression logs:', error);
    }
  }
};
```

### Utilisation :
```typescript
import { logger } from './utils/logger';

// Dans votre code
await logger.log('[HomeScreen] Recherche lancée');

// Récupérer les logs
const logs = await logger.getLogs();
console.log(logs);
```

## 🔍 Filtrer les logs pour la recherche

Pour voir uniquement les logs de recherche, utilisez ces filtres :

### Dans Metro/Terminal :
```bash
# Filtrer les logs de recherche
adb logcat | grep "\[HomeScreen\]\|\[yukpoclient\]\|\[ResultatBesoin\]"
```

### Dans Chrome DevTools :
1. Ouvrir la console
2. Utiliser le filtre : `HomeScreen|yukpoclient|ResultatBesoin`

## 📊 Activer les logs Redux DevTools (Si vous utilisez Redux)

```bash
npm install --save-dev redux-logger
```

## ⚠️ Note importante

- Les `console.log()` sont automatiquement supprimés en mode production
- Pour garder les logs en production, utilisez une bibliothèque comme `react-native-logs`
- N'oubliez pas de supprimer les logs sensibles (tokens, mots de passe, etc.)

## 🚀 Commandes rapides

```bash
# Lancer l'app et voir les logs
cd mobile
npm start

# Dans un autre terminal, voir les logs Android
adb logcat | grep ReactNativeJS

# Nettoyer et relancer
npm run android -- --reset-cache
# ou
npm run ios -- --reset-cache
```




