# 🔄 Remplacement des Inputs de Lieu par LocationSelector

## ✅ Objectif
Remplacer tous les `NativeInput` pour ville/quartier par le composant professionnel `LocationSelector` dans tous les écrans de recherche et configuration des services spécialisés.

## 📋 Écrans à Modifier

### Écrans de Recherche (10 écrans)
- [x] ✅ PharmacieSearchScreen.tsx
- [ ] ⏳ BanqueSangSearchScreen.tsx
- [ ] ⏳ HopitalSearchScreen.tsx
- [ ] ⏳ LaboratoireSearchScreen.tsx
- [ ] ⏳ TaxiSearchScreen.tsx
- [ ] ⏳ CovoiturageSearchScreen.tsx
- [ ] ⏳ BusTicketSearchScreen.tsx
- [ ] ⏳ AgenceVoyageSearchScreen.tsx
- [ ] ⏳ ImmobilierSearchScreen.tsx
- [ ] ⏳ LivreScolaireSearchScreen.tsx
- [ ] ⏳ EtablissementSearchScreen.tsx
- [ ] ⏳ BayamSelamSearchScreen.tsx
- [ ] ⏳ AutoServicesSearchScreen.tsx
- [ ] ⏳ InsuranceServicesSearchScreen.tsx

### Écrans de Configuration (9 écrans)
- [ ] ⏳ PharmacieFormScreen.tsx
- [ ] ⏳ HopitalFormScreen.tsx
- [ ] ⏳ LaboratoireFormScreen.tsx
- [ ] ⏳ BanqueSangFormScreen.tsx
- [ ] ⏳ TaxiFormScreen.tsx
- [ ] ⏳ CovoiturageFormScreen.tsx
- [ ] ⏳ AgenceVoyageFormScreen.tsx
- [ ] ⏳ LivreScolaireFormScreen.tsx

## 🔧 Modifications Requises

### 1. Import
```typescript
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
```

### 2. État
```typescript
// Avant
const [ville, setVille] = useState('');
const [quartier, setQuartier] = useState('');

// Après
const [ville, setVille] = useState<LocationObject | string>('');
const [quartier, setQuartier] = useState<LocationObject | string>('');
```

### 3. Extraction des valeurs dans handleSearch
```typescript
// Avant
if (ville.trim()) filters.ville = ville.trim();
if (quartier.trim()) filters.quartier = quartier.trim();

// Après
const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
if (villeStr.trim()) filters.ville = villeStr.trim();
if (quartierStr.trim()) filters.quartier = quartierStr.trim();
```

### 4. Remplacement du composant
```typescript
// Avant
<NativeInput
    value={ville}
    onChangeText={setVille}
    placeholder="Ex: Douala, Yaoundé"
/>

// Après
<LocationSelector
    label="Ville"
    value={ville}
    onSelect={(location) => setVille(location)}
    placeholder="Rechercher une ville..."
    scope="city"
    enrichWithBackend={true}
/>
```

```typescript
// Avant
<NativeInput
    value={quartier}
    onChangeText={setQuartier}
    placeholder="Ex: Bonanjo, Akwa"
/>

// Après
<LocationSelector
    label="Quartier (optionnel)"
    value={quartier}
    onSelect={(location) => setQuartier(location)}
    placeholder="Rechercher un quartier..."
    scope="neighborhood"
    cityContext={typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || ''}
    enrichWithBackend={true}
/>
```






