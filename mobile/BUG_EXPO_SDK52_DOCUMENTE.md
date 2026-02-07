# 🐛 BUG EXPO SDK 52 - Documenté

## 🎯 Problème identifié

**Bug architectural dans Expo SDK 52** : Le plugin `expo-module-gradle-plugin` n'est pas disponible sans `includeBuild` pour `expo-modules-core`, mais `includeBuild` cause l'erreur `compileSdkVersion is not specified`.

## 🔍 Symptômes

### Sans includeBuild
```
Plugin [id: 'expo-module-gradle-plugin'] was not found
```

### Avec includeBuild
```
compileSdkVersion is not specified. Please add it to build.gradle
```

## 💡 Cause racine

Quand `expo-modules-core` est inclus via `includeBuild` dans `pluginManagement` (ou même après), le bloc `android {}` est évalué dans un contexte spécial où :
- Le plugin Android n'est pas complètement appliqué
- `compileSdkVersion` n'est pas reconnu, même avec une valeur littérale
- Le contexte d'évaluation est différent d'un projet normal

## ✅ Solutions testées (toutes échouées)

1. ❌ Définir `compileSdkVersion` directement dans `android {}` (valeur littérale)
2. ❌ Définir dans `project.ext` et `rootProject.ext`
3. ❌ Modifier `useDefaultAndroidSdkVersions()`
4. ❌ Script `init.gradle`
5. ❌ `afterEvaluate`
6. ❌ Déplacer `includeBuild` après `pluginManagement`
7. ❌ Downgrade `expo-modules-core` vers 2.0.6

## 📋 Actions à prendre

### 1. Signaler le bug à Expo
- **Issue**: Expo SDK 52 - `expo-module-gradle-plugin` non disponible sans `includeBuild`, mais `includeBuild` cause `compileSdkVersion is not specified`
- **Repository**: https://github.com/expo/expo
- **Labels**: `bug`, `android`, `gradle`, `expo-modules-core`

### 2. Options de contournement (temporaires)
- Utiliser Expo SDK 51 (si pas de dépendances critiques sur SDK 52)
- Attendre une correction d'Expo
- Utiliser EAS Build (qui pourrait avoir une configuration différente)

### 3. Ne plus modifier expo-modules-core
- Tous les patches et modifications ont échoué
- Le problème est architectural, pas dans le code d'expo-modules-core
- Modifier expo-modules-core ne résout pas le problème fondamental

## ✅ Conclusion

**C'est un bug Expo SDK 52.** On arrête d'essayer de le contourner. Il faut soit :
1. Attendre une correction d'Expo
2. Utiliser Expo SDK 51
3. Signaler le bug et collaborer avec Expo pour le résoudre

## 📝 Références

- Expo SDK 52: https://docs.expo.dev/
- expo-modules-core: https://github.com/expo/expo/tree/main/packages/expo-modules-core
- Issue à créer: https://github.com/expo/expo/issues/new

---

**Date**: 2025-02-05
**Status**: Bug documenté, arrêt des tentatives de contournement

