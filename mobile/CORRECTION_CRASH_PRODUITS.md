# 🛠️ CORRECTION: Crash du bloc produits (BusSeatSelector)

## ❌ Problème identifié

**Erreur**: "Cannot read property 'filter' of undefined" dans BusSeatSelector

**Localisation**: FormulaireYukpoIntelligentScreen → Bloc produits → Modal de sélection de places

**Impact**: Impossible d'accéder au bloc produit dans le formulaire de création de service

**Cause racine**: 
1. Le composant `BusSeatSelector` reçoit `seatMap` et `busConfiguration` `undefined`
2. Les appels à `.filter()` sur `seatMap` crashent car la prop n'est pas définie
3. ProductManagerMobile n'envoyait pas les props requises à BusSeatSelector

## ✅ Corrections appliquées

### 1. BusSeatSelector.tsx (lignes 208-210 et 290-292)

#### Correction 1: Vérification de seatMap pour les statistiques

**Avant**:
```typescript
const availableSeats = seatMap.filter(s => s.status === 'available').length;
const reservedSeats = seatMap.filter(s => s.status === 'reserved' || s.status === 'occupied').length;
```

**Après**:
```typescript
// ✅ CORRECTION: Vérifier que seatMap existe avant de filtrer
const availableSeats = (seatMap || []).filter(s => s.status === 'available').length;
const reservedSeats = (seatMap || []).filter(s => s.status === 'reserved' || s.status === 'occupied').length;
```

**Raison**: Si `seatMap` est `undefined`, on utilise un tableau vide au lieu de crasher.

---

#### Correction 2: Vérification dans le rendu de la grille

**Avant**:
```typescript
{Array.from({ length: busConfiguration.rows }).map((_, rowIndex) => {
    const seatsInThisRow = seatMap.filter(s => s.row === rowIndex + 1);
```

**Après**:
```typescript
{Array.from({ length: busConfiguration?.rows || 0 }).map((_, rowIndex) => {
    const seatsInThisRow = (seatMap || []).filter(s => s.row === rowIndex + 1);
```

**Raison**: Sécuriser l'accès à `busConfiguration` et `seatMap` avec des valeurs par défaut.

---

### 2. ProductManagerMobile.tsx (lignes 9560-9596)

#### Correction: Passer les props correctes au BusSeatSelector

**Avant**:
```typescript
<BusSeatSelector
    visible={showSeatSelector}
    onClose={() => setShowSeatSelector(false)}
    onSelectSeat={(seatLabel) => {
        setNewProduct({ ...newProduct, numeroPlace: seatLabel });
    }}
    busType="standard"  // ❌ Prop inexistante
/>
```

**Après**:
```typescript
{showSeatSelector && (
    <BusSeatSelector
        visible={showSeatSelector}
        onClose={() => setShowSeatSelector(false)}
        onSelectSeat={(seat) => {
            // Gérer le siège sélectionné (peut être un seul ou un tableau)
            const seatNumber = Array.isArray(seat) ? seat.map(s => s.number).join(', ') : seat.number;
            setNewProduct({ ...newProduct, numeroPlace: String(seatNumber) });
            setShowSeatSelector(false);
        }}
        busConfiguration={{
            rows: 10,
            seatsPerRow: 4,
            aislePosition: 2
        }}
        seatMap={
            // Génération d'un plan de bus standard (40 places)
            Array.from({ length: 40 }, (_, i) => ({
                id: `seat-${i + 1}`,
                number: i + 1,
                row: Math.floor(i / 4) + 1,
                col: (i % 4) + 1,
                status: 'available' as const,
                type: i === 0 ? 'driver' as const : 'standard' as const
            }))
        }
        product={{
            ...newProduct,
            depart: newProduct.depart || 'Départ',
            destination: newProduct.destination || 'Destination',
            dateDepart: newProduct.dateDepart || new Date().toLocaleDateString('fr-FR'),
            heureDepart: newProduct.heureDepart || '00:00',
            prix: newProduct.prix || '0'
        }}
        multipleMode={false}
    />
)}
```

**Changements clés**:
1. ✅ Ajout de `busConfiguration` avec une configuration standard (10 rangées, 4 sièges/rangée)
2. ✅ Génération d'un `seatMap` avec 40 places disponibles
3. ✅ Passage d'un objet `product` complet avec valeurs par défaut
4. ✅ Condition `{showSeatSelector && ...}` pour éviter le rendu inutile
5. ✅ Gestion correcte du callback `onSelectSeat` (supporte siège unique ou multiple)
6. ✅ Fermeture automatique de la modal après sélection

---

## 📝 Props requises par BusSeatSelector

Le composant BusSeatSelector attend ces props **obligatoires**:

```typescript
interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    busConfiguration: {
        rows: number;           // Nombre de rangées
        seatsPerRow: number;    // Sièges par rangée
        aislePosition: number;  // Position de l'allée
    };
    seatMap: Seat[];           // Plan des sièges
    onSelectSeat: (seat: Seat | Seat[], returnTripData?: {...}) => void;
    product: {                 // Informations du voyage
        depart: string;
        destination: string;
        dateDepart: string;
        heureDepart: string;
        prix: string | number;
    };
    multipleMode?: boolean;    // Optionnel: sélection multiple
    selectedSeatNumber?: number; // Optionnel: siège présélectionné
    currentUserId?: string;    // Optionnel: ID utilisateur
}
```

---

## 🎯 Configuration de bus par défaut créée

**Configuration standard** (bus de 40 places):
- 10 rangées
- 4 sièges par rangée
- Allée au milieu (position 2)
- Place 1 = Chauffeur
- Places 2-40 = Disponibles

Cette configuration permet d'utiliser le sélecteur même si les données du produit ne sont pas encore complètes.

---

## ✅ Résultat attendu

- ✅ Le bloc produits ne crash plus
- ✅ Le modal de sélection de place s'affiche correctement
- ✅ Les utilisateurs peuvent sélectionner des places pour les tickets de voyage
- ✅ Le formulaire de création de service fonctionne complètement
- ✅ Gestion robuste des props manquantes ou undefined

---

## 🧪 Test

Pour tester la correction:
1. Lancer l'application mobile
2. Naviguer vers FormulaireYukpoIntelligentScreen
3. Accéder au bloc "Produits"
4. Créer un produit de type "Ticket de voyage"
5. Cliquer sur "Sélectionner une place"
6. Vérifier que le modal de sélection s'affiche sans crash
7. Sélectionner une place et vérifier qu'elle est bien enregistrée

---

**Date de correction**: 25 octobre 2025
**Fichiers modifiés**: 
- `mobile/src/components/BusSeatSelector.tsx`
- `mobile/src/components/ProductManagerMobile.tsx`

---

## 🔗 Lien avec la correction précédente

Cette correction fait suite à la correction du crash de la page Boutique (CORRECTION_BOUTIQUE_CRASH.md). Les deux problèmes partageaient une cause commune : **affichage ou utilisation de données sans vérification de leur existence**.

**Pattern de correction appliqué** :
- Toujours vérifier qu'une prop/variable existe avant de l'utiliser
- Utiliser des valeurs par défaut (`|| []`, `|| {}`, `?.`, etc.)
- Fournir des données complètes aux composants enfants

