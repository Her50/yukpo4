# 🚀 GUIDE D'IMPLÉMENTATION - Solution Recommandée

## 📋 Checklist d'implémentation

### ✅ Étape 1: Sauvegarder l'état actuel

```bash
cd mobile
git add -A
git commit -m "WIP: Avant downgrade expo-modules-core"
```

### ✅ Étape 2: Modifier package.json

**Fichier**: `mobile/package.json`

**Changements**:
```json
{
  "dependencies": {
    "expo-modules-core": "~2.0.6"  // Changé de ~2.2.3
  },
  "overrides": {
    "expo-modules-core": "~2.0.6"  // Changé de ~2.2.3
  }
}
```

### ✅ Étape 3: Nettoyer et réinstaller

```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
```

### ✅ Étape 4: Vérifier la version installée

```bash
npm list expo-modules-core
```

**Résultat attendu**: `expo-modules-core@2.0.6`

### ✅ Étape 5: Supprimer les patches obsolètes

```bash
# Supprimer le patch pour 2.2.3
rm patches/expo-modules-core+2.2.3.patch

# Vérifier s'il y a d'autres patches à supprimer
ls patches/
```

### ✅ Étape 6: Nettoyer postinstall.js

**Fichier**: `mobile/postinstall.js`

**Action**: Commenter ou supprimer les scripts de fix pour expo-modules-core

```javascript
// Commenter ou supprimer:
// - fix-expo-modules-core-kotlin-version.js
// - Tous les autres scripts liés à expo-modules-core
```

### ✅ Étape 7: Tester le build

```bash
cd mobile/android
./gradlew clean
./gradlew assembleDebug
```

### ✅ Étape 8: Vérifier les résultats

- ✅ Le build réussit
- ✅ Plus d'erreur `compileSdkVersion is not specified`
- ✅ Le plugin `expo-module-gradle-plugin` est trouvé
- ✅ L'application compile correctement

### ✅ Étape 9: Commit final

```bash
git add -A
git commit -m "fix: Downgrade expo-modules-core 2.2.3 -> 2.0.6 pour résoudre compileSdkVersion"
```

---

## 🔍 Vérifications post-implémentation

### Vérifier les dépendances

```bash
npm list expo-modules-core
npm list expo
```

### Vérifier le build Android

```bash
cd mobile/android
./gradlew clean
./gradlew assembleDebug
```

### Vérifier le build iOS (si applicable)

```bash
cd mobile/ios
pod install
# Tester le build Xcode
```

### Vérifier l'application

```bash
cd mobile
npm start
# Tester sur un appareil/émulateur
```

---

## ⚠️ Problèmes potentiels

### Problème 1: Conflits de dépendances

**Symptôme**: Erreurs de résolution de dépendances

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problème 2: Fonctionnalités manquantes

**Symptôme**: L'application ne fonctionne pas comme avant

**Solution**: Vérifier la documentation d'Expo SDK 52 pour les différences entre 2.0.6 et 2.2.3

### Problème 3: Autres erreurs de build

**Symptôme**: Nouvelles erreurs après le downgrade

**Solution**: 
1. Vérifier les logs d'erreur
2. Consulter la documentation Expo
3. Vérifier la compatibilité avec d'autres packages

---

## 📊 Rollback si nécessaire

Si le downgrade cause des problèmes:

```bash
# Restaurer package.json
git checkout HEAD -- package.json

# Réinstaller
rm -rf node_modules package-lock.json
npm install

# Restaurer les patches si nécessaire
git checkout HEAD -- patches/
```

---

## ✅ Validation finale

- [ ] `expo-modules-core@2.0.6` installé
- [ ] Build Android réussi
- [ ] Plus d'erreur `compileSdkVersion`
- [ ] Application fonctionne correctement
- [ ] Patches obsolètes supprimés
- [ ] Scripts de fix nettoyés
- [ ] Documentation mise à jour

---

**Date**: 2025-01-XX
**Status**: ✅ Guide prêt à l'implémentation

