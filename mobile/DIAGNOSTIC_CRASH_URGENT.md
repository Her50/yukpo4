# 🚨 DIAGNOSTIC CRASH URGENT - 22 OCTOBRE 2025

Le crash persiste. Voici la procédure de diagnostic complète.

---

## 🔍 ÉTAPE 1 : TEST VERSION ULTRA MINIMALE

### Remplacer temporairement App.tsx

```powershell
# Dans mobile/
# Sauvegarder l'actuel
cp App.tsx App.BACKUP.tsx

# Utiliser la version minimale
cp App.ULTRA_MINIMAL.tsx App.tsx

# Relancer
npx expo start -c
```

**Si ça marche** : Le problème vient d'un provider/composant
**Si ça crash** : Problème de dépendances ou configuration

---

## 🔍 ÉTAPE 2 : RÉCUPÉRER LES LOGS EXACTS

### Dans le terminal Metro/Expo :

1. **Arrêter l'app** : Ctrl+C
2. **Relancer avec logs détaillés** :
```powershell
npx expo start -c --no-dev --minify
```

3. **Copier les 20 dernières lignes avant le crash**

**Ou utiliser adb pour Android** :
```powershell
adb logcat -s ReactNativeJS:* *:E | tee crash_log.txt
```

---

## 🔍 ÉTAPE 3 : INFORMATIONS À FOURNIR

### Copier-coller ces informations :

```
🔴 CRASH REPORT

1. MOMENT DU CRASH:
   [X] Démarrage immédiat (écran blanc)
   [ ] Après X secondes
   [ ] Lors de la navigation vers [nom écran]
   [ ] Lors d'une action spécifique

2. MESSAGE D'ERREUR EXACT:
[Copier-coller ici l'erreur complète]

3. STACK TRACE:
[Copier-coller la stack trace complète]

4. LOGS METRO (20 dernières lignes):
[Copier-coller les logs]

5. PLATEFORME:
   [ ] Android Emulator
   [ ] Android Physical Device
   [ ] iOS Simulator
   [ ] iOS Physical Device
   [ ] Web
   [ ] Expo Go

6. VERSIONS:
   - Node: [node --version]
   - Expo: [npx expo --version]
   - React Native: [voir package.json]
```

---

## 🔧 SOLUTIONS RAPIDES À TESTER

### Solution 1 : Nettoyer complètement

```powershell
cd mobile

# Supprimer tout le cache
rm -rf node_modules
rm -rf .expo
rm -rf .expo-shared
rm package-lock.json

# Réinstaller
npm install

# Lancer proprement
npx expo start -c
```

---

### Solution 2 : Revenir à la version stable 18/10

```powershell
# Copier App.tsx depuis version stable
cp C:\Users\23767\yukpomnang18102025\mobile\App.tsx C:\Users\23767\yukpomnang\mobile\App.tsx

# Relancer
npx expo start -c
```

---

### Solution 3 : Mode Web (pour tester)

```powershell
# Lancer en mode web seulement
npx expo start --web
```

**Si web fonctionne** : Problème spécifique mobile (native modules)
**Si web crash** : Problème de code/logique

---

## 🎯 DIAGNOSTIC PAR ÉLIMINATION

### Test 1 : App Ultra Minimal
```typescript
// Si l'app ultra minimale fonctionne, tester en ajoutant progressivement:

// 1. Ajouter ErrorBoundary
<ErrorBoundary>
  <View>...</View>
</ErrorBoundary>

// 2. Ajouter PaperProvider
<PaperProvider theme={theme}>
  ...
</PaperProvider>

// 3. Ajouter AuthProvider
<AuthProvider>
  ...
</AuthProvider>

// etc.
```

---

## 💡 CAUSES PROBABLES

### Si crash au démarrage immédiat:

1. ❌ **Import qui échoue**
   - Vérifier tous les imports dans App.tsx
   - Un module manquant ou corrompu

2. ❌ **Provider qui crash à l'init**
   - LanguageProvider qui tente d'accéder au GPS
   - AuthProvider qui tente de lire AsyncStorage
   - LocationProvider qui demande permissions

3. ❌ **Dépendance manquante/incompatible**
   - expo-location mal installée
   - react-native-paper problème
   - @react-navigation/native version

### Si crash après quelques secondes:

4. ❌ **useEffect qui boucle**
   - Hook avec dépendances instables
   - Timer non nettoyé

5. ❌ **API call qui échoue**
   - Backend inaccessible
   - Token invalide

---

## 🔥 ACTION IMMÉDIATE RECOMMANDÉE

### 1. Tester App Ultra Minimal

```powershell
cd mobile
cp App.ULTRA_MINIMAL.tsx App.tsx
npx expo start -c
```

**RÉSULTAT** :
- ✅ Fonctionne → Le problème vient d'un provider
- ❌ Crash → Problème de dépendances

---

### 2. Si ultra minimal fonctionne, tester progressivement

**App.tsx Version 1** (Ajouter ErrorBoundary) :
```typescript
<ErrorBoundary>
  <View>...</View>
</ErrorBoundary>
```

**App.tsx Version 2** (Ajouter Paper + SafeArea) :
```typescript
<SafeAreaProvider>
  <PaperProvider theme={theme}>
    ...
  </PaperProvider>
</SafeAreaProvider>
```

**App.tsx Version 3** (Ajouter Auth uniquement) :
```typescript
<AuthProvider>
  ...
</AuthProvider>
```

**Etc.**

---

### 3. Me fournir les logs

**Format** :
```
🔴 LOGS DU CRASH

[Metro/Expo logs ici]

---

🔴 ERREUR EXACTE

[Message d'erreur ici]

---

🔴 STACK TRACE

[Stack trace complète ici]
```

---

## 📞 PROCHAINES ÉTAPES

1. ✅ Tester App Ultra Minimal
2. ✅ Copier-coller les logs d'erreur EXACTS
3. ✅ Indiquer le moment précis du crash
4. ✅ Me fournir toutes les infos ci-dessus

**Avec ces informations, je pourrai identifier le problème exact !**

---

**Date**: 22 Octobre 2025  
**Status**: 🔴 En cours de diagnostic


