# 🔧 Fix: TypeError Queue is not a constructor

## ❌ Problème identifié

L'erreur `TypeError: Queue is not a constructor` survient lors du prebuild Expo à cause d'un conflit de dépendances avec `p-limit` et `yocto-queue`.

**Erreur complète :**
```
TypeError: Queue is not a constructor
    at pLimit (/home/expo/workingdir/build/mobile/node_modules/p-limit/index.js:9:16)
```

## ✅ Solution appliquée

1. **Suppression de l'override problématique** dans `package.json`
   - L'override `"yocto-queue": "^1.0.0"` forçait une version incompatible
   - Les dépendances comme `p-limit` ont besoin de laisser npm résoudre automatiquement la bonne version

## 📋 Étapes de correction

### Étape 1 : Nettoyer les dépendances

```bash
cd mobile
rm -rf node_modules package-lock.json
```

### Étape 2 : Réinstaller proprement

```bash
npm install
```

### Étape 3 : Tester le prebuild

```bash
npx expo prebuild --clean
```

## 🔍 Explication technique

Le problème vient du fait que :
- `p-limit` (utilisé par plusieurs dépendances Expo) nécessite `yocto-queue`
- L'override forçait `yocto-queue@^1.0.0`
- Mais certaines versions de `p-limit` s'attendent à `yocto-queue@^0.1.0`
- Cela créait un conflit où `Queue` n'était pas correctement importé

En supprimant l'override, npm peut maintenant résoudre automatiquement la version compatible.

## ✅ Vérification

Après le nettoyage et la réinstallation, le prebuild devrait fonctionner sans erreur.

## 📝 Note

Si le problème persiste après nettoyage :
1. Vérifier que Node.js est en version 18+ (`node --version`)
2. Vérifier que npm est à jour (`npm install -g npm@latest`)
3. Essayer avec `npm ci` au lieu de `npm install` pour une installation plus stricte


