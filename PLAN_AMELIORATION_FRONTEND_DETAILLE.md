# 📋 Plan Détaillé - Amélioration Frontend Services Spécialisés

**Date**: 2025-01-27  
**Statut**: Services API ✅ | Écrans ⏳ En cours

---

## ✅ **SERVICES API FRONTEND CRÉÉS**

### **1. `hospitalService.ts`** ✅
- ✅ `getAIRecommendations()` - Recommandations IA
- ✅ `analyzeEmergencySeverity()` - Triage urgence
- ✅ `getWaitTimes()` - Temps d'attente
- ✅ `getEmergencyStatus()` - Statut urgences
- ✅ `getMyConsultations()` - Consultations client
- ✅ `getAnalytics()` - Analytics prestataire
- ✅ `manageSlots()` - Gestion créneaux

### **2. `pharmacyService.ts`** ✅
- ✅ `checkAvailability()` - Vérification disponibilité
- ✅ `reserveMedication()` - Réservation médicament
- ✅ `createOrder()` - Création commande
- ✅ `checkInteractions()` - Interactions IA
- ✅ `suggestDosage()` - Posologie IA
- ✅ `getMyOrders()` - Commandes client
- ✅ `getAnalytics()` - Analytics prestataire

### **3. `labService.ts`** ✅
- ✅ `getExaminationTypes()` - Types d'examens
- ✅ `bookExamination()` - Réservation examen
- ✅ `getExaminationResults()` - Résultats
- ✅ `analyzeExaminationResults()` - Analyse IA
- ✅ `getMyExaminations()` - Examens client
- ✅ `getAnalytics()` - Analytics prestataire

---

## 🎨 **AMÉLIORATIONS ÉCRANS EXISTANTS**

### **1. HopitalDetailsScreen.tsx**

#### **À ajouter** :
```typescript
// Nouveaux états
const [waitTimes, setWaitTimes] = useState<WaitTime[] | null>(null);
const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus | null>(null);
const [loadingWaitTimes, setLoadingWaitTimes] = useState(false);
const [loadingEmergency, setLoadingEmergency] = useState(false);

// Nouveaux effets
useEffect(() => {
  if (hopital?.urgences_disponible) {
    loadEmergencyStatus();
    loadWaitTimes();
  }
}, [hopital]);

// Nouvelles fonctions
const loadWaitTimes = async () => {
  setLoadingWaitTimes(true);
  const response = await hospitalService.getWaitTimes(params.hospitalId);
  if (response.success && response.data) {
    setWaitTimes(response.data.wait_times);
  }
  setLoadingWaitTimes(false);
};

const loadEmergencyStatus = async () => {
  setLoadingEmergency(true);
  const response = await hospitalService.getEmergencyStatus(params.hospitalId);
  if (response.success && response.data) {
    setEmergencyStatus(response.data);
  }
  setLoadingEmergency(false);
};

const handleAIRecommendations = () => {
  // Navigation vers modal/screen recommandations IA
  navigation.navigate('HospitalAIRecommendations' as never, {
    hospitalId: params.hospitalId,
  });
};
```

#### **Nouvelles sections à ajouter dans le ScrollView** :

1. **Section Temps d'attente** (si urgences disponibles) :
```tsx
{hopital.urgences_disponible && waitTimes && waitTimes.length > 0 && (
  <NativeCard style={styles.card}>
    <Text style={styles.sectionTitle}>⏱️ Temps d'attente estimés</Text>
    {waitTimes.map((wt, idx) => (
      <View key={idx} style={styles.waitTimeRow}>
        <Text style={styles.waitTimeSpecialty}>{wt.specialty}</Text>
        <Text style={styles.waitTimeValue}>
          {wt.avg_wait_time_minutes ? `${wt.avg_wait_time_minutes} min` : 'N/A'}
        </Text>
      </View>
    ))}
  </NativeCard>
)}
```

2. **Section Statut Urgences** :
```tsx
{hopital.urgences_disponible && emergencyStatus && (
  <NativeCard style={styles.card}>
    <View style={styles.emergencyStatusHeader}>
      <SafeIcon name="alert-circle" size={24} color={emergencyStatus.status === 'saturated' ? '#DC2626' : '#F59E0B'} />
      <Text style={styles.emergencyStatusTitle}>
        Statut Urgences: {emergencyStatus.status === 'available' ? 'Disponible' : 
                          emergencyStatus.status === 'busy' ? 'Occupé' : 'Saturé'}
      </Text>
    </View>
    <View style={styles.emergencyStatsRow}>
      <View style={styles.emergencyStat}>
        <Text style={styles.emergencyStatLabel}>Patients critiques</Text>
        <Text style={styles.emergencyStatValue}>{emergencyStatus.critical_count}</Text>
      </View>
      <View style={styles.emergencyStat}>
        <Text style={styles.emergencyStatLabel}>Temps moyen</Text>
        <Text style={styles.emergencyStatValue}>
          {emergencyStatus.avg_wait_time_minutes 
            ? `${Math.round(emergencyStatus.avg_wait_time_minutes)} min`
            : 'N/A'}
        </Text>
      </View>
    </View>
  </NativeCard>
)}
```

3. **Bouton Recommandations IA** :
```tsx
{hopital.urgences_disponible && (
  <NativeButton
    title="🤖 Obtenir recommandations IA"
    onPress={handleAIRecommendations}
    icon="sparkles"
    variant="outline"
    style={styles.aiButton}
  />
)}
```

---

### **2. PharmacieDetailsScreen.tsx**

#### **À ajouter** :
```typescript
// Nouveaux états
const [searchMedication, setSearchMedication] = useState('');
const [medicationAvailability, setMedicationAvailability] = useState<MedicationAvailability | null>(null);
const [checkingAvailability, setCheckingAvailability] = useState(false);

// Nouvelle fonction
const handleCheckAvailability = async () => {
  if (!searchMedication.trim()) {
    Alert.alert('Erreur', 'Veuillez entrer le nom d\'un médicament');
    return;
  }
  
  setCheckingAvailability(true);
  const response = await pharmacyService.checkAvailability(
    params.pharmacieId,
    searchMedication
  );
  
  if (response.success && response.data) {
    setMedicationAvailability(response.data);
  }
  setCheckingAvailability(false);
};

const handleReserveMedication = () => {
  navigation.navigate('PharmacyReserveMedication' as never, {
    pharmacyId: params.pharmacieId,
    medication: medicationAvailability?.medication,
  });
};

const handleCreateOrder = () => {
  navigation.navigate('PharmacyOrder' as never, {
    pharmacyId: params.pharmacieId,
  });
};

const handleCheckInteractions = () => {
  navigation.navigate('PharmacyAIInt相互作用' as never, {
    pharmacyId: params.pharmacieId,
  });
};
```

#### **Nouvelles sections** :

1. **Recherche Médicaments** :
```tsx
<NativeCard style={styles.card}>
  <Text style={styles.sectionTitle}>🔍 Rechercher un médicament</Text>
  <TextInput
    style={styles.searchInput}
    placeholder="Nom du médicament ou DCI"
    value={searchMedication}
    onChangeText={setSearchMedication}
  />
  <NativeButton
    title="Vérifier disponibilité"
    onPress={handleCheckAvailability}
    disabled={checkingAvailability || !searchMedication.trim()}
    loading={checkingAvailability}
    variant="primary"
  />
  
  {medicationAvailability && (
    <View style={styles.availabilityResult}>
      <Text style={styles.availabilityStatus}>
        {medicationAvailability.available ? '✅ Disponible' : '❌ Indisponible'}
      </Text>
      {medicationAvailability.available && (
        <>
          <Text>Stock: {medicationAvailability.medication.stock_quantity}</Text>
          {medicationAvailability.medication.price && (
            <Text>Prix: {medicationAvailability.medication.price} XAF</Text>
          )}
          <NativeButton
            title="Réserver"
            onPress={handleReserveMedication}
            variant="primary"
          />
        </>
      )}
    </View>
  )}
</NativeCard>
```

2. **Actions Rapides** :
```tsx
<View style={styles.actionsContainer}>
  <NativeButton
    title="💊 Créer une commande"
    onPress={handleCreateOrder}
    icon="shopping-cart"
    variant="primary"
  />
  <NativeButton
    title="⚕️ Vérifier interactions (IA)"
    onPress={handleCheckInteractions}
    icon="shield-check"
    variant="outline"
  />
</View>
```

---

### **3. LaboratoireDetailsScreen.tsx**

#### **À ajouter** :
```typescript
// Nouveaux états
const [examinationTypes, setExaminationTypes] = useState<ExaminationType[]>([]);
const [loadingTypes, setLoadingTypes] = useState(false);

// Nouveau effet
useEffect(() => {
  loadExaminationTypes();
}, []);

// Nouvelle fonction
const loadExaminationTypes = async () => {
  setLoadingTypes(true);
  const response = await labService.getExaminationTypes(params.laboratoryId);
  if (response.success && response.data) {
    setExaminationTypes(response.data.examination_types);
  }
  setLoadingTypes(false);
};

const handleBookExamination = (examinationType: ExaminationType) => {
  navigation.navigate('LabExaminationBooking' as never, {
    laboratoryId: params.laboratoryId,
    examinationType,
  });
};

const handleViewResults = () => {
  navigation.navigate('MyLabExaminations' as never);
};
```

#### **Nouvelle section** :

1. **Types d'Examens Disponibles** :
```tsx
<NativeCard style={styles.card}>
  <Text style={styles.sectionTitle}>🔬 Types d'examens disponibles</Text>
  {loadingTypes ? (
    <ActivityIndicator size="small" color={modernColors.primary} />
  ) : (
    examinationTypes.map((type) => (
      <TouchableOpacity
        key={type.id}
        style={styles.examinationTypeRow}
        onPress={() => handleBookExamination(type)}
      >
        <View style={styles.examinationTypeInfo}>
          <Text style={styles.examinationTypeName}>{type.name}</Text>
          {type.category && (
            <Text style={styles.examinationTypeCategory}>{type.category}</Text>
          )}
          {type.price && (
            <Text style={styles.examinationTypePrice}>{type.price} XAF</Text>
          )}
        </View>
        <NativeButton
          title="Réserver"
          onPress={() => handleBookExamination(type)}
          variant="outline"
          size="small"
        />
      </TouchableOpacity>
    ))
  )}
</NativeCard>
```

---

## 📄 **NOUVEAUX ÉCRANS À CRÉER**

### **Écrans Client**

#### **1. MyConsultationsScreen.tsx**
- Liste consultations hôpitaux
- Filtres par date/statut
- Détails consultation
- Navigation depuis HopitalDetailsScreen

#### **2. MyPharmacyOrdersScreen.tsx**
- Liste commandes pharmacies
- Statut commandes
- Détails commande
- Suivi livraison

#### **3. MyLabExaminationsScreen.tsx**
- Liste examens laboratoires
- Statut examens
- Accès résultats
- Analyse IA résultats

### **Écrans Prestataire**

#### **4. HospitalAnalyticsScreen.tsx**
- Graphiques consultations
- Temps d'attente moyens
- Revenus par période
- Spécialités populaires

#### **5. PharmacyAnalyticsScreen.tsx**
- Ventes par médicament
- Stock en temps réel
- Revenus
- Commandes en attente

#### **6. LabAnalyticsScreen.tsx**
- Examens par type
- Taux de positivité
- Revenus
- Temps de traitement

### **Écrans Fonctionnels**

#### **7. HospitalAIRecommendationsScreen.tsx**
- Formulaire symptômes
- Recommandations IA
- Liste hôpitaux suggérés
- Navigation vers détails

#### **8. PharmacyAIInt相互作用Screen.tsx**
- Saisie médicaments
- Vérification interactions IA
- Alertes sévérité
- Alternatives suggérées

#### **9. LabAIAnalysisScreen.tsx**
- Affichage résultats
- Analyse IA détaillée
- Anomalies détectées
- Recommandations examens complémentaires

---

## 🎯 **PRIORISATION**

### **Phase 1 - Amélioration Écrans Existants** (Priorité Haute)
1. ✅ Améliorer HopitalDetailsScreen.tsx
2. ✅ Améliorer PharmacieDetailsScreen.tsx
3. ✅ Améliorer LaboratoireDetailsScreen.tsx

### **Phase 2 - Nouveaux Écrans Client** (Priorité Moyenne)
1. ✅ MyConsultationsScreen.tsx
2. ✅ MyPharmacyOrdersScreen.tsx
3. ✅ MyLabExaminationsScreen.tsx

### **Phase 3 - Nouveaux Écrans IA** (Priorité Moyenne)
1. ✅ HospitalAIRecommendationsScreen.tsx
2. ✅ PharmacyAIInt相互作用Screen.tsx
3. ✅ LabAIAnalysisScreen.tsx

### **Phase 4 - Écrans Prestataire** (Priorité Basse)
1. ✅ HospitalAnalyticsScreen.tsx
2. ✅ PharmacyAnalyticsScreen.tsx
3. ✅ LabAnalyticsScreen.tsx

---

*Plan créé le : 2025-01-27*  
*Prochaine étape : Implémenter les améliorations écran par écran*

