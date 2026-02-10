# 🚨 FIX URGENT : Icône toujours sombre

## Problème
L'icône reste sombre (bleu très foncé) malgré les régénérations.

## Solution : Rebuild complet OBLIGATOIRE

### Étape 1 : Vérifier les fichiers PNG
```bash
cd mobile/assets
# Vérifier que icon.png et adaptive-icon.png existent et sont récents
dir icon.png, adaptive-icon.png
```

### Étape 2 : Nettoyer TOUT
```bash
cd mobile

# Nettoyer le cache Expo
npx expo start -c
# Appuyer sur Ctrl+C pour arrêter

# Supprimer le dossier android (si existe)
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue

# Supprimer le dossier ios (si existe)  
Remove-Item -Recurse -Force ios -ErrorAction SilentlyContinue

# Nettoyer le cache npm
npm cache clean --force
```

### Étape 3 : Rebuild complet
```bash
cd mobile

# Prebuild pour régénérer les dossiers natifs
npx expo prebuild --clean

# Build Android
npx expo run:android
```

### Étape 4 : Si ça ne marche toujours pas

#### Option A : Vérifier manuellement les icônes Android
Les icônes Android sont dans :
```
mobile/android/app/src/main/res/mipmap-*/
```

Vérifiez que ces dossiers contiennent bien les nouvelles icônes.

#### Option B : Build avec EAS
```bash
cd mobile
eas build --platform android --local
```

#### Option C : Désinstaller complètement l'app
1. Désinstaller l'application de l'appareil/émulateur
2. Redémarrer l'appareil/émulateur
3. Rebuild et réinstaller

## Vérification finale

Après le rebuild, l'icône doit être :
- ✅ Fond BLANC
- ✅ Y VIOLET visible
- ✅ Pas de bleu foncé

Si l'icône est toujours sombre, le problème vient probablement des icônes compilées dans `android/app/src/main/res/mipmap-*/` qui n'ont pas été mises à jour.

