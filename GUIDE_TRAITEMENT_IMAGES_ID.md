# 📸 Guide de Traitement des Images de Pièce d'Identité

## 🎯 Objectif

Ce script traite vos images de pièce d'identité pour qu'elles respectent les contraintes du formulaire :
- ✅ **Taille minimum** : 1500 x 1000 pixels
- ✅ **Informations lisibles** : Amélioration de la netteté et du contraste

## 📋 Prérequis

### Installation de Python et PIL/Pillow

```bash
# Vérifier si Python est installé
python --version

# Installer Pillow (si pas déjà installé)
pip install Pillow
```

## 🚀 Utilisation

### Méthode 1 : Mode interactif

```bash
python process_id_images.py
```

Puis entrez les chemins des images une par une (appuyez sur Entrée vide pour terminer).

### Méthode 2 : Avec arguments

```bash
# Une seule image
python process_id_images.py "chemin/vers/image1.jpg"

# Plusieurs images
python process_id_images.py "recto.jpg" "verso.jpg"
```

## 📁 Exemples

### Exemple 1 : Traiter le recto et le verso

```bash
python process_id_images.py "cni_recto.jpg" "cni_verso.jpg"
```

**Résultat :**
- `cni_recto_processed.jpg` (1500x1000+ pixels)
- `cni_verso_processed.jpg` (1500x1000+ pixels)

### Exemple 2 : Images dans un dossier

```bash
python process_id_images.py "documents/cni_front.jpg" "documents/cni_back.jpg"
```

## ✨ Fonctionnalités

### 1. Redimensionnement intelligent
- ✅ Agrandit l'image si elle est trop petite
- ✅ Conserve les proportions (ratio)
- ✅ Utilise un algorithme de haute qualité (Lanczos)

### 2. Amélioration de la qualité
- ✅ **Netteté** : +20% pour rendre le texte plus lisible
- ✅ **Contraste** : +10% pour améliorer la lisibilité
- ✅ Conversion automatique en RGB si nécessaire

### 3. Format de sortie
- ✅ JPEG haute qualité (95%) pour préserver les détails
- ✅ PNG si l'image d'origine est en PNG
- ✅ Optimisation automatique

## 📊 Exemple de sortie

```
============================================================
🆔 TRAITEMENT D'IMAGES DE PIÈCE D'IDENTITÉ
============================================================
📏 Dimensions minimales requises: 1500 x 1000 pixels

📸 Image: cni_recto.jpg
   Dimensions originales: 1200 x 800 pixels
   🔄 Redimensionnement nécessaire
   Ratio: 1.25x
   Nouvelles dimensions: 1500 x 1000 pixels
   ✨ Amélioration de la qualité...
   ✅ Netteté et contraste améliorés
   💾 Image sauvegardée: cni_recto_processed.jpg
   📊 Taille du fichier: 245.67 KB
   ✅ Dimensions finales: 1500 x 1000 pixels

============================================================
📋 RÉSUMÉ
============================================================
✅ 1 image(s) traitée(s) avec succès:
   • cni_recto_processed.jpg
```

## ⚙️ Personnalisation

Si vous voulez modifier les paramètres, éditez le fichier `process_id_images.py` :

```python
# Dimensions minimales
MIN_WIDTH = 1500
MIN_HEIGHT = 1000

# Amélioration de la netteté (1.0 = pas de changement, 2.0 = double)
enhancer = ImageEnhance.Sharpness(img)
img = enhancer.enhance(1.2)  # Modifier cette valeur

# Amélioration du contraste
enhancer = ImageEnhance.Contrast(img)
img = enhancer.enhance(1.1)  # Modifier cette valeur

# Qualité JPEG (0-100)
img.save(output_path, "JPEG", quality=95)  # Modifier cette valeur
```

## 🔍 Vérification

Après traitement, vérifiez que :
1. ✅ Les dimensions sont ≥ 1500 x 1000 pixels
2. ✅ Le texte est lisible
3. ✅ Les informations importantes sont visibles
4. ✅ La qualité est acceptable

## ❓ Problèmes courants

### Erreur : "ModuleNotFoundError: No module named 'PIL'"
**Solution :** Installez Pillow
```bash
pip install Pillow
```

### Erreur : "Le fichier n'existe pas"
**Solution :** Vérifiez le chemin du fichier (utilisez des guillemets si le chemin contient des espaces)

### Image floue après traitement
**Solution :** 
- Vérifiez que l'image originale est de bonne qualité
- Augmentez le facteur de netteté dans le script (ligne `enhancer.enhance(1.2)` → `1.5`)

## 📝 Notes importantes

- ⚠️ Le script crée de **nouvelles images** avec le suffixe `_processed`
- ⚠️ Les images originales ne sont **pas modifiées**
- ⚠️ Pour les images très petites, l'agrandissement peut créer un léger flou
- ✅ Le script préserve les proportions de l'image

## 🎯 Prochaines étapes

Une fois les images traitées :
1. Vérifiez qu'elles respectent les contraintes
2. Testez l'upload sur le formulaire
3. Vérifiez que toutes les informations sont lisibles

---

**Date de création** : 2026-02-16  
**Version** : 1.0


