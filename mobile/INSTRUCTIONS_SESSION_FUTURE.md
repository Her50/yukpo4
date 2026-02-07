# 📋 INSTRUCTIONS POUR SESSION FUTURE

## 🎯 Objectif

**Résoudre le problème de build Android avec Expo SDK 52 sans tourner en rond**

### Version cible
- **Expo SDK 52** (retour après tests SDK 50/51 - tous échoués)

## 📖 Lire d'abord

1. **`PROMPT_SESSION_FUTURE.md`** - Description complète de tous les problèmes et solutions testées
2. **`RESUME_FINAL_SESSION.md`** - Résumé de cette session

## 🚫 NE PAS FAIRE

- ❌ Modifier `expo-modules-core/android/build.gradle`
- ❌ Créer des patches pour expo-modules-core
- ❌ Modifier `ExpoModulesCorePlugin.gradle`
- ❌ Ajouter des scripts init.gradle complexes
- ❌ Tester les mêmes solutions déjà testées (voir PROMPT_SESSION_FUTURE.md)

## ✅ À FAIRE

### 1. Explorer EAS Build
```bash
eas build --platform android
```
- Configuration cloud différente
- Peut résoudre les problèmes d'ordre d'évaluation Gradle

### 2. Créer projet Expo vierge
```bash
npx create-expo-app@latest test-expo --template blank
cd test-expo
npx expo run:android
```
- Comparer `settings.gradle` avec notre projet
- Identifier les différences

### 3. Utiliser prebuild --clean
```bash
cd mobile
npx expo prebuild --clean --platform android
```
- Régénère tous les fichiers Android natifs
- Peut corriger les configurations incorrectes

### 4. Vérifier dépendances conflictuelles
- `@config-plugins/react-native-webrtc` requiert SDK 51
- Override `expo-modules-core` peut causer des conflits
- Vérifier `npm ls` pour les conflits

### 5. Vérifier scripts postinstall
- `mobile/postinstall.js` peut modifier expo-modules-core
- Désactiver temporairement et tester

### 6. Vérifier versions Gradle/AGP
- Gradle 8.10.2 et AGP 8.6.0
- Vérifier compatibilité avec Expo SDK 50/51/52
- Tester avec versions recommandées par Expo

## 📝 Notes importantes

- **TOUS les SDK Expo testés (50, 51, 52) échouent**
- Le problème n'est **PAS** spécifique à une version
- Il faut explorer des solutions **complètement différentes**
- Ne pas répéter les solutions déjà testées

## 🎯 Résultat attendu

**Un build Android qui fonctionne avec Expo SDK 52 sans modifications de expo-modules-core**

### Version cible
- **Expo SDK 52** (version actuelle du projet)

---

**Bon courage pour la prochaine session !** 🚀

