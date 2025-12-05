# 📘 Script Blender pour Rendu 3D AR

## 📋 Description

Script Python pour Blender permettant de rendre des scènes AR 3D en vidéo preview.

## 🔧 Prérequis

1. **Blender 3.0+** installé et accessible dans PATH
2. **Python 3.x** (généralement inclus avec Blender)

## 📦 Installation

### 1. Vérifier que Blender est installé

```bash
blender --version
```

### 2. Tester le script

```bash
blender --background --python scripts/blender/render_ar_scene.py
```

## 🚀 Utilisation

### Syntaxe

```bash
blender --background --python scripts/blender/render_ar_scene.py <scene_file.json> <output_video.mp4>
```

### Exemple

```bash
blender --background --python scripts/blender/render_ar_scene.py \
    storage/ar_previews/scene_abc123.json \
    storage/ar_previews/preview_abc123.mp4
```

## 📝 Format du Fichier Scène JSON

```json
{
    "scene_id": "scene_abc123",
    "position": {"x": 0.0, "y": 0.0, "z": 0.0},
    "rotation": {"x": 0.0, "y": 0.0, "z": 0.0},
    "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
    "clips": [
        {
            "clip_id": "clip_1",
            "video_url": "https://...",
            "position": {"x": -1.0, "y": 0.0, "z": 0.0},
            "rotation": {"x": 0.0, "y": 0.0, "z": 0.0},
            "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
            "start_time": 0.0,
            "duration": 5.0
        }
    ]
}
```

## 🔧 Configuration

### Variables d'environnement

```bash
# Chemin vers Blender (optionnel, si pas dans PATH)
BLENDER_PATH=/usr/bin/blender

# Qualité de rendu (samples)
BLENDER_RENDER_SAMPLES=64

# Utiliser GPU si disponible
BLENDER_USE_GPU=true
```

## ✅ Troubleshooting

### Blender non trouvé

Ajouter Blender au PATH ou utiliser variable d'environnement :

```bash
export BLENDER_PATH=/path/to/blender
```

### Erreur Python

Vérifier que Python 3.x est disponible :

```bash
python3 --version
```

### Rendu lent

- Utiliser GPU : `BLENDER_USE_GPU=true`
- Réduire samples : `BLENDER_RENDER_SAMPLES=32`
- Réduire résolution dans le script

---

**Date** : 2025-01-27

