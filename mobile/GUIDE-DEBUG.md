# 🐛 Guide de Debug Yukpomnang Mobile

## 📱 Debug Panel intégré dans l'application

### Fonctionnalités
✅ **Bouton flottant 🐛** toujours visible dans l'app
✅ **Capture automatique** de tous les logs (console.log, warn, error, debug)
✅ **Copie en un clic** de tous les logs dans le presse-papier
✅ **Partage** des logs par email, WhatsApp, etc.
✅ **Export JSON** pour analyse approfondie
✅ **Filtrage** par niveau (info, warn, error, debug)
✅ **Auto-scroll** optionnel
✅ **Error Boundary** avec affichage des crashs

### Utilisation dans l'app
1. **Ouvrir le Debug Panel** : Cliquez sur le bouton flottant 🐛
2. **Copier les logs** : Bouton "Copier" en haut
3. **Partager** : Bouton "Partager" pour envoyer par message
4. **Filtrer** : Utilisez les boutons ALL, ERROR, WARN, INFO, DEBUG
5. **Copier un log spécifique** : Maintenez appuyé sur le log

---

## 🔨 Build avec Debug

### Méthode recommandée : Build EAS avec profile debug

```powershell
# Depuis le dossier mobile/
npm run build:debug
# OU directement :
npx eas build --platform android --profile preview-debug
```

**Ce profil inclut :**
- ✅ Mode Debug actif (pas Release)
- ✅ Development Client activé
- ✅ Logs détaillés
- ✅ Variables d'environnement de debug
- ✅ Debug Panel intégré et toujours visible

### Autres profils disponibles

```powershell
# Development (avec dev client)
npx eas build --platform android --profile development

# Preview standard (Release - pas pour debug)
npx eas build --platform android --profile preview

# Debug spécifique
npx eas build --platform android --profile debug
```

---

## 📋 Surveillance des logs sur appareil

### 1. Après installation de l'APK

```powershell
# Lancer la surveillance en temps réel
npm run watch:logs
# OU
.\watch-device-logs.ps1
```

**Prérequis :** 
- ADB installé (inclus dans Android Studio)
- Appareil connecté en USB avec débogage activé
- OU émulateur Android lancé

### 2. Analyser un crash

```powershell
# Analyse automatique du dernier fichier de log
npm run analyze:crash

# Analyser un fichier spécifique
.\crash-analyzer.ps1 -LogFile "device-logs-2025-01-01_12-00-00.txt"

# Surveillance en temps réel avec analyse
.\crash-analyzer.ps1 -Live
```

---

## 🧪 Test en local (sans build EAS)

### Démarrage en mode debug

```powershell
# Nettoyer et démarrer en mode debug
npm run debug:clean

# OU mode verbose avec tous les logs
npm run debug:verbose
```

### Commandes de nettoyage

```powershell
# Nettoyer les caches
npm run clean

# Nettoyer complètement (incluant node_modules)
Remove-Item -Recurse -Force node_modules, .expo, android/build, android/.gradle
npm install
```

---

## 📊 Workflow complet de debug

### Scénario : L'app crash au démarrage

```powershell
# 1. Builder en mode debug
cd mobile
npm run build:debug

# 2. Télécharger et installer l'APK sur l'appareil

# 3. Connecter l'appareil et surveiller les logs
npm run watch:logs

# 4. Ouvrir l'app - les logs s'afficheront en temps réel
#    Si crash, tous les logs seront capturés

# 5. Analyser le crash
npm run analyze:crash
```

### Scénario : L'app s'ouvre mais bug

```powershell
# 1. Ouvrir l'app sur le téléphone

# 2. Cliquer sur le bouton flottant 🐛

# 3. Reproduire le bug - les logs sont capturés automatiquement

# 4. Cliquer sur "Copier" dans le Debug Panel

# 5. Coller dans un fichier texte ou envoyer au support
```

---

## 🚀 Commandes rapides

```powershell
# Build debug avec tout intégré
npm run build:preview-debug

# Surveiller les logs d'un appareil
npm run watch:logs

# Analyser les crashs
npm run analyze:crash

# Nettoyer et redémarrer
npm run debug:clean
```

---

## 💡 Astuces

### Debug Panel dans l'app
- Le bouton 🐛 devient rouge quand il y a des erreurs
- Les logs sont limités aux 500 derniers pour éviter les problèmes de mémoire
- Vous pouvez déplacer le bouton flottant n'importe où sur l'écran
- L'auto-scroll se désactive si vous scrollez manuellement

### ADB (Android Debug Bridge)
```powershell
# Lister les appareils connectés
adb devices

# Voir tous les logs en temps réel
adb logcat

# Filtrer uniquement Yukpomnang
adb logcat | Select-String "Yukpo"

# Nettoyer les logs
adb logcat -c

# Redémarrer l'app
adb shell am force-stop com.hernandezlele.yukpomnangmobile
adb shell am start -n com.hernandezlele.yukpomnangmobile/.MainActivity
```

### Logs système
```powershell
# Voir les crashs système
adb logcat -b crash

# Voir les erreurs seulement
adb logcat *:E

# Exporter les logs dans un fichier
adb logcat -d > logs.txt
```

---

## ⚠️ Troubleshooting

### "ADB not found"
```powershell
# Ajouter ADB au PATH
$env:PATH += ";C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"
```

### "No devices connected"
1. Activez le débogage USB dans les options développeur
2. Autorisez l'ordinateur sur le téléphone
3. Vérifiez : `adb devices`

### "Build failed"
```powershell
# Vérifier l'authentification EAS
npx eas whoami
npx eas login

# Nettoyer et réessayer
npm run clean
npm run build:preview-debug
```

### "App crashes immediately"
1. Utilisez le profil `preview-debug` (pas `preview`)
2. Surveillez avec `npm run watch:logs`
3. Analysez avec `npm run analyze:crash`
4. Vérifiez les permissions dans app.json

---

## 📱 Versions de profils EAS

| Profil | Mode | Usage | Debug Panel |
|--------|------|-------|-------------|
| `development` | Debug | Dev local avec Expo Go | ✅ Oui |
| `preview-debug` | Debug | **RECOMMANDÉ pour debug** | ✅ Oui |
| `debug` | Debug | Tests debug avancés | ✅ Oui |
| `preview` | Release | Tests pre-production | ❌ Non |
| `production` | Release | Production finale | ❌ Non |

---

## 🎯 Résumé - Pour déboguer une app qui crash :

```powershell
# 1. BUILD avec le bon profil
cd mobile
npx eas build --platform android --profile preview-debug

# 2. Installer l'APK sur le téléphone

# 3. Surveiller les logs
npm run watch:logs

# 4. OU utiliser le Debug Panel dans l'app
#    Cliquez sur 🐛 > Copier > Partager les logs
```

✅ **Le Debug Panel est maintenant intégré directement dans votre application !**

