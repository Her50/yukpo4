# Vérification Configuration Pickup Prestataire - Checklist

## ✅ Objectifs
1. Vérifier que le mode de transport est prévu dans la configuration pickup des produits
2. Aligner les types de véhicules avec ceux du formulaire de commande
3. Vérifier la navigation vers la page de configuration (mobile et frontend)

## 📋 Types de véhicules à aligner
- `bike` → Vélo
- `motorcycle` → Moto  
- `tricycle` → Tricycle
- `car` → Voiture
- `pickup` → Pickup
- `van` → Fourgonnette
- `truck` → Camion
- `walking` → À pied

## 🔍 Points à vérifier

### Backend
- ✅ Route: `POST /api/delivery/product-config` - Accepte `ProductDeliveryConfigInput`
- ✅ Route: `GET /api/delivery/product-config/{service_id}/{product_index}` - Retourne la config
- ✅ Champ `required_vehicle_type_id` existe dans `ProductDeliveryConfig`
- ⚠️ **À VÉRIFIER**: Le champ `required_vehicle_type` (string) est-il ajouté dans `ProductDeliveryConfigInput` ?
- ⚠️ **À VÉRIFIER**: Le type de véhicule est-il stocké dans `pickup_instructions` (JSON) ou dans un champ dédié ?

### Frontend
- ⚠️ **À VÉRIFIER**: Page de configuration de livraison pour produits
- ⚠️ **À VÉRIFIER**: Navigation depuis `MesProduits` ou `ProductDetail`
- ⚠️ **À VÉRIFIER**: Sélection du type de véhicule dans le formulaire
- ⚠️ **À VÉRIFIER**: Service API `saveProductDeliveryConfig` existe-t-il ?

### Mobile
- ⚠️ **À VÉRIFIER**: Écran de configuration de livraison pour produits
- ⚠️ **À VÉRIFIER**: Navigation depuis `MesProduitsScreen` ou `ProductDetailScreen`
- ⚠️ **À VÉRIFIER**: Sélection du type de véhicule dans le formulaire
- ⚠️ **À VÉRIFIER**: Service API `saveProductDeliveryConfig` existe-t-il ?

## 🔧 Modifications nécessaires

### 1. Backend - Stockage du type de véhicule
- [ ] Ajouter `required_vehicle_type` (string) dans `ProductDeliveryConfigInput`
- [ ] Stocker le type de véhicule dans `pickup_instructions` (JSON) ou créer un champ dédié
- [ ] Mapper les types du formulaire vers les IDs de `parcel_types` si nécessaire

### 2. Frontend - Page de configuration
- [ ] Vérifier si la page existe déjà
- [ ] Ajouter sélection du type de véhicule (8 options alignées)
- [ ] Vérifier la navigation depuis les pages produits
- [ ] Ajouter le champ dans le formulaire de soumission

### 3. Mobile - Écran de configuration
- [ ] Vérifier si l'écran existe déjà
- [ ] Ajouter sélection du type de véhicule (8 options alignées)
- [ ] Vérifier la navigation depuis les écrans produits
- [ ] Ajouter le champ dans le formulaire de soumission

### 4. Matching
- [ ] Vérifier que le matching utilise le type de véhicule de la config produit
- [ ] Prioriser les coursiers avec le bon type de véhicule

## 📍 Navigation à vérifier

### Frontend
- Depuis `MesProduits` → Bouton "Configurer livraison" sur chaque produit
- Depuis `ProductDetail` → Section "Configuration de livraison"
- Depuis `DashboardPrestataire` → Lien vers configuration produits

### Mobile
- Depuis `MesProduitsScreen` → Action "Configurer livraison"
- Depuis `ProductDetailScreen` → Section "Configuration de livraison"
- Depuis `DashboardPrestataireScreen` → Lien vers configuration produits

## 🎯 Prochaines étapes
1. Identifier les pages/écrans existants de configuration
2. Vérifier si le type de véhicule est déjà présent
3. Ajouter/modifier le champ si nécessaire
4. Vérifier la navigation
5. Tester le flux complet
