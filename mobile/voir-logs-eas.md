# 📱 Voir les Logs avec EAS Build

## 🎯 Vous utilisez EAS Build (Build en ligne)

Quand vous faites `npx eas build --platform android`, vous créez un APK qui sera installé sur votre téléphone. Les logs ne sont **pas** visibles dans la console comme avec `expo start`.

## 📊 3 Façons de Voir les Logs

### Option 1 : Logs de Construction EAS ⚙️

Ces logs montrent si la **compilation** a réussi, mais pas ce qui se passe dans l'app.

```bash
# Voir les logs du dernier build
npx eas build:list

# Puis ouvrir le build dans le navigateur
# Cliquez sur le lien du build pour voir les logs complets
```

**Ce que vous verrez :**
- ✅ Erreurs de compilation TypeScript
- ✅ Erreurs de dépendances
- ❌ Pas les logs de l'app en cours d'exécution

### Option 2 : Logs de l'Application Installée (ADB) 📱

Une fois l'APK installé sur votre téléphone, vous pouvez voir les logs avec Android Debug Bridge (ADB).

#### Installer ADB (si pas déjà fait)

```powershell
# Télécharger ADB depuis :
# https://developer.android.com/studio/releases/platform-tools

# Ou installer via chocolatey
choco install adb
```

#### Voir les logs en temps réel

```powershell
# Connecter votre téléphone en USB avec débogage USB activé

# Vérifier que le téléphone est détecté
adb devices

# Voir TOUS les logs en temps réel
adb logcat

# Filtrer uniquement les logs React Native
adb logcat *:S ReactNative:V ReactNativeJS:V

# Filtrer pour voir vos console.log
adb logcat | findstr "AuthContext\|AppNavigator\|LoginScreen"
```

#### Activer le Débogage USB sur votre téléphone

1. Allez dans **Paramètres** → **À propos du téléphone**
2. Tapez 7 fois sur **Numéro de build**
3. Retournez et allez dans **Options pour développeurs**
4. Activez **Débogage USB**
5. Connectez le téléphone à votre PC avec un câble USB

### Option 3 : Build de Développement avec Logs Visibles 🔧

Créer une version qui affiche les logs à l'écran.

#### Étape 1 : Créer un composant de logs

Créez `mobile/src/components/DevLogs.tsx` :

```typescript
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const DevLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Intercepter console.log
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('[AuthContext]') || 
          message.includes('[AppNavigator]') || 
          message.includes('[LoginScreen]')) {
        setLogs(prev => [...prev.slice(-50), {
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message
        }]);
      }
    };

    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev.slice(-50), {
        timestamp: new Date().toLocaleTimeString(),
        level: 'error',
        message: args.join(' ')
      }]);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  if (logs.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Dev Logs</Text>
      <ScrollView style={styles.scrollView}>
        {logs.map((log, index) => (
          <View key={index} style={styles.logEntry}>
            <Text style={styles.timestamp}>{log.timestamp}</Text>
            <Text style={[
              styles.message,
              log.level === 'error' && styles.error,
              log.level === 'warn' && styles.warn
            ]}>
              {log.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
    zIndex: 9999,
  },
  title: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scrollView: {
    flex: 1,
  },
  logEntry: {
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  timestamp: {
    color: '#888',
    fontSize: 10,
  },
  message: {
    color: '#0f0',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  error: {
    color: '#f44',
  },
  warn: {
    color: '#fa0',
  },
});

export default DevLogs;
```

#### Étape 2 : Ajouter DevLogs à App.tsx

```typescript
// Dans mobile/App.tsx
import DevLogs from './src/components/DevLogs';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <GlobalIAStatsProvider>
                <NavigationContainer>
                  <StatusBar style="auto" />
                  <AppNavigator />
                  
                  {/* AJOUTER ICI - Logs visibles en bas de l'écran */}
                  {__DEV__ && <DevLogs />}
                </NavigationContainer>
              </GlobalIAStatsProvider>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

#### Étape 3 : Rebuild avec EAS

```bash
npx eas build --platform android --profile preview --non-interactive
```

Maintenant vous verrez les logs **directement dans l'app** en bas de l'écran ! 📱

### Option 4 : Utiliser Expo Go pour Débugger d'abord 🚀

**La meilleure approche** : Débugger avec Expo Go AVANT de faire un build EAS.

```bash
# 1. Lancer en mode développement
npx expo start

# 2. Scanner le QR code avec Expo Go
# 3. Tester la connexion
# 4. Voir les logs dans la console
# 5. Une fois que ça marche, faire le build EAS
```

**Avantages :**
- ✅ Logs en temps réel dans la console
- ✅ Hot reload (modifications instantanées)
- ✅ Pas besoin de rebuilder à chaque test
- ✅ Débogage plus rapide

**Inconvénient :**
- ❌ Nécessite Expo Go installé sur le téléphone

## 🎯 Ma Recommandation

1. **Utilisez Expo Go d'abord** pour débugger la connexion
2. Une fois que ça marche dans Expo Go, faites le build EAS

### Étapes :

```bash
# 1. Lancer en mode dev
cd mobile
npx expo start --clear

# 2. Sur votre téléphone :
#    - Installez Expo Go depuis le Play Store
#    - Scannez le QR code
#    - Testez la connexion

# 3. Dans la console PC, vous verrez TOUS les logs
#    Cherchez : [AuthContext], [AppNavigator], etc.

# 4. Une fois que la connexion marche, faites le build
npx eas build --platform android --profile preview
```

## 📱 Si vous voulez quand même utiliser EAS Build directement

Ajoutez le composant `DevLogs` que j'ai créé ci-dessus. Vous verrez les logs en bas de l'écran dans l'APK installé.

## ⚡ Commande Rapide pour Voir les Logs (via ADB)

Une fois l'APK installé et l'app lancée :

```powershell
# Ouvrez un PowerShell et lancez :
adb logcat *:S ReactNative:V ReactNativeJS:V | Select-String "AuthContext|AppNavigator|LoginScreen"
```

Vous verrez les logs en temps réel ! 📊

---

**Question : Voulez-vous que je :**
1. ✅ Créer le composant DevLogs pour voir les logs dans l'APK ?
2. ✅ Vous aider à débugger avec Expo Go d'abord ?
3. ✅ Vous donner les commandes ADB exactes ?


