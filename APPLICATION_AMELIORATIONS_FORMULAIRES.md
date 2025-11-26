# 📋 Application des améliorations aux formulaires de services spécialisés

## ✅ Statut des améliorations

### Formulaires de santé

1. ✅ **HopitalFormScreen** - **COMPLET**
   - ModernGPSModal intégré
   - WeekScheduleSelector intégré
   - ServicePrestationsPlanner intégré
   - Liste complète des prestations (27 prestations)
   - Création automatique du service
   - Bouton corrigé (title au lieu de children)

2. ✅ **PharmacieFormScreen** - **COMPLET**
   - ModernGPSModal intégré
   - WeekScheduleSelector intégré
   - Création automatique du service
   - Bouton corrigé (title au lieu de children)

3. ⏳ **LaboratoireFormScreen** - **À FAIRE**
   - ModernGPSModal à intégrer
   - WeekScheduleSelector à intégrer (si applicable)
   - Création automatique du service
   - Bouton à corriger

4. ⏳ **BanqueSangFormScreen** - **À FAIRE**
   - ModernGPSModal à intégrer
   - WeekScheduleSelector à intégrer (si applicable)
   - Création automatique du service
   - Bouton à corriger

### Formulaires de transport

5. ⏳ **AgenceVoyageFormScreen** - **À FAIRE**
   - ModernGPSModal à intégrer
   - WeekScheduleSelector à intégrer (planning des trajets)
   - Création automatique du service
   - Bouton à corriger

6. ⏳ **TaxiFormScreen** - **À FAIRE**
   - ModernGPSModal à intégrer
   - WeekScheduleSelector à intégrer (si applicable)
   - Création automatique du service
   - Bouton à corriger

7. ⏳ **CovoiturageFormScreen** - **À FAIRE**
   - ModernGPSModal à intégrer
   - WeekScheduleSelector à intégrer (si applicable)
   - Création automatique du service
   - Bouton à corriger

---

## 🔧 Pattern d'amélioration à suivre

### 1. Imports à ajouter

```typescript
import { useEffect } from 'react';
import ModernGPSModal from '../../components/ModernGPSModal';
import WeekScheduleSelector from '../../components/WeekScheduleSelector';
import { servicesApi } from '../../services/api';

interface ScheduleDay {
    day: number;
    enabled: boolean;
    timeSlots: Array<{ start: string; end: string }>;
}
```

### 2. États à ajouter

```typescript
const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
const [showGPSModal, setShowGPSModal] = useState(false);
const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
const [showScheduleModal, setShowScheduleModal] = useState(false);
const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
```

### 3. Création automatique du service

```typescript
useEffect(() => {
    const createServiceIfNeeded = async () => {
        if (!serviceId && user?.id && formData.nom) {
            try {
                const serviceData = {
                    titre_service: formData.nom || 'Nom du service',
                    description: 'Description du service',
                    category: 'sante' | 'transport',
                };

                const response = await servicesApi.createService(serviceData);
                if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                    setServiceId((response.data as any).id);
                }
            } catch (error: any) {
                console.error('[FormScreen] Erreur création service:', error);
            }
        }
    };

    if (!serviceId && formData.nom) {
        createServiceIfNeeded();
    }
}, [formData.nom, serviceId, user?.id]);
```

### 4. Handlers à ajouter

```typescript
const handleGPSSelect = (coordinates: string) => {
    setSelectedGPS(coordinates);
    setShowGPSModal(false);
};

const handleScheduleSave = (savedSchedule: ScheduleDay[]) => {
    setSchedule(savedSchedule);
    setShowScheduleModal(false);
};
```

### 5. Modifier handleSubmit

```typescript
const handleSubmit = async () => {
    // Créer le service si nécessaire
    let finalServiceId = serviceId;
    if (!finalServiceId && user?.id) {
        try {
            setLoading(true);
            const serviceData = {
                titre_service: formData.nom || 'Nom du service',
                description: 'Description',
                category: 'sante' | 'transport',
            };

            const response = await servicesApi.createService(serviceData);
            if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                finalServiceId = (response.data as any).id;
                setServiceId(finalServiceId);
            } else {
                Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                setLoading(false);
                return;
            }
        } catch (error: any) {
            console.error('[FormScreen] Erreur création service:', error);
            Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
            setLoading(false);
            return;
        }
    }

    if (!finalServiceId) {
        Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
        setLoading(false);
        return;
    }

    // ... reste du code

    // Dans le payload, utiliser selectedGPS au lieu de location
    const payload = {
        service_id: finalServiceId,
        // ...
        gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
        planning_hebdomadaire: schedule.length > 0 ? schedule.map(day => ({
            day: day.day,
            enabled: day.enabled,
            timeSlots: day.timeSlots
        })) : null,
        // ...
    };
};
```

### 6. Ajouter le bouton GPS dans le JSX

```typescript
<View style={styles.inputGroup}>
    <Text style={styles.label}>Localisation GPS</Text>
    <TouchableOpacity
        style={styles.gpsButton}
        onPress={() => setShowGPSModal(true)}
    >
        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
        <Text style={styles.gpsButtonText}>
            {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
        </Text>
        <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
    {selectedGPS && (
        <Text style={styles.gpsText}>{selectedGPS}</Text>
    )}
</View>
```

### 7. Ajouter le bouton de planning (si applicable)

```typescript
<View style={styles.inputGroup}>
    <View style={styles.sectionHeader}>
        <Text style={styles.label}>Planning hebdomadaire</Text>
        <TouchableOpacity
            style={styles.planningButton}
            onPress={() => setShowScheduleModal(true)}
        >
            <SafeIcon name="calendar" size={16} color={modernColors.primary} />
            <Text style={styles.planningButtonText}>
                {schedule.length > 0 ? 'Modifier' : 'Configurer'}
            </Text>
        </TouchableOpacity>
    </View>
    {schedule.length > 0 && (
        <Text style={styles.scheduleSummary}>
            {schedule.filter(d => d.enabled).length} jour(s) configuré(s)
        </Text>
    )}
</View>
```

### 8. Corriger le bouton de sauvegarde

```typescript
// ❌ AVANT
<NativeButton
    onPress={handleSubmit}
    disabled={loading || !formData.nom.trim()}
    variant="primary"
    style={styles.submitButton}
>
    <Text style={styles.submitButtonText}>
        {loading ? 'Enregistrement...' : 'Enregistrer'}
    </Text>
</NativeButton>

// ✅ APRÈS
<NativeButton
    title={loading ? 'Enregistrement...' : 'Enregistrer'}
    onPress={handleSubmit}
    disabled={loading || !formData.nom.trim()}
    variant="primary"
    size="large"
    style={styles.submitButton}
/>
```

### 9. Ajouter les modals à la fin du JSX

```typescript
return (
    <>
        <ScrollView style={styles.container}>
            {/* ... contenu ... */}
        </ScrollView>

        <ModernGPSModal
            visible={showGPSModal}
            onClose={() => setShowGPSModal(false)}
            onSelect={handleGPSSelect}
            currentLocation={location ? {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            } : null}
            title="Sélectionner la localisation"
        />

        <WeekScheduleSelector
            visible={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSave={handleScheduleSave}
            initialSchedule={schedule}
            title="Planning hebdomadaire"
        />
    </>
);
```

### 10. Ajouter les styles

```typescript
sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
},
gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    gap: 12,
},
gpsButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
},
gpsText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
},
planningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${modernColors.primary}15`,
    borderRadius: 8,
},
planningButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
},
scheduleSummary: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
},
```

---

## 📝 Notes spécifiques par formulaire

### LaboratoireFormScreen
- Ajouter WeekScheduleSelector pour les horaires d'ouverture
- Pas besoin de ServicePrestationsPlanner (pas de prestations individuelles)

### BanqueSangFormScreen
- Ajouter WeekScheduleSelector pour les horaires d'ouverture
- Le formulaire est plus complexe (gestion des stocks), mais les mêmes améliorations s'appliquent

### AgenceVoyageFormScreen
- WeekScheduleSelector est très important (planning des trajets)
- Peut-être ajouter un composant spécifique pour les trajets (départ/arrivée)

### TaxiFormScreen
- WeekScheduleSelector pour les horaires de disponibilité
- ModernGPSModal pour la zone de couverture

### CovoiturageFormScreen
- WeekScheduleSelector pour les horaires de trajets
- ModernGPSModal pour les points de départ/arrivée

---

## ✅ Checklist d'application

Pour chaque formulaire, vérifier :

- [ ] Imports ModernGPSModal et WeekScheduleSelector ajoutés
- [ ] États showGPSModal, selectedGPS, showScheduleModal, schedule ajoutés
- [ ] useEffect pour création automatique du service ajouté
- [ ] handleGPSSelect et handleScheduleSave ajoutés
- [ ] handleSubmit modifié pour créer le service si nécessaire
- [ ] Bouton GPS ajouté dans le JSX
- [ ] Bouton planning ajouté (si applicable)
- [ ] Bouton de sauvegarde corrigé (title au lieu de children)
- [ ] Modals ajoutés à la fin du JSX
- [ ] Styles ajoutés (gpsButton, planningButton, etc.)
- [ ] Testé : création automatique du service
- [ ] Testé : sélection GPS
- [ ] Testé : planning hebdomadaire
- [ ] Testé : bouton de sauvegarde visible

---

## 🎯 Prochaines étapes

1. Appliquer les améliorations à LaboratoireFormScreen
2. Appliquer les améliorations à BanqueSangFormScreen
3. Appliquer les améliorations à AgenceVoyageFormScreen
4. Appliquer les améliorations à TaxiFormScreen
5. Appliquer les améliorations à CovoiturageFormScreen
6. Tester tous les formulaires
7. Documenter les changements

