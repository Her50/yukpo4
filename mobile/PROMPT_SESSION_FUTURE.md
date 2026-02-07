# 📋 PROMPT POUR SESSION FUTURE - Problèmes Expo SDK Android

## 🎯 Contexte du projet

**Projet**: Yukpomnang - Application mobile React Native avec Expo
**Repository**: `C:\Users\23767\yukpomnang2\mobile`
**Backend**: Rust/Axum (non concerné par ce problème)

## 🐛 Problème principal

**Erreur récurrente**: Build Android échoue avec Expo SDK 50/51/52
**Durée**: 5+ jours de tentatives
**Pattern**: Chaque correction amène un nouveau problème

## 📊 Historique des tests

### Expo SDK 52
- **Erreur 1**: `compileSdkVersion is not specified` quand `expo-modules-core` est inclus via `includeBuild` dans `pluginManagement`
- **Erreur 2**: `expo-module-gradle-plugin not found` quand `includeBuild` est retiré
- **Cause identifiée**: Bug architectural - `includeBuild` dans `pluginManagement` évalue le build.gradle dans un contexte où `compileSdkVersion` n'est pas reconnu

### Expo SDK 51
- **Erreur 1**: `Cannot read properties of undefined (reading '@react-native-picker/picker')` avec autolinking
- **Erreur 2**: `expo-module-gradle-plugin not found` sans `includeBuild`
- **Erreur 3**: `Plugin with id 'com.android.library' not found` avec `includeBuild` dans `pluginManagement`
- **Cause identifiée**: Problèmes similaires à SDK 52, mais erreurs différentes

### Expo SDK 50
- **Erreur**: `local.properties (Le fichier spécifié est introuvable)` - Erreur différente (fichier manquant)
- **Status**: ❌ Échoué (erreur différente mais toujours un problème)
- **Note**: Le settings.gradle standard Expo SDK 50 référence `local.properties` qui n'existe pas
- **Conclusion**: Même avec SDK 50, il y a des problèmes de configuration

## 🔧 Solutions déjà testées (TOUTES ÉCHOUÉES)

### 1. Modifications de expo-modules-core/build.gradle
- ✅ Définir `compileSdkVersion` directement dans `android {}` (valeur littérale 35)
- ✅ Définir dans `project.ext` et `rootProject.ext`
- ✅ Modifier `useDefaultAndroidSdkVersions()`
- ✅ Ajouter buildscript dans expo-modules-core
- ✅ Déplacer import KotlinCompile
- **Résultat**: ❌ Toutes échouées

### 2. Modifications de settings.gradle
- ✅ Retirer `includeBuild` de `pluginManagement`
- ✅ Déplacer `includeBuild` après `pluginManagement`
- ✅ Utiliser `useExpoModules()` seul
- ✅ Configuration autolinking différente
- **Résultat**: ❌ Toutes échouées

### 3. Scripts init.gradle
- ✅ Définir `compileSdkVersion` dans `gradle/init.d/compile-sdk.gradle`
- ✅ Définir `kotlinVersion` dans `gradle/init.d/kotlin-version.gradle`
- **Résultat**: ❌ Trop tard ou pas accessible

### 4. Patches expo-modules-core
- ✅ Patch pour corriger `compileSdkVersion`
- ✅ Patch pour corriger import Kotlin
- ✅ Patch pour ajouter buildscript
- **Résultat**: ❌ Problèmes persistent

### 5. Downgrade expo-modules-core
- ✅ Tester `expo-modules-core@2.0.6` (standard SDK 52)
- ✅ Tester `expo-modules-core@2.2.3` (override)
- **Résultat**: ❌ Même problème avec toutes les versions

### 6. Configuration autolinking
- ✅ Utiliser `react-native-config` command
- ✅ Utiliser commande standard sans arguments
- ✅ Utiliser `EXPO_USE_COMMUNITY_AUTOLINKING=1`
- **Résultat**: ❌ Toutes échouées

## 📁 Fichiers modifiés

### Fichiers Android
- `mobile/android/settings.gradle` - Multiples modifications testées
- `mobile/android/build.gradle` - Configuration rootProject.ext
- `mobile/android/gradle/init.d/compile-sdk.gradle` - Script init
- `mobile/android/gradle/init.d/kotlin-version.gradle` - Script init

### Fichiers Node
- `mobile/package.json` - Override expo-modules-core, versions Expo testées
- `mobile/postinstall.js` - Scripts de fix (peuvent être problématiques)

### Fichiers expo-modules-core (modifiés puis restaurés)
- `mobile/node_modules/expo-modules-core/android/build.gradle` - Multiples modifications testées
- `mobile/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle` - Modifications testées

## 🔍 Problèmes de fond identifiés

### 1. Ordre d'évaluation Gradle
- `pluginManagement` évalue les projets inclus via `includeBuild` AVANT que le plugin Android ne soit complètement appliqué
- Le bloc `android {}` est évalué dans un contexte spécial où `compileSdkVersion` n'est pas reconnu
- Même avec une valeur littérale `compileSdkVersion 35`, Gradle ne le reconnaît pas

### 2. Résolution du plugin expo-module-gradle-plugin
- Le plugin n'est pas disponible sans `includeBuild` pour expo-modules-core
- Mais `includeBuild` cause le problème `compileSdkVersion`
- `useExpoModules()` ne rend pas le plugin disponible automatiquement

### 3. Conflits de dépendances
- `@config-plugins/react-native-webrtc` requiert Expo SDK 51 (pas 52)
- Override `expo-modules-core` peut causer des conflits
- Versions React Native 0.76.9 peut avoir des incompatibilités

## 💡 Solutions à explorer (NON TESTÉES)

### 1. Utiliser EAS Build
- EAS Build pourrait avoir une configuration différente
- Peut résoudre les problèmes d'ordre d'évaluation Gradle
- **Action**: Tester `eas build --platform android`

### 2. Créer un projet Expo SDK 50/51/52 vierge
- Comparer la configuration standard
- Identifier les différences avec notre projet
- **Action**: `npx create-expo-app@latest test-expo --template blank`

### 3. Utiliser prebuild Expo
- Régénérer les fichiers Android natifs
- Peut corriger les configurations incorrectes
- **Action**: `npx expo prebuild --clean`

### 4. Vérifier les versions Gradle/AGP
- Gradle 8.10.2 et AGP 8.6.0 peuvent être incompatibles avec certaines versions d'Expo
- Tester avec versions recommandées par Expo
- **Action**: Vérifier `expo-doctor` et documentation Expo

### 5. Utiliser React Native CLI (sans Expo)
- Migration complète vers React Native pur
- Plus de contrôle sur la configuration
- Mais perte des fonctionnalités Expo
- **Action**: Migration complète (gros travail)

### 6. Utiliser Expo SDK 49 ou antérieur
- Versions plus anciennes et stables
- Moins de problèmes connus
- **Action**: Downgrade vers SDK 49

### 7. Vérifier les scripts postinstall
- `mobile/postinstall.js` peut modifier expo-modules-core
- Peut causer des problèmes de configuration
- **Action**: Désactiver temporairement et tester

### 8. Utiliser patch-package différemment
- Les patches peuvent être mal appliqués
- Vérifier que les patches sont correctement formatés
- **Action**: Supprimer tous les patches et tester sans

## 📋 Configuration actuelle

### Versions
- **Expo**: **SDK 52** (retour après tests 50/51)
- **React Native**: 0.76.9
- **Gradle**: 8.10.2
- **AGP**: 8.6.0
- **Kotlin**: 1.9.25
- **expo-modules-core**: 2.0.6 (override)

### Décision
**Retour à Expo SDK 52** après avoir testé SDK 50 et 51 (tous échoués)

### Fichiers de configuration
- `mobile/android/settings.gradle` - Configuration standard Expo (dernière version testée)
- `mobile/android/build.gradle` - Configuration avec rootProject.ext
- `mobile/package.json` - Override expo-modules-core, versions Expo

## 🎯 Objectif pour session future

**Trouver une solution qui fonctionne avec Expo SDK 52 SANS patcher expo-modules-core**

### Version cible
- **Expo SDK 52** (retour après tests SDK 50/51)
- Tous les SDK testés ont échoué, mais SDK 52 est la version cible pour le projet

### Approches prioritaires
1. **EAS Build** - Configuration différente, peut résoudre les problèmes
2. **Projet vierge Expo** - Comparer et identifier les différences
3. **prebuild --clean** - Régénérer les fichiers Android
4. **Expo SDK 49** - Version plus stable

### Ce qu'il NE faut PAS faire
- ❌ Modifier expo-modules-core/build.gradle
- ❌ Créer des patches expo-modules-core
- ❌ Modifier ExpoModulesCorePlugin.gradle
- ❌ Ajouter des scripts init.gradle complexes
- ❌ Tourner en rond avec les mêmes solutions

## 📝 Notes importantes

- Le problème est **architectural**, pas de configuration simple
- Chaque correction amène un nouveau problème (signe d'un problème profond)
- Les solutions standard Expo ne fonctionnent pas dans ce contexte
- Il faut explorer des solutions **différentes** de celles déjà testées

## 🔗 Références

- Documentation Expo: https://docs.expo.dev/
- Issues Expo GitHub: https://github.com/expo/expo/issues
- Expo SDK 50 changelog: https://expo.dev/changelog/
- Expo SDK 51 changelog: https://expo.dev/changelog/2024/12-05-sdk-51/
- Expo SDK 52 changelog: https://expo.dev/changelog/2025/01-15-sdk-52/

## ✅ Résultat attendu

**Un build Android qui fonctionne avec Expo SDK 52 sans modifications de expo-modules-core**

### Version cible
- **Expo SDK 52** (version actuelle du projet après retour depuis SDK 50/51)

## 🚨 Conclusion

**TOUS les SDK Expo testés (50, 51, 52) échouent avec des erreurs similaires.**

Cela suggère que le problème n'est **PAS** spécifique à une version d'Expo, mais plutôt :
- Un problème avec la configuration de base du projet
- Un conflit avec une dépendance spécifique
- Un problème avec les versions Gradle/AGP/Kotlin
- Un problème avec les scripts postinstall ou autres modifications

**Il faut explorer des solutions complètement différentes :**
1. EAS Build (configuration cloud différente)
2. Projet Expo vierge (comparer les configurations)
3. prebuild --clean (régénérer tout)
4. Vérifier les dépendances conflictuelles
5. Vérifier les scripts postinstall

---

**Date de création**: 2025-02-05
**Dernière modification**: Après tests Expo SDK 50/51/52 (tous échoués), retour à SDK 52
**Status**: Problème non résolu, **solutions alternatives à explorer (pas les mêmes que déjà testées)**
**Version cible**: Expo SDK 52

