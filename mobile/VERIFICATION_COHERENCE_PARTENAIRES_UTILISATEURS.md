# 🔍 Vérification Cohérence Écrans Partenaires ↔ Utilisateurs

## 📋 Objectif

Vérifier que les données créées par les partenaires dans les écrans `*FormScreen` correspondent exactement aux données affichées/recherchées dans les écrans utilisateurs `*HomeScreen` / `*ListScreen` / `*DetailsScreen`.

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### 1. 🏠 IMMOBILIER - Incohérence des valeurs de statut

#### ❌ Problème
- **FormScreen** envoie : `statut: 'vente' | 'location' | 'les_deux'`
- **HomeScreen** filtre avec : `statut: 'À vendre' | 'À louer (bail)' | 'À louer meublé' | 'Location courte durée' | 'Colocation'`

#### 🔧 Solution
- Aligner les valeurs : soit utiliser les valeurs du FormScreen dans HomeScreen, soit mapper les valeurs
- **Recommandation** : Utiliser les valeurs backend (`'vente'`, `'location'`, `'les_deux'`) partout et mapper pour l'affichage

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/ImmobilierFormScreen.tsx` (ligne 56)
- `mobile/src/screens/specialized/ImmobilierHomeScreen.tsx` (ligne 58)

---

### 2. 🏠 IMMOBILIER - Incohérence des valeurs de type_bien

#### ❌ Problème
- **FormScreen** envoie : `type_bien: 'maison' | 'appartement' | 'terrain' | 'bureau' | 'local_commercial'`
- **HomeScreen** filtre avec : `type_bien: 'Appartement' | 'Villa' | 'Studio' | 'Duplex' | 'Triplex' | 'Maison' | 'Bureau' | 'Commerce'`

#### 🔧 Solution
- Aligner les valeurs : utiliser les mêmes valeurs dans FormScreen et HomeScreen
- **Recommandation** : Utiliser les valeurs backend (`'maison'`, `'appartement'`, etc.) et mapper pour l'affichage

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/ImmobilierFormScreen.tsx` (ligne 55)
- `mobile/src/screens/specialized/ImmobilierHomeScreen.tsx` (ligne 57)

---

### 3. 🚗 COVOITURAGE - Incohérence de devise

#### ❌ Problème
- **FormScreen** envoie : `devise: 'XAF'` (ligne 44)
- **HomeScreen** utilise : `devise: 'FCFA'` (ligne 57)
- **Service** attend : `devise?: string` (peut être undefined)

#### 🔧 Solution
- Standardiser sur une seule valeur : `'FCFA'` ou `'XAF'` (sont équivalents mais doivent être cohérents)
- **Recommandation** : Utiliser `'FCFA'` partout (plus standard au Cameroun)

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/CovoiturageFormScreen.tsx` (ligne 44)
- `mobile/src/screens/specialized/CovoiturageHomeScreen.tsx` (ligne 57)
- `mobile/src/services/covoiturageService.ts` (ligne 56)

---

### 4. 🏥 PHARMACIE - Vérification produits

#### ✅ À vérifier
- **FormScreen** crée des produits avec : `nom_produit`, `prix`, `stock`, `unite`, `categorie`
- **HomeScreen** recherche des produits avec : `PharmacyProduct` interface
- **Vérifier** : Les champs correspondent-ils exactement?

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/PharmacieFormScreen.tsx` (lignes 26-37, 77-85)
- `mobile/src/screens/specialized/PharmacieHomeScreen.tsx` (ligne 35)
- `mobile/src/services/pharmacyProductService.ts`

---

### 5. 🏥 HOPITAL - Vérification services médicaux

#### ✅ À vérifier
- **FormScreen** crée des services avec quels champs?
- **HomeScreen** recherche des services avec : `MedicalService` interface
- **Vérifier** : Les champs correspondent-ils exactement?

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/HopitalFormScreen.tsx`
- `mobile/src/screens/specialized/HopitalHomeScreen.tsx` (ligne 35)
- `mobile/src/services/hospitalService.ts`

---

### 6. 🚌 TICKET VOYAGE - Vérification

#### ✅ À vérifier
- **FormScreen** crée des tickets avec quels champs?
- **HomeScreen** recherche des tickets avec quels champs?
- **Vérifier** : Les champs correspondent-ils exactement?

#### 📝 Fichiers concernés
- `mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx`
- `mobile/src/screens/specialized/TicketVoyageHomeScreen.tsx`
- `mobile/src/services/busTicketService.ts`

---

## ✅ VÉRIFICATIONS À FAIRE

### Pour chaque service spécialisé :

1. **Champs créés dans FormScreen** = **Champs recherchés dans HomeScreen** ?
2. **Types de données** cohérents (string vs number vs boolean) ?
3. **Valeurs enum** identiques (statut, type, etc.) ?
4. **Endpoints backend** utilisent les mêmes structures ?
5. **Mapping affichage** correct (backend → UI) ?

---

## 🔧 ACTIONS CORRECTIVES PRIORITAIRES

### Priorité 1 (Bloquant)
1. ✅ **Immobilier statut** : Aligner les valeurs entre FormScreen et HomeScreen
2. ✅ **Immobilier type_bien** : Aligner les valeurs entre FormScreen et HomeScreen
3. ✅ **Covoiturage devise** : Standardiser sur `'FCFA'` partout

### Priorité 2 (Important)
4. ⚠️ **Pharmacie produits** : Vérifier correspondance champs
5. ⚠️ **Hopital services** : Vérifier correspondance champs
6. ⚠️ **Ticket voyage** : Vérifier correspondance champs

### Priorité 3 (Amélioration)
7. 📝 Créer des constantes partagées pour les valeurs enum
8. 📝 Créer des types TypeScript partagés entre FormScreen et HomeScreen
9. 📝 Ajouter des validations côté FormScreen pour garantir la cohérence

---

## 📝 RECOMMANDATIONS

### 1. Créer des constantes partagées

```typescript
// mobile/src/constants/immobilierConstants.ts
export const IMMOBILIER_STATUTS = {
    VENTE: 'vente',
    LOCATION: 'location',
    LES_DEUX: 'les_deux',
} as const;

export const IMMOBILIER_STATUTS_DISPLAY = {
    [IMMOBILIER_STATUTS.VENTE]: 'À vendre',
    [IMMOBILIER_STATUTS.LOCATION]: 'À louer (bail)',
    [IMMOBILIER_STATUTS.LES_DEUX]: 'Vente et location',
} as const;

export const IMMOBILIER_TYPES = {
    MAISON: 'maison',
    APPARTEMENT: 'appartement',
    TERRAIN: 'terrain',
    BUREAU: 'bureau',
    LOCAL_COMMERCIAL: 'local_commercial',
} as const;
```

### 2. Utiliser les mêmes types TypeScript

```typescript
// mobile/src/types/immobilierTypes.ts
export interface ImmobilierFormData {
    titre: string;
    type_bien: keyof typeof IMMOBILIER_TYPES;
    statut: keyof typeof IMMOBILIER_STATUTS;
    // ...
}
```

### 3. Créer des fonctions de mapping

```typescript
// mobile/src/utils/immobilierUtils.ts
export const mapStatutToDisplay = (statut: string): string => {
    return IMMOBILIER_STATUTS_DISPLAY[statut] || statut;
};

export const mapDisplayToStatut = (display: string): string => {
    // Reverse mapping
};
```

---

## 📅 Dernière mise à jour

2025-01-XX - Création du document de vérification

