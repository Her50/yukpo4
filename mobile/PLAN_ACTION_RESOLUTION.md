# 🎯 PLAN D'ACTION - Résolution des problèmes Expo SDK Android

## 📊 Problèmes identifiés

1. **Conflit de version** : `@config-plugins/react-native-webrtc@^9.0.0` requiert Expo SDK 51, mais projet sur SDK 52
   - ⚠️ **IMPORTANT** : Ce package n'est PAS utilisé dans `app.config.js` (pas dans la liste des plugins)
   - ✅ **Solution possible** : Supprimer ce package s'il n'est pas nécessaire

2. **Patches expo-modules-core** : Contre-indiqués selon PROMPT_SESSION_FUTURE.md
   - Fichier : `patches/expo-modules-core+2.2.3.patch`
   - ⚠️ Ces patches peuvent causer des problèmes architecturaux

3. **Configuration mixte** : Dossiers natifs (android/ios) + app.config.js
   - expo-doctor signale un problème de configuration

## ✅ Solutions à tester (par ordre de priorité)

### Solution 1 : Nettoyer les dépendances inutiles (RECOMMANDÉ EN PREMIER)

**Action** :
1. Vérifier si `@config-plugins/react-native-webrtc` est vraiment nécessaire
2. Si non utilisé, le supprimer de `package.json`
3. Cela résoudra le conflit SDK 51/52

**Commandes** :
```bash
cd mobile
# Vérifier l'utilisation
grep -r "@config-plugins/react-native-webrtc" app.config.js src/
# Si non trouvé, supprimer
npm uninstall @config-plugins/react-native-webrtc
```

### Solution 2 : Tester expo prebuild --clean

**Action** :
1. Régénérer les fichiers Android natifs
2. Peut corriger les configurations incorrectes
3. **ATTENTION** : Sauvegarder les modifications personnalisées avant

**Commandes** :
```bash
cd mobile
# Sauvegarder les modifications importantes
cp android/settings.gradle android/settings.gradle.backup
cp android/build.gradle android/build.gradle.backup

# Nettoyer et régénérer
npx expo prebuild --clean --platform android
```

### Solution 3 : Supprimer les patches expo-modules-core

**Action** :
1. Supprimer le patch `patches/expo-modules-core+2.2.3.patch`
2. Modifier `postinstall.js` pour ne plus appliquer ce patch
3. Tester le build sans patch

**Risque** : Le build peut échouer, mais c'est nécessaire pour identifier le vrai problème

### Solution 4 : Tester Expo SDK 51 (si webrtc est nécessaire)

**Action** :
1. Downgrade vers Expo SDK 51
2. Compatible avec `@config-plugins/react-native-webrtc`
3. Peut résoudre les problèmes architecturaux

**Commandes** :
```bash
cd mobile
npm install expo@~51.0.0
npx expo install --fix
```

### Solution 5 : Créer un projet Expo SDK 52 vierge pour comparaison

**Action** :
1. Créer un nouveau projet Expo SDK 52
2. Comparer les fichiers `settings.gradle` et `build.gradle`
3. Identifier les différences avec notre projet

**Commandes** :
```bash
cd ..
npx create-expo-app@latest test-expo-sdk52 --template blank
cd test-expo-sdk52
npx expo prebuild --platform android
# Comparer les fichiers
```

## 🚀 Ordre d'exécution recommandé

1. ✅ **Solution 1** : Nettoyer les dépendances (le plus simple, le moins risqué)
2. ✅ **Solution 2** : Tester prebuild --clean (peut corriger beaucoup de choses)
3. ✅ **Solution 3** : Supprimer les patches (nécessaire pour identifier le vrai problème)
4. ⏳ **Solution 4** : Tester SDK 51 (si nécessaire après les autres)
5. ⏳ **Solution 5** : Comparer avec projet vierge (si les autres échouent)

## ⚠️ Notes importantes

- **Sauvegarder** tous les fichiers modifiés avant chaque test
- **Tester** chaque solution individuellement
- **Ne pas** combiner plusieurs solutions en même temps
- **Documenter** les résultats de chaque test

## 📋 État actuel

- ✅ Expo SDK 52 installé
- ✅ Patches expo-modules-core présents (à supprimer)
- ✅ Script postinstall applique les patches
- ⚠️ Conflit avec @config-plugins/react-native-webrtc (non utilisé dans app.config.js)

