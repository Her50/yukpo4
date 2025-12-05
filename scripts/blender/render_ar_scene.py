#!/usr/bin/env python3
# ✅ NOUVEAU Phase 3.2: Script Blender pour rendu de scènes AR 3D

"""
Script Blender pour rendre des scènes AR 3D en vidéo preview
Usage: blender --background --python render_ar_scene.py <scene_file.json> <output_video.mp4>
"""

import bpy
import json
import sys
import os
import math
import mathutils
from mathutils import Vector, Euler

def clear_scene():
    """Nettoie la scène Blender"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def load_scene_data(scene_file_path):
    """Charge les données de scène depuis le fichier JSON"""
    with open(scene_file_path, 'r') as f:
        scene_data = json.load(f)
    return scene_data

def create_camera(position, rotation):
    """Crée une caméra à la position et rotation spécifiées"""
    bpy.ops.object.camera_add(
        location=(position['x'], position['y'], position['z'])
    )
    camera = bpy.context.object
    camera.rotation_euler = (
        math.radians(rotation['x']),
        math.radians(rotation['y']),
        math.radians(rotation['z'])
    )
    return camera

def create_video_clip(clip_data, scene_position):
    """Crée un objet vidéo pour un clip dans la scène 3D"""
    # Position relative au centre de la scène
    clip_pos = Vector((
        scene_position['x'] + clip_data['position']['x'],
        scene_position['y'] + clip_data['position']['y'],
        scene_position['z'] + clip_data['position']['z']
    ))
    
    # Créer un plan pour afficher la vidéo
    bpy.ops.mesh.primitive_plane_add(
        location=clip_pos,
        scale=(clip_data['scale']['x'], clip_data['scale']['y'], 1.0)
    )
    
    plane = bpy.context.object
    plane.name = f"Clip_{clip_data['clip_id']}"
    
    # Rotation du plan
    plane.rotation_euler = Euler((
        math.radians(clip_data['rotation']['x']),
        math.radians(clip_data['rotation']['y']),
        math.radians(clip_data['rotation']['z'])
    ))
    
    # TODO: Charger la vidéo comme texture
    # Pour l'instant, créer un matériau simple
    material = bpy.data.materials.new(name=f"Material_{clip_data['clip_id']}")
    material.use_nodes = True
    plane.data.materials.append(material)
    
    return plane

def setup_lighting():
    """Configure l'éclairage de la scène"""
    # Lumière principale
    bpy.ops.object.light_add(type='SUN', location=(5, 5, 10))
    sun = bpy.context.object
    sun.data.energy = 3.0
    
    # Lumière ambiante
    bpy.ops.object.light_add(type='AREA', location=(-5, -5, 5))
    area = bpy.context.object
    area.data.energy = 1.0
    area.data.size = 10.0

def setup_render_settings(output_path, width=1920, height=1080, fps=30):
    """Configure les paramètres de rendu"""
    scene = bpy.context.scene
    
    # Résolution
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    
    # Format vidéo
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    
    # FPS
    scene.render.fps = fps
    scene.render.fps_base = 1.0
    
    # Chemin de sortie
    scene.render.filepath = output_path
    
    # Échantillonnage
    scene.cycles.samples = 64
    
    # Performance
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if bpy.context.preferences.addons['cycles'].preferences.has_active_device() else 'CPU'

def render_scene(scene_data, output_path):
    """Rend la scène 3D en vidéo"""
    print(f"[Blender] Chargement scène: {scene_data['scene_id']}")
    
    # Nettoyer la scène
    clear_scene()
    
    # Position de la scène
    scene_pos = scene_data['position']
    
    # Créer les clips vidéo
    for clip_data in scene_data.get('clips', []):
        create_video_clip(clip_data, scene_pos)
    
    # Configurer l'éclairage
    setup_lighting()
    
    # Créer la caméra (position par défaut pour preview)
    camera = create_camera(
        {'x': 0, 'y': -5, 'z': 3},
        {'x': 70, 'y': 0, 'z': 0}
    )
    bpy.context.scene.camera = camera
    
    # Configurer le rendu
    setup_render_settings(output_path)
    
    # Calculer la durée totale
    total_duration = max((clip['start_time'] + clip['duration'] for clip in scene_data.get('clips', [])), default=5.0)
    frame_count = int(total_duration * bpy.context.scene.render.fps)
    bpy.context.scene.frame_end = frame_count
    
    print(f"[Blender] Début rendu: {frame_count} frames")
    
    # Rendre la scène
    bpy.ops.render.render(animation=True)
    
    print(f"[Blender] Rendu terminé: {output_path}")

def main():
    """Fonction principale"""
    if len(sys.argv) < 3:
        print("Usage: blender --background --python render_ar_scene.py <scene_file.json> <output_video.mp4>")
        sys.exit(1)
    
    scene_file = sys.argv[-2]
    output_file = sys.argv[-1]
    
    if not os.path.exists(scene_file):
        print(f"Erreur: Fichier scène non trouvé: {scene_file}")
        sys.exit(1)
    
    # Charger les données de scène
    scene_data = load_scene_data(scene_file)
    
    # Rendre la scène
    render_scene(scene_data, output_file)
    
    print(f"[Blender] Succès: {output_file}")

if __name__ == "__main__":
    main()

