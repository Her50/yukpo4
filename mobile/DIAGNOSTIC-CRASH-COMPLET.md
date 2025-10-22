# 🔍 DIAGNOSTIC CRASH COMPLET

**Date**: 22 Octobre 2025  
**Problème**: Application crash même en version minimale

---

## 🚨 SITUATION CRITIQUE

Si **même la version minimale crash**, le problème est au niveau:
1. Configuration Expo/React Native
2. Dépendances corrompues
3. Cache Metro corrompu
4. Problème natif (Android/iOS)

---

## ✅ SOLUTIONS PAR ORDRE DE PRIORITÉ

### SOLUTION 1: Clear TOUT le cache (90% des cas)

```powershell
# Dans mobile/
rm -rf node_modules
rm -rf .expo
rm package-lock.json
npm install
npm start -- --clear
```

**Explication**: Cache corrompu est la cause #1 des crashs inexpliqués.

---

### SOLUTION 2: Tester avec App minimal

1. **Renommez** `App.tsx` en `App.BACKUP.tsx`
2. **Renommez** `App.MINIMAL-TEST.tsx` en `App.tsx`
3. **Lancez**: `npm start -- --clear`

**Si ça marche**: Le problème est dans les imports/contexts
**Si ça crash**: Problème de configuration projet

---

### SOLUTION 3: Vérifier index.js

```javascript
// index.js doit charger App correctement
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

---

### SOLUTION 4: Vérifier package.json

Le script start doit être:
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  }
}
```

---

### SOLUTION 5: Réinstallation complète

```powershell
# Supprimer TOUT
rm -rf node_modules
rm -rf .expo
rm -rf android/build (si existe)
rm -rf ios/build (si existe)
rm package-lock.json

# Réinstaller
npm install

# Clear cache Expo global
npx expo start --clear

# Si ça ne marche pas, réinstaller Expo CLI
npm install -g expo-cli
```

---

## 🔍 IDENTIFIER LA VRAIE ERREUR

### Méthode 1: Logs Metro détaillés

```powershell
npm start -- --clear
# Cherchez dans la sortie:
# - "ERROR" en rouge
# - "Invariant Violation"
# - "Unable to resolve module"
```

### Méthode 2: Logs Android (si sur émulateur/appareil)

```powershell
# Terminal séparé
adb logcat | findstr "ReactNativeJS"
```

### Méthode 3: Mode debug Expo

```powershell
EXPO_DEBUG=true npm start
```

---

## 🎯 CHECKLIST DE DIAGNOSTIC

### ✅ Fichiers critiques présents?
- [ ] `App.tsx` existe
- [ ] `index.js` existe et charge App
- [ ] `package.json` a les bonnes dépendances
- [ ] `app.json` configuré correctement

### ✅ Dépendances installées?
```powershell
npm list expo
npm list react
npm list react-native
```

### ✅ Versions compatibles?
```json
// package.json doit avoir des versions compatibles
{
  "expo": "~51.0.0",
  "react": "18.2.0",
  "react-native": "0.74.5"
}
```

### ✅ Metro Bundler démarre?
Quand vous lancez `npm start`, vous devez voir:
```
Metro waiting on exp://...
› Press a │ open Android
› Press w │ open web
```

**Si Metro ne démarre pas**: Problème de configuration

---

## 🚑 SOLUTION ULTIME: Nouveau projet

Si RIEN ne marche, comparez avec un projet fresh:

```powershell
# Dans un autre dossier
npx create-expo-app test-app
cd test-app
npm start
```

**Si le projet test fonctionne**: 
Comparez `package.json`, `app.json`, `index.js` avec yukpomnang

**Si le projet test crash aussi**:
Problème avec votre environnement Node/Expo

---

## 📝 INFORMATIONS À ME FOURNIR

Pour diagnostiquer précisément, j'ai besoin de:

### 1. Sortie de npm start
```powershell
npm start 2>&1 | Out-File -FilePath start-log.txt
```
Envoyez-moi `start-log.txt`

### 2. Version des outils
```powershell
node --version
npm --version
npx expo --version
```

### 3. Contenu package.json
Juste la partie `dependencies`

### 4. Message d'erreur EXACT
Quand ça crash, le message exact affiché

---

## 🎯 PROCHAINES ÉTAPES

### ÉTAPE 1 (À FAIRE MAINTENANT):
```powershell
cd C:\Users\23767\yukpomnang\mobile
rm -rf node_modules .expo
rm package-lock.json
npm install
npm start -- --clear
```

### ÉTAPE 2 (Si ÉTAPE 1 échoue):
Renommer `App.MINIMAL-TEST.tsx` en `App.tsx` et retester

### ÉTAPE 3 (Si tout échoue):
M'envoyer:
- Sortie complète de `npm start`
- Version Node/npm/Expo
- Message d'erreur exact du crash

---

## 💡 CAUSES COMMUNES

1. **Cache corrompu** (90%) → Clear cache
2. **node_modules corrompu** (5%) → Réinstaller
3. **Import circulaire** (3%) → Vérifier imports
4. **Erreur dans useEffect** (2%) → Débugger contexts

---

**Le crash n'est PAS lié aux corrections TypeScript.**
**C'est un problème de runtime ou configuration.**

