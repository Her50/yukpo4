# 📱 Guide de test sur téléphone

## ✅ Le serveur Expo est maintenant lancé !

Vous pouvez tester votre application directement sur votre téléphone de **2 façons** :

---

## 🎯 Méthode 1 : Expo Go (Recommandée - Super rapide !)

### Sur votre téléphone :

1. **Installez Expo Go** (si ce n'est pas déjà fait) :
   - 🤖 **Android** : [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - 🍎 **iOS** : [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Ouvrez Expo Go**

3. **Scannez le QR code** qui s'affiche dans votre terminal PowerShell :
   - Android : Utilisez l'appareil photo d'Expo Go
   - iOS : Utilisez l'appareil photo natif, puis ouvrez avec Expo Go

### ⚠️ Important :
- Votre **téléphone** et votre **PC** doivent être sur le **même WiFi**
- Si le QR code ne fonctionne pas, utilisez le lien `exp://...` affiché dans le terminal

---

## 🎯 Méthode 2 : Development Build (Si vous avez déjà l'APK installé)

Si vous avez précédemment installé un "development build" de Yukpomnang :

1. **Ouvrez l'app Yukpomnang** sur votre téléphone
2. L'app se connectera **automatiquement** au serveur de développement
3. Secouez le téléphone pour ouvrir le menu développeur

---

## 🔄 Rechargement automatique

Une fois connecté :
- ✅ Les modifications de code sont **rechargées automatiquement**
- ✅ Vous voyez les changements **en temps réel**
- ✅ Les erreurs s'affichent directement sur l'écran

---

## 🛠️ Commandes utiles

Dans le terminal où tourne Expo, vous pouvez taper :

- **`r`** : Recharger l'application
- **`m`** : Basculer le menu développeur
- **`j`** : Ouvrir le débogueur Chrome
- **`w`** : Ouvrir dans le navigateur web
- **`c`** : Nettoyer le cache de Metro
- **`q`** : Quitter

---

## 🐛 Débogage

### Sur le téléphone (Expo Go) :
1. **Secouez le téléphone** pour ouvrir le menu développeur
2. Options disponibles :
   - Recharger
   - Déboguer à distance (ouvre Chrome DevTools)
   - Performance Monitor
   - Element Inspector

### Sur le PC :
- Les logs s'affichent en temps réel dans le terminal
- Les erreurs JavaScript sont visibles
- Les requêtes réseau sont tracées

---

## 📍 Tester les fonctionnalités GPS

Yukpomnang utilise la géolocalisation. Sur Expo Go :

1. **Autorisez la localisation** quand demandé
2. Pour tester différentes localisations :
   - Android : Utilisez les "Fake GPS" dans les options développeur
   - iOS : Simulez dans Xcode (nécessite connexion Mac)

---

## 🔥 Rechargement rapide (Fast Refresh)

Dès que vous **sauvegardez un fichier** :
- Les changements apparaissent **instantanément** sur le téléphone
- L'état de l'app est **préservé** (vous ne perdez pas votre navigation)

---

## ❌ Problèmes courants

### Le QR code ne se scanne pas
**Solution** : Tapez manuellement le lien `exp://192.168.x.x:8081` dans Expo Go

### "Unable to connect to server"
**Solutions** :
1. Vérifiez que PC et téléphone sont sur le **même WiFi**
2. Désactivez temporairement le pare-feu Windows
3. Dans le terminal, tapez `npx expo start --tunnel` (utilise un tunnel internet)

### "Network response timed out"
**Solutions** :
1. Redémarrez le serveur : Tapez `r` dans le terminal
2. Nettoyez le cache : Tapez `c` puis `r`
3. Relancez avec : `npx expo start --clear`

### L'app crash au démarrage
**Solutions** :
1. Vérifiez les logs dans le terminal
2. Assurez-vous que le backend Rust est lancé
3. Vérifiez l'URL API dans `.env` : `EXPO_PUBLIC_API_BASE_URL`

---

## 🚀 Workflow de développement optimal

1. **Lancez le backend** (si nécessaire) :
   ```bash
   cd ../backend
   cargo run
   ```

2. **Lancez Expo** (déjà fait !) :
   ```bash
   cd mobile
   npx expo start
   ```

3. **Connectez votre téléphone** avec Expo Go

4. **Développez** :
   - Modifiez le code dans VS Code/Cursor
   - Sauvegardez (Ctrl+S)
   - Voyez le résultat instantanément sur le téléphone !

5. **Testez les fonctionnalités** :
   - Navigation entre écrans
   - Création de services
   - Géolocalisation
   - Chat
   - Notifications

---

## 📊 Performances

Expo Go est **optimisé pour le développement** :
- ⚡ Rechargement < 1 seconde
- 🔄 Fast Refresh intelligent
- 📱 Performance proche de l'app finale

Pour tester les **vraies performances**, faites un build de production :
```bash
npx eas build --platform android --profile preview
```

---

## 💡 Astuce Pro

Gardez **deux fenêtres** ouvertes :
1. **Terminal avec Expo** : Pour voir les logs
2. **VS Code/Cursor** : Pour éditer le code

Et votre **téléphone** à côté pour voir les changements en direct ! 🎉

---

## 🆘 Besoin d'aide ?

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans le terminal
2. Regardez les erreurs sur le téléphone (en rouge)
3. Essayez de nettoyer : `npx expo start --clear`
4. En dernier recours : relancez `powershell -ExecutionPolicy Bypass -File fix-gradle-kotlin2.ps1`

---

**Bon développement ! 🚀**

