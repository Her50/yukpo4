# Amélioration de l'affichage de la commande de livraison de colis

## ✅ Modifications apportées

### 1. **Correction des icônes et suppression de "Autre"**
- ✅ Icônes corrigées pour les types de colis :
  - Document : `file-text`
  - Colis : `package`
  - Déménagement : `truck`
  - Gâteau : `cake` (emoji 🎂)
- ✅ Suppression de la modalité "Autre"
- ✅ 4 modalités finales : Document, Colis, Déménagement, Gâteau

### 2. **Restructuration des types de colis**
- ✅ Affichage en grille 2 colonnes x 2 lignes (au lieu d'une ligne horizontale)
- ✅ Pour le bouton "Déménagement" :
  - Icône en haut
  - Texte en bas avec taille réduite (11px mobile, xs frontend)
  - Texte visible sur une ligne

### 3. **Formulaire adaptatif selon le type de colis**

#### Document
- Nombre de pages (optionnel)
- Valeur déclarée (FCFA)

#### Colis standard
- Poids (kg)
- Volume (L)
- Valeur déclarée (FCFA)

#### Déménagement
- Nombre de cartons
- Meubles à transporter (optionnel)
- Accès (étage, ascenseur, etc.)
- Volume estimé (m³)

#### Gâteau
- Taille du gâteau
- Nombre d'étages
- Poids (kg)

### 4. **Type de transport remonté avant les photos**
- ✅ Le sélecteur de type de transport est maintenant placé avant la section "Photos du colis"
- ✅ Organisé en grille 4 colonnes x 2 lignes
- ✅ Boutons et icônes réduits pour tenir sur 4 colonnes :
  - Mobile : largeur 23%, icônes 24px, texte 10px
  - Frontend : grille grid-cols-4, min-h-[80px], texte xs

### 5. **Types de transport disponibles**
- 🚲 Vélo cargo
- 🏍️ Moto
- 🛺 Tricycle
- 🚗 Voiture
- 🛻 Pick-up
- 🚐 Fourgonnette
- 🚚 Camion
- 🚶 À pied

## 📁 Fichiers modifiés

### Mobile
- `mobile/src/screens/delivery/DeliveryParcelFlowNew.tsx`
  - États ajoutés pour formulaire adaptatif
  - Restructuration UI types de colis
  - Formulaire conditionnel selon type
  - Type de transport remonté avant photos
  - Grille 4 colonnes pour transport

### Frontend
- `frontend/src/pages/delivery/DeliveryParcelFlowPage.tsx`
  - États ajoutés pour formulaire adaptatif
  - Restructuration UI types de colis
  - Formulaire conditionnel selon type
  - Type de transport remonté avant photos
  - Grille 4 colonnes pour transport
  - Constantes VEHICLE_TRANSPORT_OPTIONS ajoutées

## 💾 Système de sauvegarde des médias

### Table `delivery_parcels`
Les photos des colis sont stockées dans la table `delivery_parcels` dans le champ JSONB `photos` :

```sql
CREATE TABLE IF NOT EXISTS delivery_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL,
    weight_kg NUMERIC(6,2),
    volume_cm3 NUMERIC(12,2),
    declared_value NUMERIC(10,2),
    notes TEXT,
    photos JSONB DEFAULT '[]'::jsonb,  -- ✅ Photos stockées ici en base64
    constraints JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Format des photos
- Les photos sont envoyées depuis le frontend/mobile en **base64** dans le payload
- Elles sont stockées directement dans le champ JSONB `photos` comme un tableau de chaînes base64
- **Pas de table spécifique** pour les médias de livraison (contrairement aux services qui utilisent la table `media`)
- **Pas de stockage S3/CDN** pour les photos de livraison (stockage direct en base64 dans PostgreSQL)

### Comparaison avec les services
- **Services** : utilisent la table `media` avec upload S3/Wasabi via `MediaStorageService`
- **Livraisons** : stockage direct en base64 dans JSONB, pas d'upload S3

### Note importante
⚠️ **Pour les services**, les médias utilisent :
- Table `media` avec `storage_path` (S3/CDN)
- Service `MediaStorageService` pour upload vers S3/Wasabi
- Référence via `service_id` dans la table `media`

⚠️ **Pour les livraisons**, les photos utilisent :
- Stockage direct en base64 dans `delivery_parcels.photos` (JSONB)
- Pas de table dédiée
- Pas d'upload S3/CDN actuellement

### Recommandation future
Pour améliorer les performances et réduire la taille de la base de données, envisager :
1. Créer une table `delivery_media` similaire à `media`
2. Utiliser `MediaStorageService` pour uploader vers S3/Wasabi
3. Stocker les URLs CDN dans `delivery_parcels.photos` au lieu de base64

## 🎨 Améliorations UI/UX

### Mobile
- Grille responsive 2x2 pour types de colis
- Grille 4 colonnes pour types de transport (visible sans scroll)
- Formulaire adaptatif réduisant les champs inutiles

### Frontend
- Même structure que mobile pour cohérence
- Classes Tailwind pour styling responsive
- Amélioration de la lisibilité avec icônes et textes mieux positionnés

## 📝 Payload envoyé au backend

Les contraintes spécifiques au type de colis sont maintenant incluses dans le payload :

```typescript
constraints: {
    // Document
    number_of_pages?: number,
    
    // Déménagement
    is_moving?: boolean,
    boxes?: string,
    furniture?: string,
    access?: string,
    
    // Gâteau
    cake_size?: string,
    cake_layers?: number,
    
    // Commun
    weight?: number,
    volume?: number,
    declared_value?: number,
}
```

## ✅ Tâches complétées

- [x] Correction des icônes des types de colis
- [x] Suppression de la modalité "Autre"
- [x] Restructuration 2 colonnes x 2 lignes
- [x] Amélioration du bouton Déménagement (icône haut, texte bas)
- [x] Formulaire adaptatif selon type de colis
- [x] Type de transport remonté avant les photos
- [x] Organisation transport sur 4 colonnes x 2 lignes
- [x] Vérification système de sauvegarde des médias
- [x] Documentation du système de sauvegarde

