# 📋 Plan de Migration Catégorie par Catégorie

## 🎯 Objectif

Optimiser l'UX de chaque catégorie de produits en :
- Vérifiant que tous les champs utilisent ProductFieldSelector
- S'assurant que les modalités sont complètes et pertinentes
- Ajoutant multi-select où nécessaire
- Créant les formulaires manquants

---

## ✅ **Catégories COMPLÈTES** (ProductFieldSelector intégré)

### 1. **immobilier_batiment** ✅

**Champs avec modalités** :
- ✅ Type d'immobilier → `types`
- ✅ Statut → `statuts`
- ✅ Ameublement → `ameublement`

**Modalités disponibles** :
- types: 19 options (Appartement, Maison, Villa...)
- statuts: 7 options (À vendre, À louer...)
- ameublement: 6 options (Non meublé, Meublé...)

**À améliorer** :
- [ ] Ajouter chauffage → `chauffage`
- [ ] Ajouter orientation → `orientation`

---

### 2. **immobilier_terrain** ❓

**À vérifier** :
- [ ] Utilise-t-il ProductFieldSelector ?
- [ ] Quels champs ont des modalités ?

---

### 3. **automobile** ✅

**Champs avec modalités** :
- ✅ Marque → `marques`
- ✅ État → `etat`
- ✅ Carburant → `carburant`
- ✅ Transmission → `transmission`
- ✅ Couleur → `couleur`

**Modalités disponibles** :
- marques: 42 options
- transmission: 7 options
- carburant: 8 options
- etat: 8 options
- couleur: 16 options

**À améliorer** :
- [x] Tous les champs utilisent ProductFieldSelector
- [x] Couleur devrait être single-select (une voiture = une couleur)

---

### 4. **ticket_voyage** ✅

**Champs avec modalités** :
- ✅ Compagnie → `compagnies`
- ✅ Type véhicule → `vehicules`
- ✅ Classe → `classes`

**Modalités disponibles** :
- compagnies: 16 options
- vehicules: 11 options
- classes: 6 options

**À améliorer** :
- [x] Tous les champs utilisent ProductFieldSelector

---

### 5. **hotellerie** ✅

**Champs avec modalités** :
- ✅ Type hébergement → `types`
- ✅ Catégorie (étoiles) → `categories`
- ✅ Types de chambres → `chambres` (multi-select)
- ✅ Équipements → `equipements` (multi-select)

**Modalités disponibles** :
- types: 13 options
- categories: 8 options
- chambres: 10 options
- equipements: 20 options

**À améliorer** :
- [x] Multi-select pour chambres et équipements

---

### 6. **covoiturage** ❓

**À vérifier** :
- [ ] Utilise-t-il ProductFieldSelector ?
- [ ] Quels champs ont des modalités ?

---

### 7. **vetement** ✅

**Champs avec modalités** :
- ✅ Taille → `tailles`
- ✅ Couleur → `couleurs` (multi-select)
- ✅ Matière → `matieres`
- ✅ Marque → `marques`

**Modalités disponibles** :
- tailles: 26 options
- couleurs: 15 options
- matieres: 15 options
- marques: 15 options

**À améliorer** :
- [x] Couleurs en multi-select
- [ ] Ajouter types de vêtements → `types`

---

### 8. **chaussure** ✅

**Champs avec modalités** :
- ✅ Pointure → `pointures`
- ✅ Couleur → `couleurs`
- ✅ Marque → `marques`

**Modalités disponibles** :
- pointures: 17 options
- couleurs: 15 options (partagé avec vêtements)
- marques: 13 options

**À améliorer** :
- [ ] Ajouter types de chaussures → `types`
- [ ] Ajouter matériaux → `materiaux`

---

### 9. **electromenager** ✅

**Champs avec modalités** :
- ✅ Type d'appareil → `types`
- ✅ Marque → `marques`
- ✅ État → `etats`
- ✅ Garantie → `garanties`

**Modalités disponibles** :
- types: 11 options
- marques: 15 options
- etats: 8 options
- garanties: 7 options

**À améliorer** :
- [x] Tous les champs utilisent ProductFieldSelector

---

### 10. **mobilier** ✅

**Champs avec modalités** :
- ✅ Type → `types`
- ✅ Matériau → `matieres`
- ✅ Couleur → `couleurs`
- ✅ État → `etats`

**Modalités disponibles** :
- types: 15 options
- matieres: 12 options
- couleurs: 15 options
- etats: 8 options

**À améliorer** :
- [ ] Ajouter styles → `styles`

---

### 11. **decoration** ✅

**Champs avec modalités** :
- ✅ Type → `types`
- ✅ Style → `styles`

**Modalités disponibles** :
- types: 11 options (via mobilier)
- styles: 12 options (via mobilier)

**À améliorer** :
- [ ] Créer DECORATION_MODALITIES séparées

---

### 12-30. **Autres catégories** ❓

**À vérifier pour chacune** :
- [ ] aliments
- [ ] quincaillerie
- [ ] prestation_service
- [ ] livres_fournitures
- [ ] pharmacie
- [ ] hopital_clinique
- [ ] agroalimentaire
- [ ] demenagement
- [ ] cosmetique_parfum
- [ ] bijoux
- [ ] coiffure_beaute
- [ ] assurance
- [ ] telephone
- [ ] ordinateur
- [ ] image_son
- [ ] pieces_auto
- [ ] pieces_industrielles
- [ ] jouets_enfants
- [ ] ustensiles_cuisine

---

## ❌ **Catégories MANQUANTES** (formulaires à créer)

### 31. **restauration**

**Modalités disponibles** (798:845):
- types_cuisine
- specialites
- services
- ambiances
- gammes_prix
- certifications
- options_alimentaires
- capacites
- jours_fermeture

**Formulaire à créer** :
```typescript
case 'restauration':
    return (
        <>
            <ProductFieldSelector
                label="Type de cuisine"
                fieldName="types_cuisine"
                productType="restauration"
                value={newProduct.typeCuisine || ''}
                onSelect={(value) => setNewProduct({ ...newProduct, typeCuisine: value })}
                required
            />
            
            <ProductFieldSelector
                label="Spécialités"
                fieldName="specialites"
                productType="restauration"
                value={newProduct.specialites || []}
                onSelect={(values) => setNewProduct({ ...newProduct, specialites: values })}
                multiSelect
            />
            
            {/* ... autres champs */}
        </>
    );
```

---

### 32. **electronique**

**Modalités disponibles** (846:874):
- types
- marques
- modeles
- etats
- garanties
- connectivites
- compatibilites

**Formulaire à créer** : OUI

---

### 33-45. **Autres catégories manquantes**

- [ ] formation_education
- [ ] evenementiel
- [ ] agriculture
- [ ] sport_fitness
- [ ] bien_etre_spa
- [ ] animaux_veterinaire
- [ ] nettoyage_entretien
- [ ] jardinage_paysagisme
- [ ] securite_surveillance
- [ ] plomberie
- [ ] electricite
- [ ] menuiserie
- [ ] musique_instruments

---

## 📝 **Actions prioritaires**

### **Phase 1 : Nettoyage** (MAINTENANT)
1. [ ] Supprimer les constantes inutilisées
   - MARQUES_AUTOMOBILES
   - TYPES_TRANSMISSION
   - TYPES_CARBURANT
   - etc.

### **Phase 2 : Vérification catégorie par catégorie** (ENSUITE)
1. [ ] immobilier_terrain
2. [ ] covoiturage
3. [ ] aliments
4. [ ] quincaillerie
5. [ ] ... toutes les autres

### **Phase 3 : Création des formulaires manquants** (APRÈS)
1. [ ] restauration
2. [ ] electronique
3. [ ] formation_education
4. [ ] ... toutes les autres

---

## 🎯 **Prochaine étape immédiate**

**Supprimer les constantes inutilisées** dans ProductManagerMobile.tsx :

```typescript
// ❌ À SUPPRIMER (remplacées par productModalities.ts)
const MARQUES_AUTOMOBILES = [ ... ];
const TYPES_TRANSMISSION = [ ... ];
const TYPES_CARBURANT = [ ... ];
const ETATS_VEHICULE = [ ... ];
const TYPES_IMMOBILIERS = [ ... ];
const STATUTS_IMMOBILIERS = [ ... ];
const NIVEAUX_AMEUBLEMENT = [ ... ];
const COMPAGNIES_VOYAGE = [ ... ];
const CLASSES_VOYAGE = [ ... ];
const TYPES_VEHICULES_TRANSPORT = [ ... ];
const CATEGORIES_HOTEL = [ ... ];
const EQUIPEMENTS_HOTEL = [ ... ];
const TYPES_HEBERGEMENT = [ ... ];
const TYPES_CHAMBRES_HOTEL = [ ... ];
```

Voulez-vous que je commence par supprimer ces constantes ? 🗑️













