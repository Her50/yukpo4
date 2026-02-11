# 📱 Instructions : Remplacement manuel de l'icône de l'application

## 🔍 Fichiers à remplacer

### 1. **Icône principale** (iOS et Android)
**Fichier à remplacer :** `mobile/assets/icon.png`
- **Taille recommandée :** 1024x1024 pixels
- **Format :** PNG avec fond transparent ou fond clair
- **Important :** L'icône doit être **claire et visible** sur fond blanc

### 2. **Icône adaptative Android** (Android uniquement)
**Fichier à remplacer :** `mobile/assets/adaptive-icon.png`
- **Taille recommandée :** 1024x1024 pixels
- **Format :** PNG avec fond transparent
- **Important :** 
  - L'icône doit être **claire et visible**
  - Seule la partie centrale (environ 70%) sera visible (les bords seront masqués)
  - Le fond sera automatiquement blanc selon la configuration dans `app.config.js`

### 3. **Splash screen** (écran de démarrage)
**Fichier à remplacer :** `mobile/assets/splash.png`
- **Taille recommandée :** 1284x2778 pixels (iPhone 14 Pro Max) ou 1024x1024 pixels
- **Format :** PNG
- **Important :** Le fond est configuré en blanc dans `app.config.js`

## ✅ Configuration actuelle dans `app.config.js`

La configuration est déjà correcte :
- `icon: "./assets/icon.png"` ✅
- `adaptiveIcon.foregroundImage: "./assets/adaptive-icon.png"` ✅
- `adaptiveIcon.backgroundColor: "#FFFFFF"` ✅ (fond blanc)
- `splash.backgroundColor: "#FFFFFF"` ✅ (fond blanc)

## 🔧 Étapes pour remplacer les icônes

1. **Préparez vos nouvelles icônes :**
   - Créez une icône claire et visible (évitez les couleurs sombres)
   - Assurez-vous que l'icône a un bon contraste sur fond blanc

2. **Remplacez les fichiers :**
   ```
   mobile/assets/icon.png          → Remplacez par votre nouvelle icône
   mobile/assets/adaptive-icon.png  → Remplacez par votre nouvelle icône (même image)
   mobile/assets/splash.png         → Remplacez par votre nouveau splash screen
   ```

3. **Vérifiez les dimensions :**
   - `icon.png` : 1024x1024 pixels minimum
   - `adaptive-icon.png` : 1024x1024 pixels minimum
   - `splash.png` : 1024x1024 pixels minimum (ou 1284x2778 pour iPhone)

4. **Après remplacement, reconstruisez l'application :**
   ```bash
   # Pour un nouveau build
   cd mobile
   npx expo prebuild --clean
   npx expo run:android  # ou expo run:ios
   ```

## ⚠️ Notes importantes

- **Android :** L'icône adaptative utilise un fond blanc automatique. Assurez-vous que votre icône est visible sur fond blanc.
- **iOS :** L'icône principale est utilisée telle quelle. Assurez-vous qu'elle est claire.
- **Cache :** Après remplacement, vous devrez peut-être :
  - Désinstaller l'application de votre appareil
  - Nettoyer le cache : `npx expo start --clear`
  - Reconstruire l'application

## 🎨 Recommandations pour l'icône

- Utilisez des couleurs vives et contrastées
- Évitez les couleurs sombres (noir, bleu foncé, etc.)
- Testez l'icône sur fond blanc avant de la déployer
- Pour Android, gardez les éléments importants au centre (les bords seront masqués)

