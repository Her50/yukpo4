# 📱 Guide d'utilisation du fichier AAB généré

## ✅ Build réussi !

Votre fichier AAB est disponible à :
**https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab**

---

## 🎯 Option 1 : Soumettre à Google Play Store (Production)

### Étapes :

1. **Télécharger l'AAB**
   ```powershell
   # Téléchargez depuis le navigateur ou utilisez :
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```

2. **Accéder à Google Play Console**
   - Allez sur https://play.google.com/console
   - Sélectionnez votre application

3. **Créer une nouvelle version**
   - Allez dans "Production" ou "Tests internes" / "Tests fermés"
   - Cliquez sur "Créer une nouvelle version"
   - Augmentez le numéro de version si nécessaire

4. **Uploader l'AAB**
   - Dans la section "App bundles et APK", cliquez sur "Upload"
   - Sélectionnez le fichier `app-release.aab`
   - Attendez la validation

5. **Remplir les informations de version**
   - Notes de version
   - Captures d'écran (si première version)
   - Contenu de l'application

6. **Publier**
   - Cliquez sur "Review release"
   - Puis "Start rollout to Production" (ou votre piste de test)

---

## 🧪 Option 2 : Tester localement (Convertir AAB → APK)

### Prérequis :
- Java JDK installé
- bundletool.jar (téléchargez depuis https://github.com/google/bundletool/releases)

### Étapes :

1. **Télécharger bundletool**
   ```powershell
   # Téléchargez depuis :
   # https://github.com/google/bundletool/releases/latest
   # Placez bundletool-all-x.x.x.jar dans mobile/scripts/
   ```

2. **Télécharger l'AAB**
   ```powershell
   cd mobile
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```

3. **Convertir en APK**
   ```powershell
   # Utiliser le script fourni
   cd scripts
   .\convert-aab-to-apk.ps1 -AabPath "..\app-release.aab" -BundletoolPath "bundletool.jar" -OutputPath "app.apks"
   ```

4. **Extraire l'APK**
   ```powershell
   # Renommer .apks en .zip
   Rename-Item "app.apks" "app.zip"
   
   # Extraire le zip
   Expand-Archive -Path "app.zip" -DestinationPath "extracted"
   
   # L'APK universel se trouve dans extracted/universal.apk
   ```

5. **Installer sur un appareil Android**
   ```powershell
   # Activer le mode développeur et USB debugging sur votre appareil
   # Puis :
   adb install extracted/universal.apk
   ```

---

## 🚀 Option 3 : Utiliser EAS Submit (Automatique)

Si vous avez configuré les credentials Google Play dans `eas.json`, vous pouvez soumettre automatiquement :

```powershell
npx eas submit --platform android --profile production
```

Cela télécharge l'AAB et le soumet automatiquement à Google Play Store.

---

## 📝 Notes importantes

- **AAB vs APK** : L'AAB est optimisé pour Google Play Store. Pour des tests directs, utilisez le profil "preview" qui génère un APK.
- **Signature** : L'AAB est signé avec votre keystore de production. Ne le partagez pas publiquement.
- **Version** : Assurez-vous que le `versionCode` dans `android/app/build.gradle` est supérieur à la version précédente sur Google Play.

---

## 🔄 Pour générer un APK directement (profil preview)

Si vous voulez un APK directement sans conversion :

```powershell
npx eas build --platform android --profile preview
```

Le profil "preview" génère un APK installable directement sur les appareils Android.

