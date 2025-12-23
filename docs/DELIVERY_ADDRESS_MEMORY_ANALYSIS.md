# Analyse : Mémorisation des Adresses dans le Système Delivery

## 📋 État Actuel du Système

### Base de Données

#### Tables Existantes
1. **`deliveries`** - Table principale des livraisons
   - `pickup_address` (TEXT) - Adresse de collecte
   - `dropoff_address` (TEXT) - Adresse de livraison
   - `pickup_location` (GEOGRAPHY Point) - Coordonnées GPS de collecte
   - `dropoff_location` (GEOGRAPHY Point) - Coordonnées GPS de livraison
   - ✅ **Les adresses sont stockées, mais pas réutilisables**

2. **`merchant_storage_locations`** - Lieux de stock des marchands
   - Permet aux marchands de définir des lieux de stock
   - ✅ **Existe uniquement pour les marchands, pas pour les clients**

3. **`users`** - Table utilisateurs
   - `gps` (VARCHAR) - Position GPS actuelle de l'utilisateur
   - ❌ **Pas de système d'adresses sauvegardées**

### Frontend Mobile

#### Écrans de Delivery Analysés

1. **`DeliveryParcelFlowNew.tsx`** (Livraison de colis)
   - Utilise `ModernGPSModal` pour sélectionner pickup/dropoff
   - Les adresses sont saisies manuellement à chaque fois
   - ❌ **Pas de suggestion d'adresses précédentes**

2. **`DeliveryShoppingFlowNew.tsx`** (Livraison shopping)
   - Utilise également `ModernGPSModal`
   - ❌ **Pas de mémorisation des adresses**

3. **`OrderDeliveryModal.tsx`** (Commande avec livraison)
   - Modal pour commander un produit avec livraison
   - ❌ **Pas d'accès aux adresses sauvegardées**

4. **`ProductDeliveryConfigModal.tsx`** (Configuration livraison produit)
   - Pour les marchands qui configurent leurs produits
   - Utilise `LocationSelector` avec enrichissement backend
   - ✅ **Permet de sélectionner des `merchant_storage_locations`**
   - ❌ **Mais pas d'historique d'adresses pour les clients**

## ❌ Problèmes Identifiés

### 1. Absence de Système de Mémorisation
- Les utilisateurs doivent ressaisir leurs adresses à chaque commande
- Pas de table `user_saved_addresses` ou équivalent
- Pas d'historique des adresses utilisées

### 2. Expérience Utilisateur Dégradée
- Saisie répétitive des mêmes adresses
- Risque d'erreurs de saisie
- Temps perdu lors de chaque commande

### 3. Incohérence avec les Marchands
- Les marchands peuvent mémoriser des lieux de stock (`merchant_storage_locations`)
- Les clients ne peuvent pas mémoriser leurs adresses de livraison

## ✅ Solution Proposée

### Phase 1 : Base de Données

#### Créer la table `user_saved_addresses`

```sql
CREATE TABLE IF NOT EXISTS user_saved_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identification de l'adresse
    label VARCHAR(100) NOT NULL, -- Ex: "Domicile", "Bureau", "Maison", "Adresse 1"
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')),
    
    -- Données géographiques
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Enrichissement (composants LocationObject)
    location_data JSONB, -- Pour stocker quartier, ville, pays, etc.
    
    -- Informations complémentaires
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    instructions TEXT, -- Instructions de livraison spécifiques
    building_number VARCHAR(50),
    floor VARCHAR(50),
    apartment VARCHAR(50),
    
    -- Métadonnées
    is_default_pickup BOOLEAN DEFAULT FALSE,
    is_default_dropoff BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0, -- Nombre de fois utilisée
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Un seul label par utilisateur (éviter les doublons)
    UNIQUE(user_id, label)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id ON user_saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_type ON user_saved_addresses(user_id, address_type);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_default ON user_saved_addresses(user_id, is_default_pickup, is_default_dropoff);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_active ON user_saved_addresses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_last_used ON user_saved_addresses(user_id, last_used_at DESC);

-- Index spatial pour recherche géographique
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_location 
ON user_saved_addresses USING GIST(ST_MakePoint(longitude, latitude));
```

### Phase 2 : Backend (Rust)

#### Nouveau Modèle : `user_saved_address.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserSavedAddress {
    pub id: i32,
    pub user_id: i32,
    pub label: String,
    pub address_type: AddressType, // Enum: Pickup, Dropoff, Both
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub location_data: Option<Value>, // JSONB pour LocationObject
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub instructions: Option<String>,
    pub building_number: Option<String>,
    pub floor: Option<String>,
    pub apartment: Option<String>,
    pub is_default_pickup: bool,
    pub is_default_dropoff: bool,
    pub usage_count: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

#### Nouveaux Endpoints API

1. **GET `/api/delivery/saved-addresses`** - Lister les adresses sauvegardées
   - Paramètres optionnels : `address_type` (pickup/dropoff/both)
   - Retourne les adresses triées par `last_used_at DESC`, puis par `label`

2. **POST `/api/delivery/saved-addresses`** - Créer une nouvelle adresse
   - Accepte `UserSavedAddressInput` avec validation

3. **PUT `/api/delivery/saved-addresses/:id`** - Mettre à jour une adresse

4. **DELETE `/api/delivery/saved-addresses/:id`** - Supprimer une adresse

5. **PATCH `/api/delivery/saved-addresses/:id/set-default`** - Définir comme adresse par défaut
   - Paramètre : `address_type` (pickup/dropoff)
   - Désactive automatiquement les autres adresses par défaut du même type

6. **POST `/api/delivery/saved-addresses/from-delivery/:delivery_id`** - Sauvegarder depuis une livraison
   - Permet de sauvegarder rapidement une adresse après une livraison

#### Logique de Suggestion Automatique

Lors de la création d'une livraison :
1. Si l'utilisateur a des adresses sauvegardées, les proposer en premier
2. Suggérer l'adresse par défaut (si définie)
3. Suggérer les adresses récemment utilisées (triées par `last_used_at DESC`)
4. Incrémenter `usage_count` et mettre à jour `last_used_at` quand une adresse est utilisée

### Phase 3 : Frontend Mobile

#### Nouveau Hook : `useSavedAddresses.ts`

```typescript
export const useSavedAddresses = (addressType?: 'pickup' | 'dropoff' | 'both') => {
  const [addresses, setAddresses] = useState<UserSavedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchAddresses = async () => { /* ... */ };
  const createAddress = async (input: UserSavedAddressInput) => { /* ... */ };
  const updateAddress = async (id: number, input: Partial<UserSavedAddressInput>) => { /* ... */ };
  const deleteAddress = async (id: number) => { /* ... */ };
  const setDefaultAddress = async (id: number, addressType: 'pickup' | 'dropoff') => { /* ... */ };
  
  return {
    addresses,
    loading,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
};
```

#### Nouveau Composant : `SavedAddressSelector.tsx`

```typescript
interface SavedAddressSelectorProps {
  addressType: 'pickup' | 'dropoff';
  value?: LocationObject | string;
  onSelect: (address: UserSavedAddress | LocationObject) => void;
  allowNew?: boolean; // Permettre de créer une nouvelle adresse
  showQuickSave?: boolean; // Afficher option "Sauvegarder cette adresse"
}
```

**Fonctionnalités :**
- Liste des adresses sauvegardées avec label et adresse complète
- Bouton pour utiliser une adresse sauvegardée
- Option pour créer une nouvelle adresse (ouvre modal de création)
- Option "Sauvegarder cette adresse" après sélection GPS
- Badge "Défaut" pour les adresses par défaut
- Badge de fréquence d'utilisation

#### Intégration dans les Écrans Existants

1. **`DeliveryParcelFlowNew.tsx`**
   - Remplacer `ModernGPSModal` par `SavedAddressSelector` avec `allowNew={true}`
   - Afficher les suggestions d'adresses sauvegardées au chargement

2. **`DeliveryShoppingFlowNew.tsx`**
   - Même intégration que ci-dessus

3. **`OrderDeliveryModal.tsx`**
   - Intégrer `SavedAddressSelector` pour la sélection d'adresse de livraison

4. **`ModernGPSSelector.tsx`** (amélioré)
   - Ajouter un bouton "Sauvegarder cette adresse" après sélection
   - Proposer les adresses sauvegardées en premier dans l'autocomplete

### Phase 4 : Améliorations UX

#### Suggestions Intelligentes

1. **Auto-suggestion après livraison**
   - Après une livraison réussie, proposer : "Sauvegarder cette adresse ?"
   - Modal rapide pour ajouter un label (ex: "Domicile", "Bureau")

2. **Détection de Doublons**
   - Lors de la sauvegarde, vérifier si une adresse similaire existe (rayon de 50m)
   - Proposer de fusionner ou de mettre à jour l'existante

3. **Raccourcis Rapides**
   - Bouton "Mes adresses" dans la barre de recherche
   - Liste déroulante avec les 3 adresses les plus utilisées

4. **Gestion des Adresses**
   - Écran dédié "Mes Adresses" accessible depuis le profil
   - Permettre d'éditer, supprimer, définir par défaut

## 📊 Impact Attendu

### Pour les Utilisateurs
- ⏱️ **Gain de temps** : 60-70% de temps en moins pour saisir une adresse
- ✅ **Réduction d'erreurs** : Moins de fautes de frappe
- 🎯 **Meilleure expérience** : Fluidité comparable à Uber Eats / DoorDash

### Pour la Plateforme
- 📈 **Taux de conversion** : Réduction de l'abandon au moment de la saisie
- 🔄 **Fidélisation** : Les utilisateurs sont plus enclins à réutiliser le service
- 💾 **Données enrichies** : Meilleure connaissance des zones de livraison fréquentes

## 🚀 Plan de Déploiement

### Étape 1 : Migration Base de Données (1-2 jours)
- Créer la table `user_saved_addresses`
- Créer les index nécessaires
- Tester les contraintes et performances

### Étape 2 : Backend API (2-3 jours)
- Implémenter les modèles Rust
- Créer les endpoints API
- Ajouter la logique de suggestion automatique
- Tests unitaires et d'intégration

### Étape 3 : Frontend Mobile - Composants (3-4 jours)
- Créer le hook `useSavedAddresses`
- Créer le composant `SavedAddressSelector`
- Créer l'écran "Mes Adresses"
- Tests UI/UX

### Étape 4 : Intégration (2-3 jours)
- Intégrer dans `DeliveryParcelFlowNew`
- Intégrer dans `DeliveryShoppingFlowNew`
- Intégrer dans `OrderDeliveryModal`
- Tests end-to-end

### Étape 5 : Améliorations UX (2 jours)
- Auto-suggestion après livraison
- Détection de doublons
- Raccourcis rapides
- Tests utilisateurs

**Total estimé : 10-14 jours de développement**

## 🔍 Points d'Attention

1. **Privacy & GDPR**
   - Les adresses sont des données personnelles sensibles
   - Permettre la suppression complète des données utilisateur
   - Chiffrer les adresses si nécessaire

2. **Performance**
   - Limiter le nombre d'adresses sauvegardées par utilisateur (ex: max 20)
   - Indexer correctement pour des requêtes rapides
   - Mettre en cache les adresses fréquemment utilisées

3. **Migration des Données Existantes**
   - Optionnel : Extraire les adresses des livraisons passées
   - Proposer de sauvegarder automatiquement les adresses fréquemment utilisées

4. **Validation**
   - Valider les coordonnées GPS (latitude/longitude valides)
   - Valider le format des adresses
   - Vérifier que l'adresse existe (géocodage inverse)

## 📝 Notes Complémentaires

### Différence avec `merchant_storage_locations`
- **`merchant_storage_locations`** : Pour les marchands, lieux de stock fixes
- **`user_saved_addresses`** : Pour les clients, adresses de livraison/récupération réutilisables

Les deux systèmes peuvent coexister et complémenter.

### Intégration avec `LocationSelector`
Le composant `LocationSelector` existant peut être enrichi pour :
- Afficher les adresses sauvegardées en premier dans les suggestions
- Permettre de sauvegarder directement depuis le sélecteur
- Marquer visuellement les adresses sauvegardées dans les résultats



