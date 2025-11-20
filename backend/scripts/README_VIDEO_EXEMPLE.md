# 🎬 Scripts de Génération Vidéo Exemple

**Date**: 2025-01-20  
**Objectif**: Créer automatiquement une vidéo exemple pour la Phase 2

---

## 📋 Options disponibles

### Option 1: Script FFmpeg (RECOMMANDÉ - Simple)

**Windows (PowerShell)**:
```powershell
cd backend/scripts
.\create_simple_example_video.ps1
```

**Linux/Mac (Bash)**:
```bash
cd backend/scripts
chmod +x create_simple_example_video.sh
./create_simple_example_video.sh
```

**Prérequis**:
- FFmpeg installé
- Windows: Télécharger depuis https://ffmpeg.org/download.html
- Linux: `sudo apt install ffmpeg` ou `brew install ffmpeg`

**Résultat**:
- Crée une vidéo simple de 60 secondes
- Fond rose Yukpo (#EC4899)
- Texte "Yukpo Video Creation Demo"
- Résolution: 1920x1080
- Format: MP4 (H.264)

---

### Option 2: Script Rust (Instructions)

**Usage**:
```bash
cd backend
cargo run --bin generate_example_video
```

**Fonction**:
- Crée le dossier `uploads/examples/`
- Affiche les instructions pour créer la vidéo
- Vérifie si la vidéo existe déjà

---

### Option 3: Génération via système Yukpo (À venir)

**Status**: ⚠️ Non implémenté

**Fonction prévue**:
- Utiliser le système de génération vidéo existant
- Créer une session exemple
- Générer un storyboard exemple
- Générer la vidéo
- Copier dans `uploads/examples/`

---

## 🎯 Solution rapide (Recommandée)

### Windows
```powershell
# 1. Installer FFmpeg si nécessaire
# Télécharger depuis: https://ffmpeg.org/download.html

# 2. Exécuter le script
cd C:\Users\23767\yukpomnang2\backend\scripts
.\create_simple_example_video.ps1
```

### Linux/Mac
```bash
# 1. Installer FFmpeg si nécessaire
sudo apt install ffmpeg  # Ubuntu/Debian
# ou
brew install ffmpeg      # Mac

# 2. Exécuter le script
cd backend/scripts
chmod +x create_simple_example_video.sh
./create_simple_example_video.sh
```

---

## ✅ Vérification

Après création, vérifier:
```bash
# Vérifier que le fichier existe
ls -lh backend/uploads/examples/video-creation-demo.mp4

# Tester l'endpoint (si backend en cours d'exécution)
curl -I http://localhost:3001/api/media/examples/video-creation-demo.mp4
```

---

## 🎨 Personnalisation

Pour créer une vidéo plus sophistiquée, modifier les scripts FFmpeg:

```bash
# Exemple: Ajouter des images
ffmpeg -loop 1 -i image1.jpg -t 10 -vf "scale=1920:1080" -y part1.mp4
ffmpeg -loop 1 -i image2.jpg -t 10 -vf "scale=1920:1080" -y part2.mp4
ffmpeg -i "concat:part1.mp4|part2.mp4" -c copy -y final.mp4
```

---

## 📝 Notes

- Les scripts créent une vidéo simple mais fonctionnelle
- Pour une vidéo professionnelle, suivre `GUIDE_CREATION_VIDEO_EXEMPLE.md`
- La vidéo simple peut être remplacée plus tard par une vidéo guide complète

---

**Status**: ✅ **SCRIPTS PRÊTS - EXÉCUTER POUR CRÉER LA VIDÉO**

