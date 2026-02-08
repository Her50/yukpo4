# 🔧 CORRECTION CONFLIT DE VERSIONS - expo-modules-core

**Date**: 2025-02-05  
**Problème**: Conflit entre `expo-modules-core@2.0.6` (principal) et `expo-modules-core@2.2.3` (via `@config-plugins/react-native-webrtc`)

---

## 🔴 PROBLÈME IDENTIFIÉ

**Versions installées** :
- ✅ `expo-modules-core@2.0.6` (version principale - standard Expo SDK 52)
- ⚠️ `expo-modules-core@2.2.3` (via `@config-plugins/react-native-webrtc` - dépendance transitive)

**Impact** : Conflit de versions pouvant causer des erreurs de build.

---

## ✅ SOLUTION APPLIQUÉE

### Ajout de `overrides` dans `package.json`

**Fichier**: `mobile/package.json`

```json
"overrides": {
  "expo-modules-core": "~2.0.0"
}
```

**Fonction** : Force npm à utiliser `expo-modules-core@~2.0.0` pour toutes les dépendances, y compris les dépendances transitives.

**Impact** : Toutes les dépendances utiliseront la version standard d'Expo SDK 52, éliminant le conflit.

---

## 📋 PROCHAINES ÉTAPES

1. ✅ `overrides` ajouté dans `package.json`
2. ⏳ Réinstaller les dépendances : `npm install`
3. ⏳ Vérifier que seule la version `2.0.6` est installée : `npm list expo-modules-core`
4. ⏳ Relancer le build EAS

---

## 🎯 RÉSULTAT ATTENDU

- ✅ Une seule version d'`expo-modules-core` installée (`2.0.6`)
- ✅ Plus de conflit de versions
- ✅ Build devrait fonctionner

---

## ⚠️ SI LE BUILD ÉCHOUE ENCORE

**Consulter les logs** : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/10c6a61f-5446-45de-aaaa-d52e7645c600#run-gradlew

**Analyser l'erreur exacte** pour identifier si c'est :
- Un problème lié à `expo-modules-core`
- Un problème différent (autre package, configuration, etc.)



