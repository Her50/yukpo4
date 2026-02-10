# 🚨 SOLUTION URGENTE : Icône toujours sombre

## ✅ Bonne nouvelle
Les fichiers PNG ont été correctement générés avec un **Y violet sur fond blanc**. Le problème vient des **icônes compilées Android** qui n'ont pas été mises à jour.

## 🔧 Solution : Rebuild complet OBLIGATOIRE

### Option 1 : Script automatique (RECOMMANDÉ)

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File REBUILD_ICONES_URGENT.ps1
```

Ce script va :
1. ✅ Vérifier que les fichiers PNG existent
2. ✅ Supprimer les dossiers `android` et `ios` 
3. ✅ Nettoyer le cache
4. ✅ Exécuter `npx expo prebuild --clean` pour régénérer les icônes compilées

### Option 2 : Commandes manuelles

```powershell
cd mobile

# 1. Supprimer les dossiers natifs
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ios -ErrorAction SilentlyContinue

# 2. Nettoyer le cache
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue

# 3. Prebuild pour régénérer les icônes
npx expo prebuild --clean

# 4. Build Android
npx expo run:android
```

## ⚠️ IMPORTANT

**Le problème** : Les icônes PNG dans `mobile/assets/` sont correctes (Y violet sur blanc), mais Android utilise des icônes compilées dans `android/app/src/main/res/mipmap-*/` qui n'ont pas été mises à jour.

**La solution** : `npx expo prebuild --clean` va régénérer ces icônes compilées à partir des fichiers PNG dans `assets/`.

## 📋 Vérification après rebuild

Après le rebuild, vérifiez que :
- ✅ Le dossier `android/app/src/main/res/mipmap-*/` contient les nouvelles icônes
- ✅ Les fichiers `ic_launcher.png` dans ces dossiers montrent un Y violet sur fond blanc
- ✅ L'application affiche la nouvelle icône

## 🔄 Si l'icône ne change toujours pas

1. **Désinstaller complètement l'application** de l'appareil/émulateur
2. **Redémarrer l'appareil/émulateur**
3. **Rebuild et réinstaller** :
   ```bash
   cd mobile
   npx expo run:android
   ```

## 📁 Fichiers concernés

- ✅ `mobile/assets/icon.png` - **CORRECT** (Y violet sur blanc)
- ✅ `mobile/assets/adaptive-icon.png` - **CORRECT** (Y violet sur blanc)
- ❌ `android/app/src/main/res/mipmap-*/ic_launcher.png` - **À RÉGÉNÉRER** (via prebuild)

