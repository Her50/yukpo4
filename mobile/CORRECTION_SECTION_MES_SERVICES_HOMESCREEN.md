# 🔧 Correction - Section "Mes services" et bouton vidéo en bas de HomeScreen

## 🎯 Fonctionnalité implémentée

Ajout d'une section "Mes services" en bas de `HomeScreen` qui s'affiche uniquement si l'utilisateur a des services avec des produits. Cette section inclut :
- Liste horizontale des services de l'utilisateur
- Bouton d'ajout de vidéo (➕ Vidéo)

## 🔍 Logique de vérification

### Vérification des services

La section s'affiche seulement si :
1. ✅ L'utilisateur est connecté
2. ✅ L'utilisateur a au moins un service actif
3. ✅ Ce service a au moins un produit

### Ordre de vérification

```typescript
// 1. Appel API pour charger les services
const response = await apiGet('/api/prestataire/services');

// 2. Filtrer les services actifs avec produits
const activeServicesWithProducts = servicesData.filter((service: any) => {
    const isActive = service.is_active !== false && service.actif !== false;
    const hasProducts = !!(
        service.data?.produits ||
        service.produits ||
        service.data?.listeproduit
    );
    return isActive && hasProducts;
});

// 3. Afficher la section si au moins un service répond aux critères
if (activeServicesWithProducts.length > 0) {
    setHasServices(true);
    setUserServices(activeServicesWithProducts);
}
```

## ✅ Implémentation

### États ajoutés

```typescript
const [userServices, setUserServices] = useState<any[]>([]);
const [loadingServices, setLoadingServices] = useState(false);
const [hasServices, setHasServices] = useState(false);
```

### Fonction de chargement

```typescript
const loadUserServices = useCallback(async () => {
    if (!user) {
        setHasServices(false);
        setUserServices([]);
        return;
    }

    try {
        setLoadingServices(true);
        const response = await apiGet('/api/prestataire/services');
        
        // ... traitement et filtrage ...
        
        if (activeServicesWithProducts.length > 0) {
            setUserServices(activeServicesWithProducts);
            setHasServices(true);
        } else {
            setHasServices(false);
        }
    } catch (error) {
        setHasServices(false);
    } finally {
        setLoadingServices(false);
    }
}, [user]);
```

### Chargement automatique

```typescript
React.useEffect(() => {
    loadUserServices();
}, [loadUserServices]);
```

## 🎬 Gestion du bouton vidéo

### Handler `handleAddVideo`

```typescript
const handleAddVideo = useCallback(() => {
    // 1. Vérifier qu'il y a des services
    if (!hasServices || userServices.length === 0) {
        Alert.alert(/* ... */);
        return;
    }

    // 2. Si un seul service → Navigation directe vers VideoCreationWizard
    if (userServices.length === 1) {
        const service = userServices[0];
        const serviceId = service.id || service.service_id;
        const produits = /* extraction produits */;
        
        navigateToVideoWizard(navigation, {
            serviceId: serviceId,
            productIndex: firstProduct.product_index,
            productName: firstProduct.nom
        });
    } else {
        // 3. Plusieurs services → VideoCreationIntro pour choisir
        navigate('VideoCreationIntro', {});
    }
}, [hasServices, userServices, navigation]);
```

## 📱 Interface utilisateur

### Structure de la section

```tsx
{hasServices && userServices.length > 0 && (
    <View style={styles.servicesSection}>
        {/* Header avec titre et bouton vidéo */}
        <View style={styles.servicesHeader}>
            <Text style={styles.servicesTitle}>Mes services</Text>
            <TouchableOpacity
                style={styles.addVideoButton}
                onPress={handleAddVideo}
            >
                <Text style={styles.addVideoButtonText}>➕ Vidéo</Text>
            </TouchableOpacity>
        </View>
        
        {/* Liste horizontale des services */}
        <ScrollView horizontal>
            {userServices.slice(0, 5).map((service, index) => (
                <TouchableOpacity
                    key={service.id || index}
                    style={styles.serviceCard}
                    onPress={() => navigate('MesServices', {})}
                >
                    <Text style={styles.serviceCardTitle}>
                        {titre}
                    </Text>
                    <Text style={styles.serviceCardSubtitle}>
                        {nombreProduits} produit(s)
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
)}
```

### Styles

- **servicesSection** : Conteneur principal avec bordure supérieure
- **servicesHeader** : Flexbox avec titre et bouton vidéo
- **addVideoButton** : Bouton primaire avec icône ➕
- **servicesList** : ScrollView horizontal pour la liste
- **serviceCard** : Carte de service avec titre et nombre de produits

## 🔄 Flux de navigation

### Scénario 1 : Un seul service
```
HomeScreen (bouton ➕ Vidéo)
  ↓
handleAddVideo détecte 1 service
  ↓
navigateToVideoWizard(navigation, {
    serviceId: 123,
    productIndex: 0,
    productName: "Produit 1"
})
  ↓
VideoCreationWizardScreen
```

### Scénario 2 : Plusieurs services
```
HomeScreen (bouton ➕ Vidéo)
  ↓
handleAddVideo détecte plusieurs services
  ↓
navigate('VideoCreationIntro', {})
  ↓
VideoCreationIntroScreen (choix du service)
```

### Scénario 3 : Aucun service
```
HomeScreen (bouton ➕ Vidéo)
  ↓
handleAddVideo détecte aucun service
  ↓
Alert.alert avec option "Créer un service"
  ↓
setIsCreateService(true)
```

## 🧪 Tests à effectuer

1. **Test utilisateur sans services** :
   - ✅ Vérifier que la section ne s'affiche pas
   - ✅ Vérifier que le bouton vidéo n'est pas visible

2. **Test utilisateur avec 1 service** :
   - ✅ Vérifier que la section s'affiche
   - ✅ Vérifier que le service est listé
   - ✅ Vérifier que le bouton vidéo fonctionne
   - ✅ Vérifier la navigation directe vers VideoCreationWizard

3. **Test utilisateur avec plusieurs services** :
   - ✅ Vérifier que les services sont listés (max 5)
   - ✅ Vérifier que le bouton vidéo fonctionne
   - ✅ Vérifier la navigation vers VideoCreationIntro

4. **Test clic sur une carte de service** :
   - ✅ Vérifier la navigation vers MesServices

5. **Test chargement** :
   - ✅ Vérifier l'affichage "Chargement..." pendant le chargement
   - ✅ Vérifier que la section s'affiche après le chargement

## 📝 Notes importantes

1. **Performance** : Le chargement se fait au montage du composant et se met à jour quand l'utilisateur change

2. **Limitation** : Seuls les 5 premiers services sont affichés pour éviter une liste trop longue

3. **Filtrage** : Seuls les services actifs avec produits sont affichés

4. **Gestion d'erreur** : Si le chargement échoue, la section ne s'affiche pas (pas de blocage)

5. **Navigation** : Le clic sur une carte de service redirige vers `MesServices` pour voir tous les services

## 🚀 Prochaines étapes

Si des améliorations sont nécessaires :
1. Ajouter un indicateur de rafraîchissement (pull-to-refresh)
2. Ajouter un bouton "Voir tout" pour afficher tous les services
3. Ajouter des animations lors de l'affichage
4. Optimiser le chargement avec mise en cache

