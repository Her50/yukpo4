# 🚀 INSTRUCTIONS DE LANCEMENT - YUKPOMNANG MOBILE

## ✅ Analyse des logs effectuée

### Problèmes détectés et résolus :

1. ❌ **Mauvais répertoire** - Les commandes étaient lancées depuis `yukpomnang/` au lieu de `yukpomnang/mobile/`
2. ❌ **Fichiers introuvables** - Scripts `.ps1` et `.bat` non trouvés car pas dans le bon dossier
3. ⚠️ **Bug PowerShell Console** - Erreur `ArgumentOutOfRangeException` (bug Windows, pas notre app)
4. ✅ **App.tsx restauré** depuis le backup
5. ✅ **Scripts corrigés** - Tous les scripts avec erreurs ont été supprimés
6. ✅ **Nouveaux scripts propres** créés

## 📱 LANCEMENT DE L'APPLICATION

### Méthode 1 : Commande Directe (RECOMMANDÉ)

Ouvrez un **nouveau terminal PowerShell** et lancez :

```powershell
cd C:\Users\23767\yukpomnang\mobile
npm start
```

### Méthode 2 : Fichier Batch

Double-cliquez sur `LANCER-APP.bat` dans le dossier `mobile/`

### Méthode 3 : Script PowerShell

```powershell
cd C:\Users\23767\yukpomnang\mobile
powershell -ExecutionPolicy Bypass -File launch.ps1
```

## 📊 Scripts disponibles

Tous les scripts doivent être lancés **depuis le dossier mobile/** :

| Script | Description | Commande |
|--------|-------------|----------|
| `status.ps1` | Vérifie l'état de l'app | `powershell -File status.ps1` |
| `analyze.ps1` | Analyse les logs | `powershell -File analyze.ps1` |
| `launch.ps1` | Lance l'application | `powershell -File launch.ps1` |
| `LANCER-APP.bat` | Lance l'app (batch) | Double-clic ou `LANCER-APP.bat` |

## 🎯 Ce qui va se passer

1. **Metro Bundler** va démarrer (10-30 secondes)
2. Un **QR code** s'affichera dans le terminal
3. Vous verrez : `› Metro waiting on exp://...`
4. Le terminal affichera les logs en temps réel

## 📱 Sur votre téléphone

1. **Installez Expo Go** :
   - Android : [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS : [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Scannez le QR code** :
   - Android : Ouvrez Expo Go → Scan QR Code
   - iOS : Appareil photo → Ouvre automatiquement Expo Go

3. **L'app se charge** automatiquement (10-30 secondes la première fois)

## ⚠️ Important

- **Même réseau WiFi** : Votre téléphone et PC doivent être sur le même WiFi
- **Firewall** : Si ça ne fonctionne pas, désactivez temporairement le firewall Windows
- **Port 8081** : Metro utilise ce port (fermez les autres instances)

## 🔍 Vérification rapide

Avant de lancer, vérifiez l'état :
```powershell
powershell -File status.ps1
```

Résultat attendu : `Verifications reussies: 4 / 5`

## 📝 Structure vérifiée

✅ App.tsx présent et restauré  
✅ 116 screens dans src/screens/  
✅ 135 components dans src/components/  
✅ node_modules installé  
✅ Configuration complète  

## 🐛 Dépannage

### Metro ne démarre pas
```powershell
# Nettoyer le cache
npm start -- --clear

# Ou réinstaller
rm -r node_modules
npm install
npm start
```

### Port 8081 déjà utilisé
```powershell
# Trouver le processus
netstat -ano | findstr :8081

# Tuer le processus (remplacez PID)
taskkill /F /PID <PID>
```

### L'app ne se charge pas sur le téléphone
1. Vérifiez le WiFi (même réseau)
2. Redémarrez Metro (Ctrl+C puis relancez)
3. Dans Expo Go, entrez l'URL manuellement : `exp://<VOTRE_IP>:8081`

### Voir l'IP de votre PC
```powershell
ipconfig
# Cherchez "Adresse IPv4" de votre WiFi
```

## 📞 Logs et Diagnostics

Si vous rencontrez des problèmes :

1. **Logs Metro** : Visible directement dans le terminal
2. **Logs téléphone** : Visible dans Metro (s'affichent automatiquement)
3. **Analyse logs** : `powershell -File analyze.ps1`

## ✅ C'EST PRÊT !

L'application est prête à être lancée. Ouvrez un **nouveau terminal** et lancez simplement :

```powershell
cd C:\Users\23767\yukpomnang\mobile
npm start
```

Puis scannez le QR code avec Expo Go !

