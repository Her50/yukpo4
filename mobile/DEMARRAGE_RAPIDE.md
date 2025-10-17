# 🚀 Démarrage rapide pour tester sur téléphone

## ✅ Le serveur Expo démarre maintenant !

Dans quelques secondes, vous verrez dans votre terminal :
- Un **QR code**
- L'adresse du serveur (ex: `exp://192.168.X.X:8081`)

---

## 📱 Sur votre téléphone :

### 1. Installez Expo Go (si ce n'est pas déjà fait)
- **Android** : [Play Store - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS** : [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)

### 2. Connectez-vous

**Option A : Scanner le QR code (recommandé)**
- Ouvrez Expo Go
- Appuyez sur "Scan QR code"
- Scannez le QR code du terminal
- ✅ L'app se charge automatiquement !

**Option B : Saisir l'adresse manuellement**
- Ouvrez Expo Go
- Appuyez sur "Enter URL manually"
- Saisissez l'adresse affichée dans le terminal : `exp://192.168.X.X:8081`
- Appuyez sur "Connect"

---

## 🔧 En cas de problème

### Problème : "Unable to connect"

**Solution 1 : Vérifier le WiFi**
- Votre téléphone et PC doivent être sur le **même WiFi**

**Solution 2 : Mode tunnel**
```powershell
# Dans le terminal, appuyez sur Ctrl+C pour arrêter
# Puis relancez avec :
npx expo start --tunnel
```

**Solution 3 : Recorriger Metro (si erreur de exports)**
```powershell
powershell -ExecutionPolicy Bypass -File fix-metro-exports-all.ps1
npx expo start
```

---

## 💡 Commandes utiles une fois connecté

Dans le terminal où tourne Expo :
- **`r`** : Recharger l'app
- **`m`** : Basculer le menu développeur
- **`j`** : Ouvrir le débogueur
- **`c`** : Nettoyer le cache
- **`q`** : Quitter

Sur le téléphone :
- **Secouer le téléphone** : Ouvre le menu développeur

---

## ✨ C'est tout !

Dès que vous **modifiez et sauvegardez** un fichier, l'app se recharge automatiquement sur le téléphone ! 🎉

