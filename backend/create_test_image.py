#!/usr/bin/env python3
"""
Création d'une vraie image PNG valide pour les tests
"""

from PIL import Image
import io

def create_test_image():
    """Créer une image PNG valide de 10x10 pixels"""
    
    # Créer une image simple
    img = Image.new('RGB', (10, 10), color='red')
    
    # Sauvegarder en PNG dans un buffer
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    # Lire les données
    image_data = buffer.getvalue()
    
    print(f"✅ Image PNG créée: {len(image_data)} bytes")
    print(f"📏 Dimensions: 10x10 pixels")
    print(f"🎨 Couleur: Rouge")
    
    # Sauvegarder dans un fichier pour vérification
    with open('test_image.png', 'wb') as f:
        f.write(image_data)
    
    print("💾 Image sauvegardée dans 'test_image.png'")
    
    return image_data

if __name__ == "__main__":
    print("🎨 Création d'une image de test valide")
    print("=" * 40)
    create_test_image() 