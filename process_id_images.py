#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour traiter les images de pièce d'identité
Respecte les contraintes : minimum 1500 x 1000 pixels, informations lisibles
"""

from PIL import Image, ImageEnhance, ImageFilter
import os
import sys
from pathlib import Path

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Dimensions minimales requises
MIN_WIDTH = 1500
MIN_HEIGHT = 1000

# Dossier de sortie
OUTPUT_DIR = "image_yukpo"

def process_id_image(input_path, output_path=None, enhance_quality=True):
    """
    Traite une image de pièce d'identité pour respecter les contraintes
    
    Args:
        input_path: Chemin vers l'image d'entrée
        output_path: Chemin vers l'image de sortie (optionnel)
        enhance_quality: Améliorer la netteté et le contraste
    
    Returns:
        Chemin de l'image traitée
    """
    # Vérifier que le fichier existe
    if not os.path.exists(input_path):
        print(f"❌ Erreur: Le fichier '{input_path}' n'existe pas")
        return None
    
    # Ouvrir l'image
    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"❌ Erreur lors de l'ouverture de l'image: {e}")
        return None
    
    original_size = img.size
    print(f"\n📸 Image: {os.path.basename(input_path)}")
    print(f"   Dimensions originales: {original_size[0]} x {original_size[1]} pixels")
    
    # Convertir en RGB si nécessaire (pour les PNG avec transparence)
    if img.mode != 'RGB':
        img = img.convert('RGB')
        print(f"   ✅ Convertie en RGB")
    
    # Calculer les nouvelles dimensions
    current_width, current_height = img.size
    needs_resize = current_width < MIN_WIDTH or current_height < MIN_HEIGHT
    
    if needs_resize:
        # Calculer le ratio de redimensionnement nécessaire
        width_ratio = MIN_WIDTH / current_width if current_width < MIN_WIDTH else 1.0
        height_ratio = MIN_HEIGHT / current_height if current_height < MIN_HEIGHT else 1.0
        ratio = max(width_ratio, height_ratio)
        
        # Nouvelles dimensions (en arrondissant)
        new_width = int(current_width * ratio)
        new_height = int(current_height * ratio)
        
        print(f"   🔄 Redimensionnement nécessaire")
        print(f"   Ratio: {ratio:.2f}x")
        print(f"   Nouvelles dimensions: {new_width} x {new_height} pixels")
        
        # Redimensionner avec un filtre de haute qualité (Lanczos)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    else:
        print(f"   ✅ Dimensions déjà conformes")
    
    # Améliorer la qualité si demandé
    if enhance_quality:
        print(f"   ✨ Amélioration de la qualité...")
        
        # Améliorer la netteté (sharpen)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.2)  # Augmenter de 20%
        
        # Améliorer le contraste légèrement
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.1)  # Augmenter de 10%
        
        print(f"   ✅ Netteté et contraste améliorés")
    
    # Créer le dossier de sortie s'il n'existe pas
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(exist_ok=True)
    
    # Déterminer le chemin de sortie
    if output_path is None:
        # Créer un nom de fichier avec suffixe "_processed" dans le dossier image_yukpo
        input_file = Path(input_path)
        output_path = output_dir / f"{input_file.stem}_processed.jpg"
    
    # Sauvegarder l'image
    try:
        # Toujours sauvegarder en JPEG avec haute qualité pour préserver les détails
        img.save(output_path, "JPEG", quality=95, optimize=True)
        
        file_size = os.path.getsize(output_path)
        print(f"   💾 Image sauvegardée: {output_path}")
        print(f"   📊 Taille du fichier: {file_size / 1024:.2f} KB")
        print(f"   ✅ Dimensions finales: {img.size[0]} x {img.size[1]} pixels")
        
        return str(output_path)
    
    except Exception as e:
        print(f"❌ Erreur lors de la sauvegarde: {e}")
        return None


def find_images_in_directory(directory="."):
    """Recherche les images dans un répertoire"""
    image_extensions = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}
    image_paths = []
    
    for file_path in Path(directory).iterdir():
        if file_path.is_file() and file_path.suffix in image_extensions:
            # Ignorer les images déjà traitées
            if '_processed' not in file_path.stem:
                image_paths.append(str(file_path))
    
    return image_paths

def main():
    """Fonction principale"""
    print("=" * 60)
    print("🆔 TRAITEMENT D'IMAGES DE PIÈCE D'IDENTITÉ")
    print("=" * 60)
    print(f"📏 Dimensions minimales requises: {MIN_WIDTH} x {MIN_HEIGHT} pixels")
    print(f"📁 Dossier de sortie: {OUTPUT_DIR}")
    print()
    
    # Demander les chemins des images
    if len(sys.argv) > 1:
        # Images passées en arguments
        image_paths = sys.argv[1:]
    else:
        # Chercher automatiquement les images dans le répertoire courant et image_yukpo
        print("🔍 Recherche d'images dans le répertoire courant et image_yukpo...")
        image_paths = find_images_in_directory(".")
        
        # Chercher aussi dans image_yukpo si le dossier existe
        if os.path.exists(OUTPUT_DIR):
            yukpo_images = find_images_in_directory(OUTPUT_DIR)
            image_paths.extend(yukpo_images)
        
        if image_paths:
            print(f"✅ {len(image_paths)} image(s) trouvée(s):")
            for img in image_paths:
                print(f"   • {img}")
            print()
        else:
            # Mode interactif si aucune image trouvée
            print("📁 Aucune image trouvée. Entrez les chemins des images à traiter (une par ligne, vide pour terminer):")
            image_paths = []
            while True:
                try:
                    path = input().strip()
                    if not path:
                        break
                    image_paths.append(path)
                except (EOFError, KeyboardInterrupt):
                    break
    
    if not image_paths:
        print("\n💡 Usage:")
        print("   python process_id_images.py <image1> [image2] ...")
        print("   ou")
        print("   python process_id_images.py")
        print("   (recherche automatique dans le répertoire courant)")
        return
    
    # Traiter chaque image
    processed_images = []
    for image_path in image_paths:
        result = process_id_image(image_path)
        if result:
            processed_images.append(result)
        print()
    
    # Résumé
    print("=" * 60)
    print("📋 RÉSUMÉ")
    print("=" * 60)
    if processed_images:
        print(f"✅ {len(processed_images)} image(s) traitée(s) avec succès:")
        for img in processed_images:
            print(f"   • {img}")
    else:
        print("❌ Aucune image n'a pu être traitée")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Traitement interrompu par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erreur inattendue: {e}")
        sys.exit(1)

