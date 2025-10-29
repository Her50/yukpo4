# 📸 Système Complet de Gestion d'Images pour Variantes

## 🎯 Objectif

Permettre à **chaque variante** d'avoir **plusieurs images** (différentes vues) qui s'affichent dynamiquement dans ProductCard selon la sélection de l'utilisateur.

---

## 📊 ÉTAT ACTUEL DU SYSTÈME

### ✅ Ce qui FONCTIONNE

**ChaussureVariant** :
```typescript
interface ChaussureVariant {
  images?: string[];  // ✅ ARRAY - Plusieurs images supportées
}
```
- Upload multiple : `allowsMultipleSelection: true` ✅
- Affichage dans Manager : Grid d'images avec bouton X ✅
- Suppression image individuelle : Fonctionnel ✅

### ❌ Ce qui est INCOMPLET

**ProductVariant** :
```typescript
interface ProductVariant {
  image?: string;  // ❌ UNE SEULE image
}
```

**HotelVariant** :
```typescript
interface HotelVariant {
  image?: string;  // ❌ UNE SEULE image
}
```

**ProductCard** :
```typescript
const variantImage = currentVariant?.image;  // ❌ Prend UNE image
const mainImage = variantImage || images[0];  // ❌ Pas de carousel
```
→ N'affiche PAS de sélecteur de variantes
→ N'affiche PAS de carousel d'images de variante

---

## 🚀 SYSTÈME AMÉLIORÉ COMPLET

### 1️⃣ Harmonisation des Interfaces

**Tous les Variant doivent avoir** :
```typescript
export interface [Type]Variant {
  id: string;
  
  // Caractéristiques variables
  caracteristiqueVariable1: string;
  caracteristiqueVariable2?: string;
  
  // Prix
  prix: string;
  devise: string;
  
  // Images - ✅ ARRAY pour plusieurs vues
  images?: string[];           // Images principales de cette variante
  imagePrincipale?: string;    // Image par défaut (images[0])
  
  // Optionnels
  stockDisponible?: number;
  reference?: string;
}
```

**Exemples harmonisés** :

```typescript
// ProductVariant (Alimentation)
export interface ProductVariant {
  id: string;
  quantite: string;
  unite: string;
  conditionnement: string;
  prix: string;
  devise: string;
  images?: string[];           // ✅ Plusieurs images du produit dans ce conditionnement
  stockDisponible?: number;
  reference?: string;
}

// HotelVariant
export interface HotelVariant {
  id: string;
  typeChambre: string;
  capacite: string;
  prix: string;
  devise: string;
  images?: string[];           // ✅ Plusieurs photos de la chambre (lit, salle de bain, vue...)
  equipements?: string[];
  superficie?: string;
  nbChambresDisponibles?: number;
}

// TelephoneVariant
export interface TelephoneVariant {
  id: string;
  stockage: string;
  couleur: string;
  prix: string;
  devise: string;
  images?: string[];           // ✅ Photos du téléphone dans cette couleur (face, dos, profil)
  stockDisponible?: number;
}

// VetementVariant
export interface VetementVariant {
  id: string;
  taille: string;
  couleur: string;
  prix: string;
  devise: string;
  images?: string[];           // ✅ Photos du vêtement dans cette taille/couleur
  stockDisponible?: number;
}
```

---

### 2️⃣ Upload d'Images Multiples dans les Managers

**Pattern pour TOUS les [Type]VariantManager** :

```typescript
// ✅ Fonction d'upload MULTIPLE images
const handleImagePicker = async (variantId: string) => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie nécessaire');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,  // ✅ Sélection multiple
      quality: 0.8,
      selectionLimit: 5,  // Maximum 5 images par variante
    });

    if (!result.canceled && result.assets.length > 0) {
      const variant = variants.find(v => v.id === variantId);
      const existingImages = variant?.images || [];
      const newImages = result.assets.map(asset => asset.uri);
      
      // ✅ Ajouter aux images existantes
      handleUpdateVariant(variantId, 'images', [...existingImages, ...newImages]);
    }
  } catch (error) {
    Alert.alert('Erreur', 'Impossible de sélectionner les images');
  }
};

// ✅ Fonction de suppression image individuelle
const handleRemoveImage = (variantId: string, imageIndex: number) => {
  const variant = variants.find(v => v.id === variantId);
  if (variant && variant.images) {
    const updatedImages = variant.images.filter((_, idx) => idx !== imageIndex);
    handleUpdateVariant(variantId, 'images', updatedImages);
  }
};
```

**Affichage des images dans le Manager** :

```typescript
{/* Images de la variante */}
{variant.images && variant.images.length > 0 && (
  <View style={styles.imagesContainer}>
    <Text style={styles.imagesLabel}>
      📸 Images ({variant.images.length})
    </Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {variant.images.map((img, imgIdx) => (
        <View key={imgIdx} style={styles.imageWrapper}>
          <Image source={{ uri: img }} style={styles.variantImage} />
          {!readonly && (
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => handleRemoveImage(variant.id, imgIdx)}
            >
              <SafeIcon name="x" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  </View>
)}

{/* Bouton ajouter images */}
{!readonly && (
  <TouchableOpacity
    style={styles.addImageButton}
    onPress={() => handleImagePicker(variant.id)}
  >
    <SafeIcon name="camera" size={16} color={modernColors.primary} />
    <Text style={styles.addImageText}>
      Ajouter des images {variant.images?.length > 0 && `(${variant.images.length})`}
    </Text>
  </TouchableOpacity>
)}
```

**Styles** :
```typescript
imagesContainer: {
  marginBottom: 12,
},
imagesLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#374151',
  marginBottom: 8,
},
imageWrapper: {
  position: 'relative',
  marginRight: 8,
},
variantImage: {
  width: 80,
  height: 80,
  borderRadius: 8,
  resizeMode: 'cover',
},
removeImageButton: {
  position: 'absolute',
  top: 2,
  right: 2,
  backgroundColor: '#DC2626',
  borderRadius: 12,
  width: 20,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
addImageButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#F3F4F6',
  padding: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderStyle: 'dashed',
},
addImageText: {
  fontSize: 14,
  color: '#6B7280',
},
```

---

### 3️⃣ ProductCard avec Sélecteur et Carousel

#### État et Logique

```typescript
const ProductCard: React.FC<ProductCardProps> = ({ product, ... }) => {
  // ✅ État pour variante sélectionnée
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // ✅ Détection du type de variantes selon la catégorie
  const getVariants = () => {
    switch (product.type) {
      case 'agroalimentaire':
      case 'aliments':
        return product.variants || [];
      case 'chaussure':
        return product.variantesChaussures || [];
      case 'hotellerie':
        return product.variantesChambres || [];
      case 'telephone':
        return product.variantesTelephone || [];
      case 'vetement':
        return product.variantesVetement || [];
      default:
        return [];
    }
  };

  const variants = getVariants();
  const hasVariants = variants && variants.length > 0;
  const currentVariant = hasVariants ? variants[selectedVariantIndex] : null;

  // ✅ Images de la variante ou images générales
  const variantImages = currentVariant?.images || [];
  const productImages = product.images || [];
  const displayImages = variantImages.length > 0 ? variantImages : productImages;
  const mainImage = displayImages[selectedImageIndex] || displayImages[0] || null;

  // ✅ Calcul fourchette de prix
  const getPriceRange = () => {
    if (!hasVariants) {
      return product.prix || product.prixParNuit || '0';
    }

    const prices = variants
      .map(v => parseFloat(v.prix))
      .filter(p => !isNaN(p) && p > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) return '0';

    const min = prices[0];
    const max = prices[prices.length - 1];

    return min === max
      ? `${min.toLocaleString()}`
      : `${min.toLocaleString()} - ${max.toLocaleString()}`;
  };

  // ✅ Label de variante selon catégorie
  const getVariantLabel = (variant: any) => {
    switch (product.type) {
      case 'chaussure':
        return `${variant.pointure} - ${variant.couleur}`;
      case 'hotellerie':
        return `${variant.typeChambre} (${variant.capacite})`;
      case 'telephone':
        return `${variant.stockage} ${variant.couleur}`;
      case 'vetement':
        return `${variant.taille} - ${variant.couleur}`;
      case 'agroalimentaire':
        return `${variant.quantite}${variant.unite} (${variant.conditionnement})`;
      default:
        return `Variante ${variant.id}`;
    }
  };

  // ...
```

#### UI : Carousel d'Images

```typescript
return (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    {/* ✅ Section Images avec Carousel */}
    <View style={styles.imageSection}>
      {/* Image principale */}
      <Image 
        source={{ uri: mainImage || 'default-image' }} 
        style={styles.mainImage} 
      />

      {/* Indicateur nombre d'images */}
      {displayImages.length > 1 && (
        <View style={styles.imageCounter}>
          <SafeIcon name="image" size={12} color="#FFF" />
          <Text style={styles.imageCounterText}>
            {selectedImageIndex + 1}/{displayImages.length}
          </Text>
        </View>
      )}

      {/* Boutons navigation images (si plusieurs) */}
      {displayImages.length > 1 && (
        <>
          {selectedImageIndex > 0 && (
            <TouchableOpacity
              style={[styles.imageNavButton, styles.imageNavLeft]}
              onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
            >
              <SafeIcon name="chevron-left" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
          {selectedImageIndex < displayImages.length - 1 && (
            <TouchableOpacity
              style={[styles.imageNavButton, styles.imageNavRight]}
              onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
            >
              <SafeIcon name="chevron-right" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Miniatures images (dots ou thumbs) */}
      {displayImages.length > 1 && (
        <View style={styles.imageDots}>
          {displayImages.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setSelectedImageIndex(idx)}
            >
              <View
                style={[
                  styles.imageDot,
                  selectedImageIndex === idx && styles.imageDotActive
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Badge nombre variantes */}
      {hasVariants && (
        <View style={styles.variantsBadge}>
          <Text style={styles.variantsBadgeText}>
            {variants.length} {variants.length > 1 ? 'options' : 'option'}
          </Text>
        </View>
      )}
    </View>

    {/* Nom du produit */}
    <Text style={styles.productName}>{product.name}</Text>

    {/* ✅ Sélecteur de Variantes */}
    {hasVariants && (
      <View style={styles.variantSelector}>
        <Text style={styles.variantSelectorLabel}>Choisir :</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.variantsList}
        >
          {variants.map((variant, index) => {
            const isSelected = selectedVariantIndex === index;
            const variantImages = variant.images || [];
            const firstImage = variantImages[0];

            return (
              <TouchableOpacity
                key={variant.id}
                style={[
                  styles.variantOption,
                  isSelected && styles.variantOptionActive
                ]}
                onPress={() => {
                  setSelectedVariantIndex(index);
                  setSelectedImageIndex(0); // Reset à la première image
                }}
              >
                {/* Miniature de la variante */}
                {firstImage && (
                  <Image 
                    source={{ uri: firstImage }} 
                    style={styles.variantThumb} 
                  />
                )}
                
                {/* Label de la variante */}
                <Text 
                  style={[
                    styles.variantLabel,
                    isSelected && styles.variantLabelActive
                  ]}
                  numberOfLines={2}
                >
                  {getVariantLabel(variant)}
                </Text>
                
                {/* Prix de la variante */}
                <Text 
                  style={[
                    styles.variantPrice,
                    isSelected && styles.variantPriceActive
                  ]}
                >
                  {parseFloat(variant.prix).toLocaleString()} F
                </Text>

                {/* Indicateur multiple images */}
                {variantImages.length > 1 && (
                  <View style={styles.variantImageCount}>
                    <SafeIcon name="image" size={10} color="#6B7280" />
                    <Text style={styles.variantImageCountText}>
                      {variantImages.length}
                    </Text>
                  </View>
                )}

                {/* Indicateur sélection */}
                {isSelected && (
                  <View style={styles.variantCheckmark}>
                    <SafeIcon name="check" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    )}

    {/* Prix adaptatif */}
    <View style={styles.priceSection}>
      {hasVariants && currentVariant ? (
        <>
          <Text style={styles.priceLabel}>Prix :</Text>
          <Text style={styles.price}>
            {parseFloat(currentVariant.prix).toLocaleString()} FCFA
          </Text>
        </>
      ) : (
        <>
          {hasVariants && <Text style={styles.priceLabel}>À partir de :</Text>}
          <Text style={styles.price}>
            {getPriceRange()} FCFA
          </Text>
        </>
      )}
    </View>

    {/* Autres infos... */}
  </TouchableOpacity>
);
```

#### Styles ProductCard

```typescript
// Images
imageSection: {
  position: 'relative',
  width: '100%',
  height: 200,
  marginBottom: 12,
},
mainImage: {
  width: '100%',
  height: '100%',
  borderRadius: 12,
  resizeMode: 'cover',
},
imageCounter: {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,0,0,0.6)',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
},
imageCounterText: {
  color: '#FFF',
  fontSize: 11,
  fontWeight: '600',
},
imageNavButton: {
  position: 'absolute',
  top: '50%',
  transform: [{ translateY: -20 }],
  backgroundColor: 'rgba(0,0,0,0.6)',
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
imageNavLeft: {
  left: 8,
},
imageNavRight: {
  right: 8,
},
imageDots: {
  position: 'absolute',
  bottom: 8,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 6,
},
imageDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: 'rgba(255,255,255,0.5)',
},
imageDotActive: {
  backgroundColor: '#FFF',
  width: 20,
},
variantsBadge: {
  position: 'absolute',
  top: 8,
  left: 8,
  backgroundColor: modernColors.primary,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 12,
},
variantsBadgeText: {
  color: '#FFF',
  fontSize: 11,
  fontWeight: '600',
},

// Sélecteur de variantes
variantSelector: {
  marginBottom: 12,
},
variantSelectorLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#374151',
  marginBottom: 8,
},
variantsList: {
  paddingRight: 12,
},
variantOption: {
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 8,
  padding: 8,
  marginRight: 8,
  width: 120,
  position: 'relative',
},
variantOptionActive: {
  backgroundColor: '#EFF6FF',
  borderColor: modernColors.primary,
  borderWidth: 2,
},
variantThumb: {
  width: '100%',
  height: 60,
  borderRadius: 6,
  resizeMode: 'cover',
  marginBottom: 6,
},
variantLabel: {
  fontSize: 11,
  color: '#6B7280',
  marginBottom: 2,
  textAlign: 'center',
},
variantLabelActive: {
  color: '#1F2937',
  fontWeight: '600',
},
variantPrice: {
  fontSize: 12,
  fontWeight: '600',
  color: '#374151',
  textAlign: 'center',
},
variantPriceActive: {
  color: modernColors.primary,
},
variantImageCount: {
  position: 'absolute',
  top: 4,
  right: 4,
  backgroundColor: 'rgba(0,0,0,0.6)',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  paddingHorizontal: 4,
  paddingVertical: 2,
  borderRadius: 8,
},
variantImageCountText: {
  color: '#FFF',
  fontSize: 9,
  fontWeight: '600',
},
variantCheckmark: {
  position: 'absolute',
  top: 4,
  left: 4,
  backgroundColor: modernColors.primary,
  borderRadius: 10,
  width: 20,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
```

---

### 4️⃣ Composant Réutilisable : VariantImageCarousel

**Fichier** : `mobile/src/components/VariantImageCarousel.tsx`

```typescript
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface VariantImageCarouselProps {
  images: string[];
  width?: number;
  height?: number;
  showDots?: boolean;
  showCounter?: boolean;
  showNavButtons?: boolean;
}

const VariantImageCarousel: React.FC<VariantImageCarouselProps> = ({
  images,
  width = '100%',
  height = 200,
  showDots = true,
  showCounter = true,
  showNavButtons = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <View style={[styles.emptyImage, { width, height }]}>
        <SafeIcon name="image" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>Aucune image</Text>
      </View>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Image principale */}
      <Image 
        source={{ uri: images[currentIndex] }} 
        style={styles.image} 
      />

      {/* Compteur */}
      {showCounter && images.length > 1 && (
        <View style={styles.counter}>
          <SafeIcon name="image" size={12} color="#FFF" />
          <Text style={styles.counterText}>
            {currentIndex + 1}/{images.length}
          </Text>
        </View>
      )}

      {/* Boutons navigation */}
      {showNavButtons && images.length > 1 && (
        <>
          <TouchableOpacity style={[styles.navButton, styles.navLeft]} onPress={goToPrevious}>
            <SafeIcon name="chevron-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navButton, styles.navRight]} onPress={goToNext}>
            <SafeIcon name="chevron-right" size={20} color="#FFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Dots indicateurs */}
      {showDots && images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, idx) => (
            <TouchableOpacity key={idx} onPress={() => setCurrentIndex(idx)}>
              <View style={[styles.dot, currentIndex === idx && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyImage: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 8,
  },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: 8,
  },
  navRight: {
    right: 8,
  },
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 20,
  },
});

export default VariantImageCarousel;
```

---

## 📊 EXEMPLES CONCRETS D'UTILISATION

### Exemple 1 : Hôtel avec Variantes de Chambres

**Variante 1 : Chambre Double** (4 images)
- Image 1 : Vue d'ensemble de la chambre
- Image 2 : Lit et mobilier
- Image 3 : Salle de bain
- Image 4 : Vue depuis le balcon

**Variante 2 : Suite Junior** (5 images)
- Image 1 : Salon de la suite
- Image 2 : Chambre à coucher
- Image 3 : Salle de bain avec jacuzzi
- Image 4 : Vue panoramique
- Image 5 : Balcon/Terrasse

**Affichage dans ProductCard** :
```
[Image principale avec carousel ◀️ 1/4 ▶️]
[•••○] (dots)

Hôtel Sawa ⭐⭐⭐⭐⭐

Choisir :
┌─────────┬─────────┐
│ [img]   │ [img]   │
│ Chambre │ Suite   │
│ Double  │ Junior  │
│ 50K F ✓ │ 95K F   │
└─────────┴─────────┘

Prix : 50 000 FCFA/nuit
```

Quand l'utilisateur clique sur "Suite Junior" :
- ✅ L'image principale change (devient image 1 de la suite)
- ✅ Le carousel affiche "1/5"
- ✅ Le prix change "95 000 FCFA/nuit"
- ✅ L'utilisateur peut naviguer entre les 5 photos

### Exemple 2 : Téléphone avec Variantes

**iPhone 15 Pro - 256GB Noir** (3 images)
- Image 1 : Face avant
- Image 2 : Face arrière
- Image 3 : Profil

**iPhone 15 Pro - 256GB Bleu Titane** (3 images)
- Image 1 : Face avant (couleur bleue visible)
- Image 2 : Face arrière (couleur bleue visible)
- Image 3 : Profil

**Affichage** :
```
[Image avec carousel ◀️ 1/3 ▶️]

iPhone 15 Pro

Choisir :
┌──────────┬──────────┬──────────┐
│ [img]    │ [img]    │ [img]    │
│ 256GB    │ 256GB    │ 512GB    │
│ Noir ✓   │ Bleu     │ Noir     │
│ 450K F   │ 450K F   │ 550K F   │
│ [📷 3]   │ [📷 3]   │ [📷 3]   │
└──────────┴──────────┴──────────┘

Prix : 450 000 FCFA
```

### Exemple 3 : Chaussures avec Variantes

**Basket Nike - Pointure 40 Rouge** (4 images)
- Image 1 : Vue latérale
- Image 2 : Vue dessus
- Image 3 : Semelle
- Image 4 : Détail logo

**Basket Nike - Pointure 42 Noir** (4 images)
- Images différentes montrant la couleur noire

**Affichage** :
```
[Image avec carousel ◀️ 1/4 ▶️]

Basket Nike Air Max

Choisir :
┌────────┬────────┬────────┐
│ [img]  │ [img]  │ [img]  │
│ 40     │ 42     │ 44     │
│ Rouge✓ │ Noir   │ Blanc  │
│ 25K F  │ 25K F  │ 28K F  │
│ [📷 4] │ [📷 4] │ [📷 3] │
└────────┴────────┴────────┘

Prix : 25 000 FCFA
```

---

## 🎨 UX/UI - Expérience Utilisateur

### Workflow Utilisateur

1. **Arrivée sur ProductCard**
   - Voit l'image de la première variante
   - Voit "3 options" en badge
   - Voit "25 000 - 28 000 FCFA" en fourchette

2. **Clique sur une variante** (ex: Pointure 42 Noir)
   - ✅ L'image principale change instantanément
   - ✅ Le carousel reset à 1/4
   - ✅ Le prix change "25 000 FCFA"
   - ✅ Le sélecteur montre ✓ sur la variante

3. **Navigate dans les images** (◀️ ▶️ ou dots)
   - ✅ Voit les 4 photos de la chaussure noire
   - ✅ Compteur "2/4", "3/4", "4/4"

4. **Change de variante** (ex: Pointure 44 Blanc)
   - ✅ Tout se met à jour
   - ✅ Voit les 3 photos de la chaussure blanche
   - ✅ Prix "28 000 FCFA"

### Avantages

| Aspect | Bénéfice |
|--------|----------|
| **Plusieurs images** | Voir le produit sous tous les angles |
| **Images par variante** | Voir la vraie couleur/version |
| **Carousel** | Navigation fluide |
| **Prix dynamique** | Transparence totale |
| **Miniatures** | Comparaison visuelle rapide |

---

## 🛠️ IMPLÉMENTATION TECHNIQUE

### Checklist d'Implémentation

#### Pour Créer une Nouvelle Catégorie avec Variantes

**Étape 1 : Créer l'Interface**
```typescript
export interface [Type]Variant {
  id: string;
  caracteristiqueVariable1: string;
  caracteristiqueVariable2?: string;
  prix: string;
  devise: string;
  images?: string[];  // ✅ ARRAY
  stockDisponible?: number;
  reference?: string;
}
```

**Étape 2 : Créer le Manager**
- [ ] Import ImagePicker
- [ ] Fonction handleImagePicker avec `allowsMultipleSelection: true`
- [ ] Fonction handleRemoveImage
- [ ] Affichage grid horizontal des images
- [ ] Bouton "Ajouter des images"
- [ ] Compteur "(3)" sur le bouton

**Étape 3 : Intégrer dans Formulaire**
- [ ] Import du Manager
- [ ] Ajout champ `variantes[Type]?: [Type]Variant[]`
- [ ] Intégration dans une section

**Étape 4 : Configuration**
- [ ] `supportsVariants: true`
- [ ] Ajout dans `VARIANT_SUPPORTED_CATEGORIES`

**Étape 5 : ProductCard**
- [ ] Gérer récupération des variantes selon type
- [ ] Fonction getVariantLabel()
- [ ] État selectedVariantIndex + selectedImageIndex
- [ ] Affichage carousel d'images
- [ ] Affichage sélecteur de variantes
- [ ] Prix adaptatif

---

## 📋 RÉSUMÉ - Système Images Variantes

### Architecture

```
┌─────────────────────────────────────────┐
│  [Type]VariantManager                   │
│  ─────────────────────────────────────  │
│  ✅ Upload MULTIPLE images              │
│  ✅ Affichage grid horizontal           │
│  ✅ Suppression image individuelle      │
│  ✅ Compteur "(4 images)"               │
└─────────────────────────────────────────┘
              ↓ Sauvegarde
┌─────────────────────────────────────────┐
│  Product.variantes[Type]                │
│  ────────────────────────────────────── │
│  [                                       │
│    {                                     │
│      id: "var-1",                        │
│      caracteristique: "...",             │
│      prix: "50000",                      │
│      images: [                           │
│        "img1.jpg", ← Vue 1               │
│        "img2.jpg", ← Vue 2               │
│        "img3.jpg", ← Vue 3               │
│        "img4.jpg"  ← Vue 4               │
│      ]                                   │
│    },                                    │
│    ...                                   │
│  ]                                       │
└─────────────────────────────────────────┘
              ↓ Affichage
┌─────────────────────────────────────────┐
│  ProductCard                             │
│  ─────────────────────────────────────  │
│  ✅ Sélecteur de variantes horizontal   │
│  ✅ Carousel d'images par variante      │
│  ✅ Navigation ◀️ ▶️ + Dots             │
│  ✅ Prix adaptatif selon sélection      │
│  ✅ Badge "3 options"                    │
└─────────────────────────────────────────┘
```

### Données Sauvegardées

```json
{
  "name": "iPhone 15 Pro",
  "type": "telephone",
  "variantesTelephone": [
    {
      "id": "var-1",
      "stockage": "256GB",
      "couleur": "Noir",
      "prix": "450000",
      "devise": "XAF",
      "stockDisponible": 5,
      "images": [
        "file:///path/to/iphone-noir-face.jpg",
        "file:///path/to/iphone-noir-dos.jpg",
        "file:///path/to/iphone-noir-profil.jpg"
      ]
    },
    {
      "id": "var-2",
      "stockage": "256GB",
      "couleur": "Bleu Titane",
      "prix": "450000",
      "devise": "XAF",
      "stockDisponible": 3,
      "images": [
        "file:///path/to/iphone-bleu-face.jpg",
        "file:///path/to/iphone-bleu-dos.jpg",
        "file:///path/to/iphone-bleu-profil.jpg"
      ]
    },
    {
      "id": "var-3",
      "stockage": "512GB",
      "couleur": "Noir",
      "prix": "550000",
      "devise": "XAF",
      "stockDisponible": 2,
      "images": [
        "file:///path/to/iphone-512-noir-1.jpg",
        "file:///path/to/iphone-512-noir-2.jpg"
      ]
    }
  ]
}
```

---

## ✅ CHECKLIST COMPLÈTE - Images Variantes

### Pour Créer une Catégorie avec Images Multiples

- [ ] Interface [Type]Variant avec `images?: string[]`
- [ ] Fonction handleImagePicker avec `allowsMultipleSelection: true`
- [ ] Fonction handleRemoveImage individuelle
- [ ] Affichage grid horizontal des images dans Manager
- [ ] Bouton "Ajouter des images (X)" avec compteur
- [ ] ProductCard récupère les bonnes variantes selon type
- [ ] ProductCard affiche carousel d'images
- [ ] ProductCard affiche sélecteur de variantes
- [ ] Prix s'adapte à la sélection
- [ ] Image change à la sélection
- [ ] Navigation ◀️ ▶️ fonctionnelle
- [ ] Dots/Points de navigation
- [ ] Badge "X options"
- [ ] Compteur "1/4" sur image

---

## 🎯 CATÉGORIES RECOMMANDÉES POUR IMAGES MULTIPLES

| Catégorie | Variantes | Images par Variante | Utilité |
|-----------|-----------|---------------------|---------|
| **Téléphones** | Stockage × Couleur | 3-4 | Voir les couleurs réelles |
| **Chaussures** | Pointure × Couleur | 3-5 | Voir tous les angles |
| **Vêtements** | Taille × Couleur | 3-4 | Voir le rendu |
| **Hôtellerie** | Type chambre | 4-6 | Chambre, SDB, vue, balcon |
| **Automobile** | - | 6-10 | Extérieur, intérieur, moteur |
| **Immobilier** | - | 10-20 | Toutes les pièces |
| **Alimentation** | Quantité | 2-3 | Packaging différent |

---

## 📱 EXPÉRIENCE MOBILE

### Gestes Supportés

| Geste | Action |
|-------|--------|
| **Tap sur variante** | Change variante + reset image |
| **Swipe horizontal** | Navigate entre images |
| **Tap ◀️ ▶️** | Navigate entre images |
| **Tap sur dot** | Va à l'image spécifique |
| **Tap sur image** | Ouvre galerie plein écran |

### Performance

| Aspect | Optimisation |
|--------|--------------|
| **Images** | Quality: 0.8 (80%) |
| **Thumbnails** | 80x80px maximum |
| **Lazy loading** | Charger images au scroll |
| **Cache** | React Native Image cache |

---

## 🎓 BONNES PRATIQUES

### ✅ À FAIRE

1. **Harmoniser toutes les variantes** avec `images?: string[]`
2. **Limiter à 5-6 images** par variante (performance)
3. **Compresser les images** (quality: 0.8)
4. **Afficher un compteur** "(3 images)" pour informer
5. **Permettre suppression individuelle** des images
6. **Reset selectedImageIndex** quand on change de variante
7. **Afficher miniature** de la première image dans sélecteur

### ❌ À ÉVITER

1. ❌ Upload images non compressées (trop lourdes)
2. ❌ Plus de 10 images par variante (surcharge)
3. ❌ Oublier le carousel dans ProductCard
4. ❌ Ne pas reset l'index d'image au changement de variante
5. ❌ Miniatures trop grandes (max 80x80px)

---

## 🔧 AMÉLIORATIONS À APPORTER

### Priorité 1 : Harmonisation (Urgent)

- [ ] Mettre à jour ProductVariant : `image` → `images`
- [ ] Mettre à jour HotelVariant : `image` → `images`
- [ ] Mettre à jour ProductVariantManager : handleImagePicker multiple
- [ ] Mettre à jour HotelVariantManager : handleImagePicker multiple

### Priorité 2 : ProductCard (Important)

- [ ] Créer fonction getVariants() universelle
- [ ] Créer fonction getVariantLabel() universelle
- [ ] Ajouter état selectedVariantIndex
- [ ] Ajouter état selectedImageIndex
- [ ] Implémenter carousel d'images
- [ ] Implémenter sélecteur de variantes
- [ ] Gérer prix adaptatif

### Priorité 3 : Composant Réutilisable (Optionnel mais recommandé)

- [ ] Créer VariantImageCarousel.tsx
- [ ] Utiliser dans ProductCard
- [ ] Utiliser dans détails produit (modal)

---

## 📚 DOCUMENTATION

Toutes ces améliorations doivent être documentées dans :

1. **GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md** :
   - Section "Images multiples par variante"
   - Pattern d'implémentation
   - Exemples de code

2. **Récapitulatifs de catégories** :
   - Section "Système d'images"
   - Exemples concrets

3. **Composant VariantImageCarousel** :
   - Props
   - Usage
   - Exemples

---

## 🎉 CONCLUSION

Le système complet permet :

✅ **Upload** : Plusieurs images par variante (max 5-6)
✅ **Gestion** : Suppression individuelle, grid horizontal
✅ **Affichage** : Carousel avec navigation
✅ **Sélection** : Miniatures cliquables
✅ **Dynamique** : Image + Prix changent automatiquement

**Prochaine étape** : Implémenter ces améliorations dans le code existant ! 🚀

**Version** : 1.0.0  
**Date** : 27 Octobre 2025  
**Statut** : ✅ Spécifications Complètes


