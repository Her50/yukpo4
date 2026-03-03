# Guide de Migration UX - Services Spécialisés

## 📚 Composants Réutilisables Créés

### 1. `useFormAutoSave` Hook
**Fichier**: `mobile/src/hooks/useFormAutoSave.ts`

Sauvegarde automatique du formulaire dans AsyncStorage avec debounce.

```typescript
import { useFormAutoSave, loadSavedFormData, clearSavedFormData } from '../hooks/useFormAutoSave';

// Dans votre composant
const STORAGE_KEY = '@mon_service_form';

// Charger les données sauvegardées au montage
useEffect(() => {
    const loadSaved = async () => {
        const saved = await loadSavedFormData(STORAGE_KEY);
        if (saved) {
            setFormData(saved);
        }
    };
    loadSaved();
}, []);

// Sauvegarder automatiquement
useFormAutoSave(STORAGE_KEY, formData, true, 1000);

// Nettoyer après soumission réussie
await clearSavedFormData(STORAGE_KEY);
```

### 2. `usePartnerData` Hook
**Fichier**: `mobile/src/hooks/usePartnerData.ts`

Charge automatiquement les données du partenaire connecté.

```typescript
import { usePartnerData } from '../hooks/usePartnerData';

const { partnerData, loading, error } = usePartnerData(user?.role, 'pharmacie');

// Pré-remplir le formulaire
useEffect(() => {
    if (partnerData) {
        setFormData(prev => ({
            ...prev,
            nom: partnerData.name || prev.nom,
            adresse: partnerData.address || prev.adresse,
            telephone: partnerData.contact_phone || prev.telephone,
            email: partnerData.contact_email || prev.email,
        }));
    }
}, [partnerData]);
```

### 3. `FormConfirmationModal` Component
**Fichier**: `mobile/src/components/FormConfirmationModal.tsx`

Modal de confirmation avant soumission avec récapitulatif.

```typescript
import FormConfirmationModal, { ConfirmationSection } from '../components/FormConfirmationModal';

const [showConfirmation, setShowConfirmation] = useState(false);

const confirmationSections: ConfirmationSection[] = [
    {
        title: 'Informations générales',
        icon: 'info',
        fields: [
            { label: 'Nom', value: formData.nom, icon: 'building' },
            { label: 'Adresse', value: formData.adresse, icon: 'map-pin' },
        ],
    },
    {
        title: 'Contact',
        icon: 'phone',
        fields: [
            { label: 'Téléphone', value: formData.telephone },
            { label: 'Email', value: formData.email },
        ],
    },
];

<FormConfirmationModal
    visible={showConfirmation}
    title="Confirmer l'enregistrement"
    sections={confirmationSections}
    onConfirm={handleFinalSubmit}
    onCancel={() => setShowConfirmation(false)}
    loading={loading}
/>
```

### 4. `PartnerHeader` Component
**Fichier**: `mobile/src/components/PartnerHeader.tsx`

En-tête avec logo et nom du partenaire.

```typescript
import PartnerHeader from '../components/PartnerHeader';

<PartnerHeader
    partnerName={partnerData?.name}
    logoUrl={partnerData?.logo_url}
    subtitle="Espace prestataire"
/>
```

### 5. `useFormValidation` Hook (existant)
**Fichier**: `mobile/src/hooks/useFormValidation.ts`

Validation en temps réel des formulaires.

```typescript
import { useFormValidation } from '../hooks/useFormValidation';

const { errors, validateField, validateForm, setError } = useFormValidation({
    nom: { required: true, minLength: 3 },
    telephone: { 
        required: true, 
        pattern: /^\+?[0-9]{9,15}$/,
        custom: (value) => {
            if (!value.startsWith('+237')) {
                return 'Le numéro doit commencer par +237';
            }
            return null;
        }
    },
    email: { 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
});

// Validation inline
const handleFieldChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    const error = validateField(field, value);
    if (error) {
        setError(field, error);
    }
};

// Validation avant soumission
const handleSubmit = () => {
    if (!validateForm(formData)) {
        Alert.alert('Erreur', 'Veuillez corriger les erreurs du formulaire');
        return;
    }
    setShowConfirmation(true);
};
```

---

## 🔧 Pattern de Migration Standard

### Étape 1: Imports
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFormAutoSave, loadSavedFormData, clearSavedFormData } from '../hooks/useFormAutoSave';
import { usePartnerData } from '../hooks/usePartnerData';
import { useFormValidation } from '../hooks/useFormValidation';
import FormConfirmationModal, { ConfirmationSection } from '../components/FormConfirmationModal';
import PartnerHeader from '../components/PartnerHeader';
```

### Étape 2: Constantes
```typescript
const STORAGE_KEY = '@nom_service_form'; // Unique par écran
```

### Étape 3: Hooks
```typescript
const { user } = useAuth();
const { partnerData, loading: loadingPartner } = usePartnerData(user?.role, 'type_service');
const { errors, validateField, validateForm, setError } = useFormValidation({
    // Règles de validation
});

const [showConfirmation, setShowConfirmation] = useState(false);
```

### Étape 4: Chargement données sauvegardées
```typescript
useEffect(() => {
    const loadSaved = async () => {
        const saved = await loadSavedFormData<typeof formData>(STORAGE_KEY);
        if (saved) {
            setFormData(saved);
            Alert.alert(
                'Données restaurées',
                'Vos données non envoyées ont été restaurées',
                [{ text: 'OK' }]
            );
        }
    };
    loadSaved();
}, []);
```

### Étape 5: Pré-remplissage partenaire
```typescript
useEffect(() => {
    if (partnerData && user?.role === 'partenaire') {
        setFormData(prev => ({
            ...prev,
            nom: partnerData.name || prev.nom,
            adresse: partnerData.address || partnerData.location_address || prev.adresse,
            telephone: partnerData.contact_phone || prev.telephone,
            email: partnerData.contact_email || prev.email,
            quartier: partnerData.city ? {
                raw: partnerData.city,
                place_name: partnerData.city,
                components: {
                    ville: partnerData.city,
                    pays: partnerData.country,
                }
            } : prev.quartier,
        }));
    }
}, [partnerData, user?.role]);
```

### Étape 6: Sauvegarde automatique
```typescript
useFormAutoSave(STORAGE_KEY, formData, true, 1000);
```

### Étape 7: Masquer champs partenaires
```typescript
{user?.role !== 'partenaire' && (
    <View style={styles.inputGroup}>
        <NativeInput
            label="Nom *"
            value={formData.nom}
            onChangeText={(text) => handleFieldChange('nom', text)}
            error={errors.nom}
        />
    </View>
)}
```

### Étape 8: Validation inline
```typescript
const handleFieldChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    const error = validateField(field, value);
    if (error) {
        setError(field, error);
    }
};
```

### Étape 9: Soumission avec confirmation
```typescript
const handleSubmit = () => {
    if (!validateForm(formData)) {
        Alert.alert('Erreur', 'Veuillez corriger les erreurs du formulaire');
        return;
    }
    setShowConfirmation(true);
};

const handleFinalSubmit = async () => {
    setLoading(true);
    try {
        // Logique de soumission existante
        const response = await apiPost('/api/...', payload);
        
        if (response.success) {
            await clearSavedFormData(STORAGE_KEY); // Nettoyer
            Alert.alert('Succès', 'Service créé avec succès');
            navigation.goBack();
        }
    } catch (error) {
        Alert.alert('Erreur', error.message);
    } finally {
        setLoading(false);
        setShowConfirmation(false);
    }
};
```

### Étape 10: Sections de confirmation
```typescript
const confirmationSections: ConfirmationSection[] = [
    {
        title: 'Informations générales',
        icon: 'info',
        fields: [
            { label: 'Nom', value: formData.nom, icon: 'building' },
            { label: 'Type', value: formData.type },
            { label: 'Adresse', value: formData.adresse, icon: 'map-pin' },
        ],
    },
    {
        title: 'Contact',
        icon: 'phone',
        fields: [
            { label: 'Téléphone', value: formData.telephone },
            { label: 'Email', value: formData.email },
        ],
    },
    // Ajouter d'autres sections selon le service
];
```

### Étape 11: Affichage en-tête partenaire
```typescript
<View style={styles.form}>
    {user?.role === 'partenaire' && (
        <PartnerHeader
            partnerName={partnerData?.name}
            logoUrl={partnerData?.logo_url}
            subtitle="Espace prestataire"
        />
    )}
    
    {/* Reste du formulaire */}
</View>
```

### Étape 12: Modal de confirmation
```typescript
<FormConfirmationModal
    visible={showConfirmation}
    title="Confirmer l'enregistrement"
    sections={confirmationSections}
    onConfirm={handleFinalSubmit}
    onCancel={() => setShowConfirmation(false)}
    loading={loading}
/>
```

---

## 🎯 Checklist par Écran

### ✅ Avant Migration
- [ ] Lire le code existant
- [ ] Identifier les champs du formulaire
- [ ] Identifier les règles de validation nécessaires
- [ ] Identifier les sections pour la confirmation

### ✅ Pendant Migration
- [ ] Ajouter imports nécessaires
- [ ] Ajouter STORAGE_KEY unique
- [ ] Ajouter hooks (usePartnerData, useFormValidation)
- [ ] Charger données sauvegardées
- [ ] Pré-remplir depuis partnerData
- [ ] Activer sauvegarde auto
- [ ] Masquer champs partenaires
- [ ] Ajouter validation inline
- [ ] Créer sections de confirmation
- [ ] Modifier handleSubmit pour afficher confirmation
- [ ] Créer handleFinalSubmit
- [ ] Ajouter PartnerHeader
- [ ] Ajouter FormConfirmationModal

### ✅ Après Migration
- [ ] Tester le formulaire (création)
- [ ] Tester sauvegarde auto (quitter et revenir)
- [ ] Tester validation inline
- [ ] Tester modal de confirmation
- [ ] Tester en tant que partenaire
- [ ] Tester en tant qu'utilisateur normal
- [ ] Vérifier erreurs TypeScript

---

## 🔥 Corrections TypeScript Communes

### Erreur: Property 'X' does not exist on type 'unknown'

**Cause**: Réponse API non typée

**Solution**:
```typescript
// Avant
const response = await apiGet('/api/partners/me');
const partner = response.data; // Type unknown

// Après
interface PartnerResponse {
    name: string;
    address?: string;
    contact_phone?: string;
    // ...
}

const response = await apiGet<PartnerResponse>('/api/partners/me');
const partner = response.data; // Type PartnerResponse
```

### Erreur: Type 'string' is not assignable to type 'LocationObject'

**Cause**: Champ quartier peut être string ou LocationObject

**Solution**:
```typescript
// Type correct
quartier: null as LocationObject | string | null,

// Ou normaliser
const quartierValue: any = location.raw || location.place_name || location;
setFormData({ ...formData, quartier: quartierValue });
```

### Erreur: Property 'ville' does not exist on type

**Cause**: Champ ville manquant dans l'interface formData

**Solution**:
```typescript
const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    quartier: null as LocationObject | null,
    ville: '', // Ajouter
    pays: '', // Ajouter
    // ...
});
```

---

## 📊 Ordre de Migration Recommandé

### Priorité 1 (Écrans simples, forte utilisation)
1. **BanqueSangFormScreen** - Simple, peu de champs
2. **OffresEmploiFormScreen** - Structure claire
3. **TaxiFormScreen** - Déjà sauvegarde auto (à améliorer)

### Priorité 2 (Écrans moyens)
4. **HopitalFormScreen** - Prestations avec horaires
5. **LaboratoireFormScreen** - Examens + horaires
6. **CovoiturageFormScreen** - Déjà sauvegarde auto

### Priorité 3 (Écrans complexes)
7. **PharmacieFormScreen** - Gestion produits
8. **AgenceVoyageFormScreen** - Multiples modals
9. **ImmobilierFormScreen** - MediaUploader

### Priorité 4 (Écrans spéciaux)
10. **LivreScolaireFormScreen** - IA analyse image
11. **BusReturnRequestFormScreen** - Lié à ticket existant

---

## 🚀 Exemple Complet: BanqueSangFormScreen

Voir fichier séparé: `EXEMPLE_MIGRATION_BANQUE_SANG.md`

---

## 💡 Conseils

1. **Tester au fur et à mesure**: Ne pas tout migrer d'un coup
2. **Garder l'ancien code commenté**: Pour rollback si nécessaire
3. **Vérifier les types**: Utiliser TypeScript strictement
4. **Tester les deux rôles**: Partenaire ET utilisateur normal
5. **Documenter les changements**: Ajouter commentaires explicatifs

---

## 🐛 Debugging

### La sauvegarde auto ne fonctionne pas
- Vérifier que STORAGE_KEY est unique
- Vérifier que formData change bien
- Vérifier les logs console

### Les données partenaire ne se chargent pas
- Vérifier que user.role === 'partenaire'
- Vérifier l'endpoint `/api/partners/me`
- Vérifier partnerData dans les logs

### La validation ne fonctionne pas
- Vérifier les règles de validation
- Vérifier que validateField est appelé
- Vérifier errors dans les logs

### Le modal de confirmation ne s'affiche pas
- Vérifier showConfirmation state
- Vérifier que confirmationSections est bien formé
- Vérifier les imports

---

## 📞 Support

Pour toute question sur la migration, consulter:
- `ANALYSE_ECRANS_PRESTATAIRES_SERVICES_SPECIALISES.md` - Analyse complète
- Code source des composants réutilisables
- Exemple complet BanqueSangFormScreen (à créer)
