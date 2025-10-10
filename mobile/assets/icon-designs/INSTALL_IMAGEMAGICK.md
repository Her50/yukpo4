# 🛠️ Installation d'ImageMagick pour générer les icônes Yukpo

## 📥 Téléchargement
1. Allez sur : https://imagemagick.org/script/download.php#windows
2. Téléchargez : `ImageMagick-7.1.2-3-Q16-HDRI-x64-dll.exe`

## ⚙️ Installation
1. **Exécutez** le fichier téléchargé
2. **IMPORTANT** : Cochez ✅ "Add application directory to your system path"
3. **Suivez** l'assistant d'installation

## ✅ Vérification
Ouvrez PowerShell et tapez :
```powershell
magick -version
```

## 🚀 Génération des icônes
Une fois installé, exécutez :
```powershell
cd mobile\assets\icon-designs
powershell -ExecutionPolicy Bypass -File generate-icons-simple.ps1
```

## 🎯 Résultat attendu
- ✅ Icone principale : `mobile/assets/icon.png`
- ✅ Icone iOS : `mobile/assets/icon-ios.png` 
- ✅ Icone Android : `mobile/assets/icon-android.png`
- ✅ Icone adaptative : `mobile/assets/adaptive-icon.png`

## 🔄 Redémarrage de l'app
Après génération, redémarrez l'app :
```powershell
cd mobile
npx expo start --clear
```

L'icône avec le motif Ndop sera alors visible ! 🎨


