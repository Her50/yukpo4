# 🎬 Plan d'Amélioration UX - Module Vidéo

**Date**: 2025-01-20  
**Objectif**: Unifier et améliorer l'expérience utilisateur du module vidéo dans toute l'application

---

## 📋 Table des matières

1. [Objectifs](#objectifs)
2. [Architecture unifiée](#architecture)
3. [Points d'accès](#points-acces)
4. [Améliorations par écran](#ameliorations)
5. [Plan d'implémentation](#implementation)
6. [Tests et validation](#tests)

---

## 🎯 Objectifs

### Objectifs principaux

1. **Unifier les systèmes de création vidéo**
   - Un seul système: `VideoCreationWizardScreen`
   - Supprimer `ProductVideoCreationModal` ou le transformer en raccourci

2. **Améliorer l'accès depuis tous les écrans**
   - Bouton vidéo visible dans HomeScreen
   - Bouton vidéo dans MesServicesScreen
   - Onglet "Vidéo" fonctionnel avec guidage

3. **Améliorer la navigation et le feedback**
   - Navigation simplifiée
   - Feedback visuel clair
   - Gestion d'erreurs robuste

4. **Améliorer VideoCreationIntroScreen**
   - Contenu dynamique
   - Supprimer/corriger bouton exemple
   - Meilleur guidage utilisateur

---

## 🏗️ Architecture unifiée

### Système unique: VideoCreationWizardScreen

```
Tous les points d'accès → VideoCreationWizardScreen
  ├─ Paramètres requis: serviceId, productIndex
  ├─ Paramètres optionnels: productName, serviceName
  └─ Navigation unifiée via helper
```

### Suppression de ProductVideoCreationModal

**Option A**: Supprimer complètement  
**Option B**: Transformer en raccourci vers VideoCreationWizard  
**Recommandation**: Option B (garder pour création rapide, mais rediriger vers wizard)

---

## 🚪 Points d'accès

### 1. HomeScreen

**Ajout**: Bouton vidéo dans le header

```typescript
<TouchableOpacity
    style={styles.headerButtonCompact}
    onPress={handleOpenVideo}
>
    <Text style={styles.headerButtonIconCompact}>🎬</Text>
</TouchableOpacity>
```

**Comportement**:
- Si l'utilisateur a des services → Afficher sélecteur de service/produit
- Sinon → Rediriger vers MesServices avec message

### 2. MesServicesScreen

**Ajout**: Bouton vidéo dans ServiceCardModern

```typescript
{onCreateVideo && (
    <TouchableOpacity
        style={[styles.actionButton, styles.actionVideo]}
        onPress={() => onCreateVideo(service)}
    >
        <SafeIcon name="video" size={18} color="#EC4899" />
        <Text style={styles.actionLabel}>Vidéo</Text>
    </TouchableOpacity>
)}
```

**Comportement**:
- Si le service a des produits → Sélecteur de produit
- Sinon → Message pour créer un produit d'abord

### 3. MesProduitsScreen

**Modification**: Rediriger vers VideoCreationWizard au lieu du modal

```typescript
const openVideoCreatorForProduct = (product: ManagedProduct) => {
    navigateToVideoWizard({
        serviceId: product.serviceId,
        productIndex: product.productIndex,
        productName: product.nom
    });
};
```

### 4. Onglet "Vidéo" (bas)

**Amélioration**: VideoCreationIntroScreen avec guidage

- Vérifier si l'utilisateur a des services
- Afficher les services disponibles
- Bouton "Créer une vidéo" → Sélecteur si plusieurs services
- Supprimer/corriger bouton "Voir un exemple"

---

## 🔧 Améliorations par écran

### HomeScreen

#### Ajout du bouton vidéo

**Localisation**: Header actions (ligne ~598)

**Code**:
```typescript
const handleOpenVideo = () => {
    // Vérifier si l'utilisateur a des services
    checkUserServices()
        .then(services => {
            if (services.length === 0) {
                Alert.alert(
                    'Service requis',
                    'Pour créer une vidéo, vous devez d\'abord créer un service avec au moins un produit.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { 
                            text: 'Créer un service', 
                            onPress: () => {
                                const parent = (navigation as any).getParent();
                                if (parent) {
                                    parent.navigate('Services');
                                }
                            }
                        }
                    ]
                );
                return;
            }
            
            // Si un seul service avec un seul produit → Navigation directe
            if (services.length === 1 && services[0].products?.length === 1) {
                navigateToVideoWizard({
                    serviceId: services[0].id,
                    productIndex: 0,
                    productName: services[0].products[0].nom
                });
                return;
            }
            
            // Sinon → Afficher sélecteur
            showServiceProductSelector(services);
        })
        .catch(error => {
            Alert.alert('Erreur', 'Impossible de charger vos services');
        });
};
```

### MesServicesScreen

#### Ajout du handler onCreateVideo

**Code**:
```typescript
const handleCreateVideo = (service: any) => {
    const produits = service.data?.produits?.valeur || [];
    
    if (produits.length === 0) {
        Alert.alert(
            'Produit requis',
            'Ce service n\'a pas encore de produit. Créez d\'abord un produit pour pouvoir créer une vidéo.',
            [
                { text: 'Annuler', style: 'cancel' },
                { 
                    text: 'Créer un produit', 
                    onPress: () => {
                        navigation.navigate('FormulaireYukpoIntelligent', {
                            mode: 'edit',
                            serviceId: service.id,
                            focusProduct: true
                        });
                    }
                }
            ]
        );
        return;
    }
    
    // Si un seul produit → Navigation directe
    if (produits.length === 1) {
        navigateToVideoWizard({
            serviceId: service.service_id || service.id,
            productIndex: 0,
            productName: produits[0].nom || produits[0].name
        });
        return;
    }
    
    // Sinon → Afficher sélecteur de produit
    showProductSelector(service, produits);
};
```

#### Modification de ServiceCardModern

**Ajout du prop**:
```typescript
interface ServiceCardModernProps {
    // ... existing props
    onCreateVideo?: (service: any) => void;
}
```

**Ajout du bouton**:
```typescript
{onCreateVideo && (
    <TouchableOpacity
        style={[styles.actionButton, styles.actionVideo]}
        onPress={() => onCreateVideo(service)}
        activeOpacity={0.7}
    >
        <SafeIcon name="video" size={18} color="#EC4899" />
        <Text style={[styles.actionLabel, { color: '#EC4899' }]}>Vidéo</Text>
    </TouchableOpacity>
)}
```

### VideoCreationIntroScreen

#### Améliorations principales

1. **Charger les services de l'utilisateur**
```typescript
const [userServices, setUserServices] = useState<any[]>([]);
const [loadingServices, setLoadingServices] = useState(true);

useEffect(() => {
    const loadServices = async () => {
        try {
            const response = await apiGet('/api/prestataire/services');
            if (response.success && Array.isArray(response.data)) {
                setUserServices(response.data);
            }
        } catch (error) {
            console.error('Erreur chargement services:', error);
        } finally {
            setLoadingServices(false);
        }
    };
    loadServices();
}, []);
```

2. **Améliorer handleStart**
```typescript
const handleStart = () => {
    // Si params déjà présents → Navigation directe
    if (params.serviceId && params.productIndex !== undefined) {
        navigateToVideoWizard(params);
        return;
    }
    
    // Si l'utilisateur a des services → Afficher sélecteur
    if (userServices.length > 0) {
        showServiceProductSelector(userServices);
        return;
    }
    
    // Sinon → Rediriger vers MesServices
    Alert.alert(
        'Service requis',
        'Pour créer une vidéo, vous devez d\'abord créer un service avec au moins un produit.',
        [
            { text: 'Annuler', style: 'cancel' },
            { 
                text: 'Aller à Mes Services', 
                onPress: () => {
                    const parent = (navigation as any).getParent();
                    if (parent) {
                        parent.navigate('Services');
                    }
                }
            }
        ]
    );
};
```

3. **Supprimer/corriger handleShowExample**
```typescript
const handleShowExample = () => {
    // Option A: Supprimer complètement
    // (ne pas afficher le bouton)
    
    // Option B: Afficher un modal avec informations
    Alert.alert(
        'Exemples de vidéos',
        'Découvrez les possibilités de création vidéo avec Yukpo:\n\n' +
        '• Vidéos promotionnelles pour vos produits\n' +
        '• Tutoriels et démonstrations\n' +
        '• Témoignages clients\n' +
        '• Comparatifs produits\n\n' +
        'Créez votre première vidéo pour voir le résultat!',
        [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Créer ma vidéo', onPress: handleStart }
        ]
    );
};
```

4. **Améliorer l'image hero**
```typescript
const [imageError, setImageError] = useState(false);

<NativeCard style={styles.heroCard}>
    {!imageError ? (
        <Image
            source={{
                uri: 'https://cdn.yukpo.com/illustrations/video-immersive-hero.png',
            }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
        />
    ) : (
        <View style={styles.heroFallback}>
            <SafeIcon name="film" size={64} color={modernColors.primary} />
            <Text style={styles.heroFallbackText}>
                {t('video.intro.heroTitle')}
            </Text>
        </View>
    )}
    {/* Overlay... */}
</NativeCard>
```

5. **Ajouter du contenu dynamique**
```typescript
{userServices.length > 0 && (
    <View style={styles.servicesPreview}>
        <Text style={styles.servicesPreviewTitle}>
            {userServices.length} service(s) disponible(s)
        </Text>
        <Text style={styles.servicesPreviewSubtitle}>
            Sélectionnez un produit pour créer votre vidéo
        </Text>
    </View>
)}
```

### MesProduitsScreen

#### Modification de openVideoCreatorForProduct

**Code**:
```typescript
const openVideoCreatorForProduct = (product: ManagedProduct) => {
    const serviceId = product.serviceId;
    const productIndex = product.productIndex || 0;
    const productName = product.nom || product.name;
    
    if (!serviceId) {
        Alert.alert('Erreur', 'Service ID manquant pour ce produit');
        return;
    }
    
    navigateToVideoWizard({
        serviceId: Number(serviceId),
        productIndex: Number(productIndex),
        productName: productName
    });
};
```

---

## 🛠️ Utilitaires à créer

### 1. Hook useNavigationHelper

**Fichier**: `mobile/src/hooks/useNavigationHelper.ts`

```typescript
import { useNavigation } from '@react-navigation/native';

export const useNavigationHelper = () => {
    const navigation = useNavigation();
    
    const navigateToStack = (route: string, params?: any) => {
        const parent = (navigation as any).getParent();
        if (parent) {
            parent.navigate(route, params);
        } else {
            navigation.navigate(route as never, params as never);
        }
    };
    
    return { navigateToStack };
};
```

### 2. Fonction navigateToVideoWizard

**Fichier**: `mobile/src/utils/videoNavigation.ts`

```typescript
import { Alert } from 'react-native';

interface VideoWizardParams {
    serviceId: number;
    productIndex: number;
    productName?: string;
    serviceName?: string;
}

export const navigateToVideoWizard = (
    navigation: any,
    params: VideoWizardParams
) => {
    // Validation
    if (!params.serviceId || params.productIndex === undefined) {
        Alert.alert('Erreur', 'Paramètres manquants pour créer une vidéo');
        return;
    }
    
    // Navigation
    const parent = navigation.getParent ? navigation.getParent() : null;
    if (parent) {
        parent.navigate('VideoCreationWizard', params);
    } else {
        navigation.navigate('VideoCreationWizard' as never, params as never);
    }
};
```

### 3. Composant ServiceProductSelector

**Fichier**: `mobile/src/components/ServiceProductSelector.tsx`

```typescript
interface ServiceProductSelectorProps {
    visible: boolean;
    services: any[];
    onSelect: (serviceId: number, productIndex: number, productName: string) => void;
    onClose: () => void;
}

const ServiceProductSelector: React.FC<ServiceProductSelectorProps> = ({
    visible,
    services,
    onSelect,
    onClose
}) => {
    // Modal avec liste des services et produits
    // Permet de sélectionner un produit pour créer une vidéo
};
```

---

## 📝 Plan d'implémentation

### Phase 1: Infrastructure (1h)

1. ✅ Créer `useNavigationHelper` hook
2. ✅ Créer `navigateToVideoWizard` utilitaire
3. ✅ Créer `ServiceProductSelector` composant

### Phase 2: HomeScreen (30 min)

1. ✅ Ajouter bouton vidéo dans header
2. ✅ Implémenter `handleOpenVideo`
3. ✅ Ajouter vérification services

### Phase 3: MesServicesScreen (45 min)

1. ✅ Ajouter prop `onCreateVideo` à ServiceCardModern
2. ✅ Implémenter `handleCreateVideo`
3. ✅ Ajouter bouton vidéo dans ServiceCardModern

### Phase 4: VideoCreationIntroScreen (1h)

1. ✅ Charger services utilisateur
2. ✅ Améliorer `handleStart`
3. ✅ Corriger/supprimer `handleShowExample`
4. ✅ Améliorer image hero avec fallback
5. ✅ Ajouter contenu dynamique

### Phase 5: MesProduitsScreen (30 min)

1. ✅ Modifier `openVideoCreatorForProduct` pour utiliser VideoCreationWizard
2. ✅ Garder `ProductVideoCreationModal` comme raccourci optionnel

### Phase 6: Tests (1h)

1. ✅ Tester navigation depuis tous les points d'accès
2. ✅ Tester avec/sans services
3. ✅ Tester avec/sans produits
4. ✅ Vérifier gestion d'erreurs

**Temps total estimé**: ~4h45

---

## ✅ Checklist d'implémentation

### Infrastructure
- [ ] Créer `useNavigationHelper` hook
- [ ] Créer `navigateToVideoWizard` utilitaire
- [ ] Créer `ServiceProductSelector` composant

### HomeScreen
- [ ] Ajouter bouton vidéo dans header
- [ ] Implémenter `handleOpenVideo`
- [ ] Ajouter vérification services
- [ ] Tester navigation

### MesServicesScreen
- [ ] Ajouter prop `onCreateVideo` à ServiceCardModern
- [ ] Implémenter `handleCreateVideo`
- [ ] Ajouter bouton vidéo dans ServiceCardModern
- [ ] Tester navigation

### VideoCreationIntroScreen
- [ ] Charger services utilisateur
- [ ] Améliorer `handleStart`
- [ ] Corriger/supprimer `handleShowExample`
- [ ] Améliorer image hero
- [ ] Ajouter contenu dynamique
- [ ] Tester navigation

### MesProduitsScreen
- [ ] Modifier `openVideoCreatorForProduct`
- [ ] Tester navigation

### Tests finaux
- [ ] Tester tous les points d'accès
- [ ] Vérifier gestion d'erreurs
- [ ] Vérifier feedback visuel
- [ ] Vérifier traductions

---

## 🎯 Résultat attendu

Après implémentation:

1. ✅ **Accès unifié**: Tous les points d'accès utilisent `VideoCreationWizardScreen`
2. ✅ **Navigation claire**: Guidage utilisateur vers la sélection de service/produit
3. ✅ **Feedback visuel**: Indicateurs de chargement et messages d'erreur clairs
4. ✅ **Expérience cohérente**: Même flux partout dans l'application
5. ✅ **Gestion d'erreurs**: Messages clairs si services/produits manquants

---

**Prochaine étape**: Implémenter les phases 1-5 selon le plan ci-dessus.

