# 🎯 GUIDE FINALISATION FRONTEND 100%

**Pour compléter les 7 objectifs restants après le nettoyage de ProductManagerMobile**

---

## 📊 STATUT ACTUEL

| # | Objectif | Statut | Fichier | Backend |
|---|----------|--------|---------|---------|
| 1 | Duplication produit | ✅ FAIT | ProductManagerMobile | ✅ |
| 2 | Texte état vide | ✅ FAIT | ProductManagerMobile | N/A |
| 3 | Modification produit | ❌ TODO | ProductManagerMobile + Formulaire | ✅ |
| 4 | Blocage suppression | ❌ TODO | Écran gestion services | ✅ |
| 5 | Désactivation produit | ❌ TODO | ProductManagerMobile | ✅ |
| 6 | Réactivation produit | ❌ TODO | ProductManagerMobile | ✅ |
| 7 | Mode add_product | ✅ FAIT | FormulaireYukpoIntelligent | ✅ |
| 8 | Nettoyage obsolète | ❌ TODO | ProductManagerMobile | N/A |
| 9 | Validation formulaires | ❌ TODO | FormulaireYukpoIntelligent | N/A |
| 10 | Gestion erreurs | ❌ TODO | Tous les fichiers | N/A |

**Complétés** : 3/10 (30%)  
**À faire** : 7/10 (70%)

---

## 🔧 CONFIGURATION BACKEND DISPONIBLE

### Endpoints Créés (2025-11-01)

#### 1. Ajout Produit Incrémental
```
POST /api/services/{service_id}/products
Authorization: Bearer {token}

Body:
{
  "nom": "iPhone 15 Pro",
  "prix": "850000",
  "devise": "XAF",
  "description": "128GB, Bleu Titane",
  "sous_caracteristiques": {
    "marque": "Apple",
    "modele": "iPhone 15 Pro",
    "couleur": "Bleu Titane"
  }
}

Response:
{
  "success": true,
  "service_id": 123,
  "product_index": 1,
  "cost": 3000,
  "new_balance": 47000,
  "message": "Produit ajouté avec succès"
}
```

#### 2. Désactivation Produit
```
POST /api/services/{service_id}/products/{product_index}/deactivate
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Produit désactivé",
  "notification_sent": true
}
```

#### 3. Réactivation Produit
```
POST /api/services/{service_id}/products/{product_index}/reactivate
Authorization: Bearer {token}

Response:
{
  "success": true,
  "cost": 1000,
  "new_balance": 46000,
  "message": "Produit réactivé",
  "notification_sent": true
}
```

#### 4. Suppression Service (avec blocage)
```
DELETE /api/services/{service_id}
Authorization: Bearer {token}

Response (si >= 2 produits):
{
  "error": "Cannot delete service with multiple products",
  "products_count": 3,
  "message": "Supprimez d'abord les produits individuellement"
}

Response (si < 2 produits):
{
  "success": true,
  "message": "Service supprimé"
}
```

---

## 🎯 OBJECTIF #3 : MODIFICATION PRODUIT

### Fichier : `ProductManagerMobile.tsx`

### Localisation
Chercher la fonction `handleEdit` ou le bouton "Modifier" dans le ProductCard.

### Code à Ajouter

```typescript
// DANS ProductManagerMobile.tsx

// 1. Import nécessaire
import { useNavigation } from '@react-navigation/native';

// 2. Dans le composant
const navigation = useNavigation();

// 3. Fonction handleEdit (remplacer ou créer)
const handleEdit = async (product: Product, index: number) => {
    try {
        // Récupérer les données complètes du service
        if (!props.serviceId) {
            Alert.alert('Erreur', 'Service ID manquant');
            return;
        }

        // Charger les données du service
        const response = await fetch(
            `${API_BASE_URL}/api/services/${props.serviceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Erreur lors du chargement du service');
        }

        const serviceData = await response.json();

        // Naviguer vers le formulaire en mode édition
        navigation.navigate('FormulaireYukpoIntelligent', {
            mode: 'edit_product',
            serviceId: props.serviceId,
            productToEdit: product,
            productIndex: index,
            serviceData: serviceData.data, // Données complètes du service
        });
    } catch (error) {
        console.error('[handleEdit] Erreur:', error);
        Alert.alert(
            'Erreur',
            'Impossible de charger le produit. Vérifiez votre connexion.',
            [{ text: 'Ok' }]
        );
    }
};

// 4. Dans le rendu du ProductCard, bouton Modifier
<TouchableOpacity
    style={styles.actionButton}
    onPress={() => handleEdit(product, index)}
>
    <SafeIcon name="edit" size={18} color={modernColors.primary} />
    <Text style={styles.actionButtonText}>Modifier</Text>
</TouchableOpacity>
```

### Fichier : `FormulaireYukpoIntelligentScreen.tsx`

### Code à Ajouter

```typescript
// DANS FormulaireYukpoIntelligentScreen.tsx

// 1. Détecter le mode edit_product
const isEditingProduct = route.params?.mode === 'edit_product';
const productToEdit = route.params?.productToEdit;
const productIndex = route.params?.productIndex;

// 2. useEffect pour pré-remplir le formulaire
useEffect(() => {
    if (isEditingProduct && productToEdit && route.params?.serviceData) {
        console.log('[FormulaireYukpo] Mode edit_product détecté');
        
        // Charger les données du service
        const serviceData = route.params.serviceData;
        
        // Pré-remplir le formulaire avec les données du service
        setFormData({
            titre_service: serviceData.titre_service || '',
            description_service: serviceData.description || '',
            categorie: serviceData.categorie || '',
            type_offre: serviceData.type_offre || 'produit',
            // ... autres champs service
            
            // Pré-remplir avec les données du produit à éditer
            nom_produit: productToEdit.nom || '',
            prix_produit: productToEdit.prix?.toString() || '',
            devise_produit: productToEdit.devise || 'XAF',
            description_produit: productToEdit.description || '',
            sous_caracteristiques: productToEdit.sous_caracteristiques || {},
        });
        
        // Focus sur le bloc produit
        setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 600, animated: true });
        }, 500);
    }
}, [isEditingProduct, productToEdit]);

// 3. Modifier la fonction soumettreFormulaire
const soumettreFormulaire = async () => {
    // ... validation existante ...
    
    if (isEditingProduct) {
        try {
            const token = await AsyncStorage.getItem('token');
            
            // Construire le produit modifié
            const produitModifie = {
                nom: formData.nom_produit,
                prix: parseFloat(formData.prix_produit),
                devise: formData.devise_produit || 'XAF',
                description: formData.description_produit,
                sous_caracteristiques: formData.sous_caracteristiques || {},
            };
            
            // Envoyer la mise à jour
            const response = await fetch(
                `${API_BASE_URL}/api/services/${route.params.serviceId}/products/${productIndex}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(produitModifie),
                }
            );
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la modification');
            }
            
            Alert.alert(
                '✅ Produit modifié',
                `Votre produit a été mis à jour avec succès.`,
                [
                    {
                        text: 'Ok',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error) {
            console.error('[soumettreFormulaire] Erreur edit_product:', error);
            Alert.alert('Erreur', error.message || 'Impossible de modifier le produit');
        }
        return;
    }
    
    // ... reste du code existant pour création ...
};
```

### Test
1. Aller dans "Mes Services"
2. Cliquer sur un produit
3. Cliquer "Modifier"
4. Formulaire pré-rempli s'affiche
5. Modifier un champ
6. Sauvegarder
7. Vérifier la modification

---

## 🎯 OBJECTIF #4 : BLOCAGE SUPPRESSION SERVICE

### Fichier : Chercher où le bouton "Supprimer service" est affiché

Probablement dans :
- `ServiceDetailScreen.tsx`
- `MesServicesScreen.tsx`
- `ProductManagerMobile.tsx`

### Code à Ajouter

```typescript
// DANS le composant qui affiche le bouton "Supprimer service"

// 1. Récupérer le nombre de produits
const productsCount = service.data?.produits?.length || 0;

// 2. Condition d'affichage du bouton
{productsCount < 2 && (
    <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeleteService}
    >
        <SafeIcon name="trash" size={18} color="#DC2626" />
        <Text style={styles.deleteButtonText}>Supprimer le service</Text>
    </TouchableOpacity>
)}

{productsCount >= 2 && (
    <View style={styles.warningBox}>
        <SafeIcon name="alert-circle" size={20} color="#F59E0B" />
        <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>
                ⚠️ Suppression bloquée
            </Text>
            <Text style={styles.warningText}>
                Ce service contient {productsCount} produits. Vous devez d'abord 
                supprimer les produits individuellement avant de pouvoir supprimer 
                le service.
            </Text>
        </View>
    </View>
)}

// 3. Styles
const styles = StyleSheet.create({
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
        marginTop: 16,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 4,
    },
    warningText: {
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
});
```

### Test
1. Créer un service avec 2+ produits
2. Aller dans détails du service
3. Le bouton "Supprimer" ne doit PAS apparaître
4. Message d'avertissement s'affiche
5. Supprimer un produit
6. Bouton "Supprimer" réapparaît si < 2 produits

---

## 🎯 OBJECTIF #5 : DÉSACTIVATION PRODUIT

### Fichier : `ProductManagerMobile.tsx`

### Code à Ajouter

```typescript
// DANS ProductManagerMobile.tsx

// 1. Fonction de désactivation
const handleDeactivateProduct = async (productIndex: number, productName: string) => {
    Alert.alert(
        '⏸️ Désactiver le produit',
        `Voulez-vous vraiment désactiver "${productName}" ?\n\n` +
        `Le produit ne sera plus visible dans les recherches.`,
        [
            {
                text: 'Annuler',
                style: 'cancel',
            },
            {
                text: 'Désactiver',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        
                        const response = await fetch(
                            `${API_BASE_URL}/api/services/${props.serviceId}/products/${productIndex}/deactivate`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                },
                            }
                        );
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                            throw new Error(data.message || 'Erreur lors de la désactivation');
                        }
                        
                        Alert.alert(
                            '✅ Produit désactivé',
                            `"${productName}" a été désactivé avec succès.\n\n` +
                            `💡 Le produit sera automatiquement désactivé après 30 jours d'inactivité.`,
                            [
                                {
                                    text: 'Ok',
                                    onPress: () => {
                                        // Recharger la liste
                                        props.onProductsChange?.(props.products);
                                    },
                                },
                            ]
                        );
                    } catch (error) {
                        console.error('[handleDeactivateProduct] Erreur:', error);
                        Alert.alert('Erreur', error.message || 'Impossible de désactiver le produit');
                    }
                },
            },
        ]
    );
};

// 2. Dans le rendu du ProductCard - Ajouter le bouton
{product.is_active !== false && (
    <TouchableOpacity
        style={styles.deactivateButton}
        onPress={() => handleDeactivateProduct(index, product.nom)}
    >
        <SafeIcon name="pause-circle" size={18} color="#F59E0B" />
        <Text style={styles.deactivateButtonText}>Désactiver</Text>
    </TouchableOpacity>
)}

// 3. Badge si produit désactivé
{product.is_active === false && (
    <View style={styles.inactiveBadge}>
        <SafeIcon name="pause-circle" size={14} color="#DC2626" />
        <Text style={styles.inactiveBadgeText}>Inactif</Text>
    </View>
)}

// 4. Styles
const styles = StyleSheet.create({
    deactivateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    deactivateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
    },
    inactiveBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#FEE2E2',
        borderRadius: 6,
    },
    inactiveBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#DC2626',
    },
});
```

### Test
1. Aller dans un produit actif
2. Cliquer "Désactiver"
3. Confirmer
4. Badge "Inactif" apparaît
5. Produit ne s'affiche plus dans recherches
6. Notification reçue

---

## 🎯 OBJECTIF #6 : RÉACTIVATION PRODUIT

### Fichier : `ProductManagerMobile.tsx`

### Code à Ajouter

```typescript
// DANS ProductManagerMobile.tsx

// 1. Fonction de réactivation
const handleReactivateProduct = async (productIndex: number, productName: string) => {
    Alert.alert(
        '▶️ Réactiver le produit',
        `Voulez-vous réactiver "${productName}" ?\n\n` +
        `💰 Coût : 1000 FCFA (ou prorata si désactivé manuellement)\n` +
        `Le produit redeviendra visible dans les recherches.`,
        [
            {
                text: 'Annuler',
                style: 'cancel',
            },
            {
                text: 'Réactiver',
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        
                        const response = await fetch(
                            `${API_BASE_URL}/api/services/${props.serviceId}/products/${productIndex}/reactivate`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                },
                            }
                        );
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                            if (data.error === 'Insufficient balance') {
                                Alert.alert(
                                    '💳 Solde insuffisant',
                                    `Votre solde actuel : ${data.current_balance} FCFA\n` +
                                    `Coût de réactivation : ${data.cost_required} FCFA\n\n` +
                                    `Veuillez recharger votre compte.`,
                                    [
                                        { text: 'Annuler', style: 'cancel' },
                                        {
                                            text: 'Recharger',
                                            onPress: () => navigation.navigate('RechargeTokens'),
                                        },
                                    ]
                                );
                                return;
                            }
                            throw new Error(data.message || 'Erreur lors de la réactivation');
                        }
                        
                        Alert.alert(
                            '✅ Produit réactivé',
                            `"${productName}" a été réactivé avec succès.\n\n` +
                            `💰 Coût : ${data.cost} FCFA\n` +
                            `💵 Nouveau solde : ${data.new_balance} FCFA`,
                            [
                                {
                                    text: 'Ok',
                                    onPress: () => {
                                        // Recharger la liste
                                        props.onProductsChange?.(props.products);
                                    },
                                },
                            ]
                        );
                    } catch (error) {
                        console.error('[handleReactivateProduct] Erreur:', error);
                        Alert.alert('Erreur', error.message || 'Impossible de réactiver le produit');
                    }
                },
            },
        ]
    );
};

// 2. Dans le rendu du ProductCard - Bouton réactivation
{product.is_active === false && (
    <TouchableOpacity
        style={styles.reactivateButton}
        onPress={() => handleReactivateProduct(index, product.nom)}
    >
        <SafeIcon name="play-circle" size={18} color="#10B981" />
        <Text style={styles.reactivateButtonText}>
            Réactiver (1000 FCFA)
        </Text>
    </TouchableOpacity>
)}

// 3. Styles
const styles = StyleSheet.create({
    reactivateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    reactivateButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#065F46',
    },
});
```

### Test
1. Produit désactivé avec badge "Inactif"
2. Cliquer "Réactiver"
3. Confirmer
4. Vérifier débit (1000 FCFA)
5. Badge "Inactif" disparaît
6. Produit réapparaît dans recherches
7. Notification reçue

---

## 🎯 OBJECTIF #9 : VALIDATION FORMULAIRES

### Fichier : `FormulaireYukpoIntelligentScreen.tsx`

### Code à Ajouter

```typescript
// DANS FormulaireYukpoIntelligentScreen.tsx

// 1. Fonction de validation
const validateFormData = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Champs obligatoires service
    if (!formData.titre_service?.trim()) {
        errors.push('• Le titre du service est obligatoire');
    }
    
    if (!formData.description_service?.trim()) {
        errors.push('• La description du service est obligatoire');
    }
    
    if (!formData.categorie) {
        errors.push('• La catégorie est obligatoire');
    }
    
    // Champs obligatoires produit
    if (!formData.nom_produit?.trim()) {
        errors.push('• Le nom du produit est obligatoire');
    }
    
    if (!formData.prix_produit || parseFloat(formData.prix_produit) <= 0) {
        errors.push('• Le prix du produit doit être supérieur à 0');
    }
    
    // Validation des champs spécifiques selon type
    if (formData.type_offre === 'produit') {
        // Pour les produits, certains champs autocomplete peuvent être obligatoires
        const sousCaracts = formData.sous_caracteristiques || {};
        
        // Exemple : marque obligatoire pour certaines catégories
        const categoriesAvecMarque = ['automobile', 'telephone', 'electronique'];
        if (categoriesAvecMarque.includes(formData.categorie) && !sousCaracts.marque) {
            errors.push('• La marque est obligatoire pour cette catégorie');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
    };
};

// 2. Modifier soumettreFormulaire
const soumettreFormulaire = async () => {
    // Validation
    const validation = validateFormData();
    
    if (!validation.valid) {
        Alert.alert(
            '⚠️ Formulaire incomplet',
            'Veuillez corriger les erreurs suivantes :\n\n' +
            validation.errors.join('\n'),
            [{ text: 'Ok' }]
        );
        return;
    }
    
    // Confirmation avec résumé
    Alert.alert(
        '📋 Confirmation',
        `Titre : ${formData.titre_service}\n` +
        `Produit : ${formData.nom_produit}\n` +
        `Prix : ${formData.prix_produit} ${formData.devise_produit || 'XAF'}\n\n` +
        `💰 Coût estimé : ${estimatedCost} FCFA\n\n` +
        `Confirmer la création ?`,
        [
            {
                text: 'Annuler',
                style: 'cancel',
            },
            {
                text: 'Confirmer',
                onPress: async () => {
                    // ... reste du code existant ...
                },
            },
        ]
    );
};

// 3. Affichage des erreurs en temps réel
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

const validateField = (fieldName: string, value: any) => {
    const errors = { ...fieldErrors };
    
    switch (fieldName) {
        case 'titre_service':
            if (!value?.trim()) {
                errors.titre_service = 'Titre obligatoire';
            } else {
                delete errors.titre_service;
            }
            break;
        case 'prix_produit':
            if (!value || parseFloat(value) <= 0) {
                errors.prix_produit = 'Prix invalide';
            } else {
                delete errors.prix_produit;
            }
            break;
        // ... autres champs ...
    }
    
    setFieldErrors(errors);
};

// 4. Dans le rendu des champs
<NativeInput
    placeholder="Titre du service *"
    value={formData.titre_service}
    onChangeText={(text) => {
        setFormData({ ...formData, titre_service: text });
        validateField('titre_service', text);
    }}
    style={[
        styles.input,
        fieldErrors.titre_service && styles.inputError
    ]}
/>
{fieldErrors.titre_service && (
    <Text style={styles.errorText}>
        {fieldErrors.titre_service}
    </Text>
)}

// 5. Styles
const styles = StyleSheet.create({
    inputError: {
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    errorText: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 4,
        marginLeft: 4,
    },
});
```

### Test
1. Ouvrir formulaire création
2. Cliquer "Sauvegarder" sans remplir
3. Liste d'erreurs s'affiche
4. Remplir un champ obligatoire
5. Erreur disparaît en temps réel
6. Tous les champs remplis → confirmation
7. Sauvegarde réussie

---

## 🎯 OBJECTIF #10 : GESTION ERREURS

### Fichiers : Tous les appels API

### Pattern à Appliquer

```typescript
// PATTERN GÉNÉRIQUE pour tous les appels API

const makeApiCall = async (
    url: string,
    options: RequestInit,
    errorContext: string
) => {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            // Gestion des erreurs spécifiques
            switch (response.status) {
                case 400:
                    throw new Error(data.message || 'Requête invalide');
                case 401:
                    throw new Error('Session expirée. Veuillez vous reconnecter.');
                case 403:
                    throw new Error('Accès interdit');
                case 404:
                    throw new Error('Ressource introuvable');
                case 500:
                    throw new Error('Erreur serveur. Veuillez réessayer plus tard.');
                default:
                    throw new Error(data.message || `Erreur ${response.status}`);
            }
        }
        
        return data;
    } catch (error) {
        console.error(`[${errorContext}] Erreur:`, error);
        
        // Vérifier si erreur réseau
        if (error.message === 'Network request failed') {
            Alert.alert(
                '📡 Pas de connexion',
                'Vérifiez votre connexion Internet et réessayez.',
                [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Réessayer', onPress: () => makeApiCall(url, options, errorContext) },
                ]
            );
        }
        // Session expirée
        else if (error.message.includes('Session expirée')) {
            Alert.alert(
                '🔒 Session expirée',
                'Veuillez vous reconnecter.',
                [
                    {
                        text: 'Se reconnecter',
                        onPress: () => {
                            // Déconnexion et navigation vers Login
                            AsyncStorage.removeItem('token');
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        },
                    },
                ]
            );
        }
        // Autres erreurs
        else {
            Alert.alert(
                '❌ Erreur',
                error.message || 'Une erreur inattendue est survenue.',
                [
                    { text: 'Ok' },
                    { text: 'Signaler', onPress: () => reportError(error, errorContext) },
                ]
            );
        }
        
        throw error;
    }
};

// Exemple d'utilisation
const creerService = async () => {
    try {
        setLoading(true);
        
        const token = await AsyncStorage.getItem('token');
        const data = await makeApiCall(
            `${API_BASE_URL}/api/services`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            },
            'creerService'
        );
        
        // Succès
        Alert.alert('✅ Succès', 'Service créé avec succès');
        navigation.goBack();
    } catch (error) {
        // Erreur déjà gérée dans makeApiCall
    } finally {
        setLoading(false);
    }
};
```

### Créer un fichier utilitaire

**Fichier** : `mobile/src/utils/apiHelper.ts`

```typescript
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ApiCallOptions extends RequestInit {
    skipAuth?: boolean;
    customErrorHandler?: (error: any) => void;
}

export const apiCall = async (
    url: string,
    options: ApiCallOptions = {},
    errorContext: string = 'API Call'
): Promise<any> => {
    try {
        // Ajouter le token automatiquement si non skipAuth
        if (!options.skipAuth) {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }
            
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            };
        }
        
        // Ajouter Content-Type par défaut
        if (options.body && typeof options.body === 'object') {
            options.headers = {
                'Content-Type': 'application/json',
                ...options.headers,
            };
            options.body = JSON.stringify(options.body);
        }
        
        console.log(`[${errorContext}] ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            // Gestion des codes d'erreur
            const errorMessage = getErrorMessage(response.status, data);
            throw new Error(errorMessage);
        }
        
        return data;
    } catch (error) {
        console.error(`[${errorContext}] Erreur:`, error);
        
        // Utiliser custom error handler si fourni
        if (options.customErrorHandler) {
            options.customErrorHandler(error);
        } else {
            // Handler par défaut
            handleApiError(error, errorContext);
        }
        
        throw error;
    }
};

const getErrorMessage = (status: number, data: any): string => {
    const message = data?.message || data?.error || '';
    
    switch (status) {
        case 400:
            return message || 'Requête invalide. Vérifiez vos données.';
        case 401:
            return 'Session expirée. Veuillez vous reconnecter.';
        case 403:
            return 'Accès interdit. Vous n\'avez pas les permissions nécessaires.';
        case 404:
            return 'Ressource introuvable.';
        case 409:
            return message || 'Conflit. Cette ressource existe déjà.';
        case 429:
            return 'Trop de requêtes. Veuillez patienter quelques instants.';
        case 500:
            return 'Erreur serveur. Nos équipes ont été notifiées.';
        case 503:
            return 'Service temporairement indisponible. Veuillez réessayer.';
        default:
            return message || `Erreur ${status}`;
    }
};

const handleApiError = (error: any, context: string) => {
    const message = error.message || 'Erreur inattendue';
    
    // Erreur réseau
    if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
        Alert.alert(
            '📡 Pas de connexion',
            'Vérifiez votre connexion Internet et réessayez.',
            [{ text: 'Ok' }]
        );
    }
    // Session expirée
    else if (message.includes('Session expirée')) {
        Alert.alert(
            '🔒 Session expirée',
            'Veuillez vous reconnecter pour continuer.',
            [{ text: 'Ok' }]
        );
    }
    // Solde insuffisant
    else if (message.includes('Insufficient balance') || message.includes('Solde insuffisant')) {
        Alert.alert(
            '💳 Solde insuffisant',
            'Votre solde est insuffisant pour cette action. Rechargez votre compte.',
            [{ text: 'Ok' }]
        );
    }
    // Autres erreurs
    else {
        Alert.alert(
            '❌ Erreur',
            message,
            [{ text: 'Ok' }]
        );
    }
};

export default apiCall;
```

### Utilisation dans les fichiers

```typescript
// DANS ProductManagerMobile.tsx, FormulaireYukpoIntelligent, etc.

import apiCall from '../utils/apiHelper';

// Exemple : Ajout produit
const handleAddProduct = async () => {
    try {
        const data = await apiCall(
            `${API_BASE_URL}/api/services/${serviceId}/products`,
            {
                method: 'POST',
                body: productData,
            },
            'handleAddProduct'
        );
        
        Alert.alert('✅ Succès', `Produit ajouté. Coût : ${data.cost} FCFA`);
    } catch (error) {
        // Erreur déjà gérée dans apiCall
    }
};
```

---

## 📋 CHECKLIST FINALE

### Avant de commencer
- [ ] Backend déployé et testé
- [ ] Migrations SQL exécutées
- [ ] Token API valide
- [ ] Environnement de dev configuré

### Implémentation
- [ ] Objectif #3 : Modification produit (2h)
- [ ] Objectif #4 : Blocage suppression (30min)
- [ ] Objectif #5 : Désactivation produit (1h)
- [ ] Objectif #6 : Réactivation produit (1h)
- [ ] Objectif #9 : Validation formulaires (1h30)
- [ ] Objectif #10 : Gestion erreurs (2h)

### Tests
- [ ] Modifier un produit
- [ ] Tenter supprimer service avec 2+ produits
- [ ] Désactiver un produit
- [ ] Réactiver un produit
- [ ] Valider formulaire vide
- [ ] Tester erreurs réseau
- [ ] Tester solde insuffisant
- [ ] Tester session expirée

### Déploiement
- [ ] Compilation sans erreurs
- [ ] Tests E2E réussis
- [ ] Notifications fonctionnelles
- [ ] Logs propres
- [ ] Performance acceptable

---

## 🚀 ORDRE D'IMPLÉMENTATION RECOMMANDÉ

1. **Objectif #10** (Gestion erreurs) → Créer `apiHelper.ts` d'abord
2. **Objectif #9** (Validation) → Ajouter validations aux formulaires
3. **Objectif #3** (Modification) → Utiliser apiHelper
4. **Objectif #5** (Désactivation) → Utiliser apiHelper
5. **Objectif #6** (Réactivation) → Utiliser apiHelper
6. **Objectif #4** (Blocage suppression) → Simple condition

**Durée totale estimée** : 8-10 heures

---

## 📞 SUPPORT

Si un endpoint backend ne fonctionne pas :
1. Vérifier les logs backend : `cargo run`
2. Tester avec curl :
```bash
curl -X POST http://localhost:3000/api/services/123/products/0/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN"
```
3. Vérifier migrations : `sqlx migrate run`

---

**FRONTEND 100% APRÈS CE GUIDE** ✅  
*Bon courage ! 🎯*
