# 📋 Variables d'Environnement - AR Natif et Rendu 3D Blender

## ✅ Phase 3.2 Intégration Native

### Rendu 3D Blender

```bash
# Chemin vers l'exécutable Blender (optionnel, 'blender' par défaut)
BLENDER_PATH=/usr/bin/blender
# ou sur macOS
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender

# Chemin vers le script Python de rendu (optionnel)
BLENDER_RENDER_SCRIPT=scripts/blender/render_ar_scene.py

# Qualité de rendu (samples Cycles)
BLENDER_RENDER_SAMPLES=64

# Utiliser GPU pour le rendu (si disponible)
BLENDER_USE_GPU=true

# Répertoire de sortie pour les previews AR
AR_RENDER_OUTPUT_DIR=storage/ar_previews
```

### AR Natif (Frontend)

**Pas de variables d'environnement nécessaires** - Les packages AR natifs sont gérés via `package.json` et la configuration native (Info.plist, AndroidManifest.xml).

---

## 📝 Fichier .env.example Complet

```bash
# Phase 3.2: AR/VR Editing
AR_RENDER_OUTPUT_DIR=storage/ar_previews

# Phase 3.2 Améliorations: Rendu 3D Blender
BLENDER_PATH=/usr/bin/blender
BLENDER_RENDER_SCRIPT=scripts/blender/render_ar_scene.py
BLENDER_RENDER_SAMPLES=64
BLENDER_USE_GPU=true
```

---

## ✅ Notes

- **BLENDER_PATH** : Optionnel, seulement si Blender n'est pas dans PATH
- **BLENDER_RENDER_SCRIPT** : Optionnel, utilise le chemin par défaut si non défini
- **BLENDER_RENDER_SAMPLES** : Ajuster selon performance (32-128 recommandé)
- **BLENDER_USE_GPU** : Automatiquement détecté par Blender si disponible

---

**Date** : 2025-01-27

