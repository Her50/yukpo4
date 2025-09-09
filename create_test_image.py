#!/usr/bin/env python3
"""
Script pour créer une image de test simple
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_test_image():
    """Crée une image de test simple"""
    # Créer une image 400x300 avec un fond bleu
    img = Image.new('RGB', (400, 300), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Ajouter du texte
    try:
        # Essayer d'utiliser une police système
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        # Fallback sur la police par défaut
        font = ImageFont.load_default()
    
    # Dessiner un rectangle (simulation d'un vêtement)
    draw.rectangle([100, 100, 300, 250], fill='beige', outline='brown', width=3)
    
    # Ajouter du texte
    draw.text((150, 50), "Image de Test", fill='black', font=font)
    draw.text((120, 280), "Blazer Elegant", fill='darkblue', font=font)
    
    # Sauvegarder l'image
    filename = "test_image.jpg"
    img.save(filename, "JPEG", quality=95)
    
    print(f"✅ Image de test créée: {filename}")
    print(f"📏 Dimensions: {img.size}")
    print(f"💾 Taille: {os.path.getsize(filename)} bytes")
    
    return filename

if __name__ == "__main__":
    try:
        filename = create_test_image()
        print(f"\n🎯 Image de test prête: {filename}")
        print("Vous pouvez maintenant lancer les tests de recherche d'images!")
    except Exception as e:
        print(f"❌ Erreur lors de la création de l'image: {e}") 