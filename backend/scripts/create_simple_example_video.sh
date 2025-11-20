#!/bin/bash
# Script pour créer une vidéo exemple simple avec FFmpeg
# Usage: ./create_simple_example_video.sh

set -e

UPLOAD_DIR="${UPLOAD_STORAGE_PATH:-./uploads}"
EXAMPLES_DIR="$UPLOAD_DIR/examples"
VIDEO_PATH="$EXAMPLES_DIR/video-creation-demo.mp4"

echo "🎬 Création de la vidéo exemple..."

# Créer le dossier si nécessaire
mkdir -p "$EXAMPLES_DIR"

# Vérifier si FFmpeg est installé
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg n'est pas installé."
    echo "   Installez FFmpeg: https://ffmpeg.org/download.html"
    exit 1
fi

# Vérifier si la vidéo existe déjà
if [ -f "$VIDEO_PATH" ]; then
    echo "⚠️  La vidéo existe déjà: $VIDEO_PATH"
    read -p "Voulez-vous la remplacer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Annulé."
        exit 0
    fi
    rm "$VIDEO_PATH"
fi

echo "📹 Génération de la vidéo (60 secondes)..."

# Créer une vidéo simple avec:
# - Fond rose Yukpo (#EC4899)
# - Texte "Yukpo Video Creation Demo"
# - Durée: 60 secondes
# - Résolution: 1920x1080

ffmpeg -f lavfi \
    -i color=c=0xEC4899:s=1920x1080:d=60 \
    -vf "drawtext=text='Yukpo Video Creation Demo':fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2-100:fontcolor=white:fontfile=/System/Library/Fonts/Helvetica.ttc,
         drawtext=text='Create professional promotional videos':fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2+50:fontcolor=white:fontfile=/System/Library/Fonts/Helvetica.ttc" \
    -t 60 \
    -y \
    "$VIDEO_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Vidéo créée avec succès: $VIDEO_PATH"
    echo "   Taille: $(du -h "$VIDEO_PATH" | cut -f1)"
else
    echo "❌ Erreur lors de la création de la vidéo"
    exit 1
fi

