# 🚀 Lancement Rapide de Yukpomnang Mobile

## Méthode Simple (Recommandée)

Double-cliquez sur `LANCER-APP.bat` dans l'explorateur Windows.

## Méthode Alternative

```powershell
# Depuis PowerShell dans le dossier mobile
npm start
```

## Instructions

1. **Attendez** que Metro affiche le QR code (cela prend 10-30 secondes)
2. **Installez** Expo Go sur votre téléphone :
   - Android : https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS : https://apps.apple.com/app/expo-go/id982107779
3. **Scannez** le QR code avec :
   - Android : L'app Expo Go directement
   - iOS : L'appareil photo (qui ouvrira Expo Go)
4. L'application **se chargera automatiquement** sur votre téléphone

## Scripts Utiles

- `status.ps1` - Vérifie l'état de l'application
- `analyze.ps1` - Analyse les fichiers de log
- `launch.ps1` - Lance l'application (PowerShell)

## Dépannage

### Metro ne démarre pas
```powershell
npm install
npm start
```

### L'application ne se charge pas
- Vérifiez que votre téléphone et PC sont sur le même réseau WiFi
- Redémarrez Metro (Ctrl+C puis relancez)
- Vérifiez le firewall Windows

### Erreurs dans l'application
Consultez les logs dans le terminal Metro ou lancez :
```powershell
powershell -File analyze.ps1
```

## Structure du Projet

- `App.tsx` - Point d'entrée de l'application
- `src/` - Code source
  - `screens/` - 116 écrans
  - `components/` - 135 composants
  - `navigation/` - Navigation
  - `contexts/` - Contextes React
  - `services/` - Services API
  - `theme/` - Thème et styles

## Commandes Utiles

```powershell
# Vérifier l'état
powershell -File status.ps1

# Lancer l'app
npm start

# Nettoyer le cache
npm start -- --clear

# Build Android
npm run android
```

## Support

En cas de problème, vérifiez :
1. Node.js est installé (version 18+)
2. Les dépendances sont installées (`npm install`)
3. Aucun autre serveur Metro ne tourne
4. Votre antivirus/firewall autorise Node.js

