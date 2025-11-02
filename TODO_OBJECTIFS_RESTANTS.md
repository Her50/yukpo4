# 📋 TODO - Objectifs Restants à Implémenter

**Date** : 2025-11-01  
**Statut global** : 5/10 complétés (50%)

---

## ✅ OBJECTIFS COMPLÉTÉS (5/10)

- [x] **Objectif #1** : Duplication produit → Navigation vers FormulaireYukpoIntelligent
- [x] **Objectif #2** : État vide avec texte explicatif
- [x] **Objectif #3** : Bouton modification produit → Navigation vers FormulaireYukpoIntelligent
- [x] **Objectif #7** : Mode add_product détecté dans FormulaireYukpoIntelligent
- [x] **Objectif #8** : Nettoyage obsolète (19 846 lignes supprimées !)

---

## ❌ OBJECTIFS RESTANTS (5/10)

### 🔧 ProductManagerMobile.tsx (2 objectifs)

#### Objectif #5 : Désactivation produit
**Priorité** : Moyenne  
**Complexité** : Moyenne  
**Temps estimé** : 1h

**Fichier** : `mobile/src/components/ProductManagerMobile.tsx`

**Tâches** :
1. [ ] Ajouter champ `actif?: boolean` à l'interface `Product` (ligne 176)
2. [ ] Créer fonction `handleDeactivateProduct(productId, productIndex)`
3. [ ] Appel API `POST /api/services/{serviceId}/products/{productIndex}/deactivate`
4. [ ] Ajouter bouton "Désactiver" dans les actions produit (ligne 2133)
5. [ ] Afficher badge "Désactivé" si produit.actif === false

**Code à ajouter** :
```typescript
// 1. Dans l'interface Product (ligne 176)
interface Product {
    // ... champs existants
    actif?: boolean; // true = actif, false = désactivé
}

// 2. Fonction de désactivation (après handleDeleteProduct, ligne ~1945)
const handleDeactivateProduct = async (productId: string, productIndex: number) => {
    Alert.alert(
        'Désactiver le produit',
        'Le produit sera retiré temporairement de vos offres actives.\n\nVous pourrez le réactiver plus tard (coût: 1000 FCFA).\n\nUne notification automatique vous sera envoyée après 30 jours.',
        [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Désactiver',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await fetch(`${API_URL}/services/${serviceId}/products/${productIndex}/deactivate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        if (response.ok) {
                            Alert.alert('✅ Succès', 'Le produit a été désactivé');
                            // Recharger la liste des produits
                            // onRefresh?.();
                        } else {
                            throw new Error('Erreur serveur');
                        }
                    } catch (error) {
                        Alert.alert('❌ Erreur', 'Impossible de désactiver le produit. Réessayez.');
                    }
                }
            }
        ]
    );
};

// 3. Bouton dans les actions (ligne ~2133, après le bouton Supprimer)
{!readonly && product.actif !== false && (
    <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleDeactivateProduct(product.id, index)}
    >
        <SafeIcon name="eye-off" size={16} color={modernColors.warning} />
    </TouchableOpacity>
)}

// 4. Badge "Désactivé" (ligne ~2125, après le badge type)
{product.actif === false && (
    <View style={styles.deactivatedBadge}>
        <Text style={styles.deactivatedText}>🔒 Désactivé</Text>
    </View>
)}

// 5. Styles (ligne ~3750, avant le closing })
deactivatedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
},
deactivatedText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
},
```

---

#### Objectif #6 : Réactivation produit
**Priorité** : Moyenne  
**Complexité** : Moyenne  
**Temps estimé** : 1h

**Fichier** : `mobile/src/components/ProductManagerMobile.tsx`

**Tâches** :
1. [ ] Créer fonction `handleReactivateProduct(productId, productIndex)`
2. [ ] Calculer coût réactivation (1000 FCFA ou prorata)
3. [ ] Appel API `POST /api/services/{serviceId}/products/{productIndex}/reactivate`
4. [ ] Ajouter bouton "Réactiver" si produit désactivé

**Code à ajouter** :
```typescript
// 1. Fonction de réactivation (après handleDeactivateProduct)
const handleReactivateProduct = async (productId: string, productIndex: number) => {
    Alert.alert(
        'Réactiver le produit',
        'Coût de réactivation : 1000 FCFA\n\nCe montant sera déduit de votre solde de crédits.\n\nVoulez-vous continuer ?',
        [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Réactiver (1000 FCFA)',
                onPress: async () => {
                    try {
                        const response = await fetch(`${API_URL}/services/${serviceId}/products/${productIndex}/reactivate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            Alert.alert(
                                '✅ Produit réactivé', 
                                `Le produit est à nouveau actif.\n\nCoût : 1000 FCFA\nNouveau solde : ${data.nouveauSolde} FCFA`
                            );
                            // Recharger la liste
                            // onRefresh?.();
                        } else {
                            const error = await response.json();
                            throw new Error(error.message);
                        }
                    } catch (error) {
                        Alert.alert('❌ Erreur', error.message || 'Impossible de réactiver le produit');
                    }
                }
            }
        ]
    );
};

// 2. Bouton dans les actions (ligne ~2133, remplacer les autres boutons si désactivé)
{!readonly && product.actif === false && (
    <TouchableOpacity
        style={[styles.actionButton, styles.reactivateButton]}
        onPress={() => handleReactivateProduct(product.id, index)}
    >
        <SafeIcon name="eye" size={16} color="#FFFFFF" />
        <Text style={styles.reactivateText}>Réactiver</Text>
    </TouchableOpacity>
)}

// 3. Styles
reactivateButton: {
    backgroundColor: modernColors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
},
reactivateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
},
```

---

### 🔧 Autres fichiers (3 objectifs)

#### Objectif #4 : Blocage suppression service
**Priorité** : Basse  
**Complexité** : Facile  
**Temps estimé** : 30min

**Fichier** : À identifier (écran qui liste les services)

**Tâches** :
1. [ ] Trouver l'écran qui affiche la liste des services
2. [ ] Conditionner l'affichage du bouton "Supprimer service"
3. [ ] Afficher message si >= 2 produits

**Code à ajouter** :
```typescript
// Conditionner le bouton de suppression
{service.products?.length < 2 ? (
    <TouchableOpacity onPress={() => handleDeleteService(service.id)}>
        <Text>🗑️ Supprimer le service</Text>
    </TouchableOpacity>
) : (
    <View style={styles.warningBox}>
        <SafeIcon name="alert-triangle" size={16} color={modernColors.warning} />
        <Text style={styles.warningText}>
            Vous devez d'abord supprimer les produits individuellement avant de supprimer le service (minimum 1 produit).
        </Text>
    </View>
)}
```

---

#### Objectif #9 : Validation formulaires
**Priorité** : Haute  
**Complexité** : Moyenne  
**Temps estimé** : 2h

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Localisation** : Fonction `soumettreFormulaire` (ligne ~2750)

**Tâches** :
1. [ ] Identifier tous les champs obligatoires (marqués `*`)
2. [ ] Créer fonction de validation
3. [ ] Vérifier les champs avant soumission
4. [ ] Afficher erreurs claires

**Code à ajouter** :
```typescript
// Dans la fonction soumettreFormulaire (ligne ~2750)
const soumettreFormulaire = async () => {
    // ✅ VALIDATION : Vérifier les champs obligatoires
    const requiredFields = {
        'titre_service': 'Titre du service',
        'description_service': 'Description du service',
        'categorie_service': 'Catégorie du service',
        'prix_produit': 'Prix du produit',
        'nom_produit': 'Nom du produit'
    };
    
    const errors: string[] = [];
    
    for (const [fieldKey, fieldLabel] of Object.entries(requiredFields)) {
        const value = formData[fieldKey];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push(`• ${fieldLabel}`);
        }
    }
    
    if (errors.length > 0) {
        Alert.alert(
            '⚠️ Champs obligatoires manquants',
            `Les champs suivants sont requis :\n\n${errors.join('\n')}`,
            [{ text: 'OK' }]
        );
        return;
    }
    
    // Validation des nombres
    if (formData.prix_produit && isNaN(parseFloat(formData.prix_produit))) {
        Alert.alert('❌ Erreur', 'Le prix doit être un nombre valide');
        return;
    }
    
    // Si tout est OK, continuer la soumission...
    try {
        const response = await submitForm(formData);
        // ...
    } catch (error) {
        // Gérer erreur (voir Objectif #10)
    }
};
```

---

#### Objectif #10 : Gestion erreurs
**Priorité** : Haute  
**Complexité** : Facile  
**Temps estimé** : 1h

**Fichiers** : Tous les appels API

**Tâches** :
1. [ ] Identifier tous les appels API
2. [ ] Entourer de try/catch
3. [ ] Afficher messages d'erreur clairs
4. [ ] Proposer bouton "Réessayer"

**Code à ajouter** :
```typescript
// Template de gestion d'erreur réutilisable
const handleAPIError = (error: any, operation: string, retryFunction?: () => void) => {
    console.error(`[${operation}] Erreur:`, error);
    
    let message = 'Une erreur inattendue est survenue';
    
    if (error.response) {
        // Erreur HTTP avec réponse du serveur
        message = error.response.data?.message || 
                  error.response.data?.error || 
                  `Erreur ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
        // Pas de réponse du serveur
        message = 'Impossible de contacter le serveur. Vérifiez votre connexion internet.';
    } else {
        // Erreur de configuration
        message = error.message || 'Erreur de configuration de la requête';
    }
    
    const buttons = [{ text: 'OK' }];
    
    if (retryFunction) {
        buttons.push({
            text: '🔄 Réessayer',
            onPress: retryFunction
        });
    }
    
    Alert.alert(`❌ Erreur - ${operation}`, message, buttons);
};

// Exemple d'utilisation
const soumettreFormulaire = async () => {
    try {
        const response = await api.post('/services', formData);
        Alert.alert('✅ Succès', 'Service créé avec succès');
    } catch (error) {
        handleAPIError(error, 'Création du service', () => soumettreFormulaire());
    }
};

const handleDeleteProduct = async (productId: string) => {
    try {
        await api.delete(`/products/${productId}`);
        Alert.alert('✅ Succès', 'Produit supprimé');
    } catch (error) {
        handleAPIError(error, 'Suppression du produit');
    }
};
```

---

## 📊 RÉCAPITULATIF

| Objectif | Fichier | Priorité | Complexité | Temps | Statut |
|----------|---------|----------|------------|-------|--------|
| #1 Duplication | ProductManagerMobile.tsx | - | - | - | ✅ FAIT |
| #2 État vide | ProductManagerMobile.tsx | - | - | - | ✅ FAIT |
| #3 Modification | ProductManagerMobile.tsx | - | - | - | ✅ FAIT |
| #4 Blocage suppression | Écran services | Basse | Facile | 30min | ❌ À faire |
| #5 Désactivation | ProductManagerMobile.tsx | Moyenne | Moyenne | 1h | ❌ À faire |
| #6 Réactivation | ProductManagerMobile.tsx | Moyenne | Moyenne | 1h | ❌ À faire |
| #7 Mode add_product | FormulaireYukpoIntelligent | - | - | - | ✅ FAIT |
| #8 Nettoyage | ProductManagerMobile.tsx | - | - | - | ✅ FAIT |
| #9 Validation | FormulaireYukpoIntelligent | Haute | Moyenne | 2h | ❌ À faire |
| #10 Gestion erreurs | Tous les appels API | Haute | Facile | 1h | ❌ À faire |

**Temps total estimé pour terminer** : ~6h

---

## 🎯 ORDRE DE PRIORITÉ RECOMMANDÉ

### Phase 1 : Critique (Priorité Haute) - 3h
1. **Objectif #10** : Gestion erreurs (1h) → Améliore UX immédiatement
2. **Objectif #9** : Validation formulaires (2h) → Évite erreurs utilisateur

### Phase 2 : Important (Priorité Moyenne) - 2h
3. **Objectif #5** : Désactivation produit (1h) → Fonctionnalité demandée
4. **Objectif #6** : Réactivation produit (1h) → Complète #5

### Phase 3 : Optionnel (Priorité Basse) - 30min
5. **Objectif #4** : Blocage suppression service (30min) → Protection backend déjà en place

---

## 📝 NOTES

- Les objectifs #5 et #6 nécessitent que le backend ait les endpoints `/deactivate` et `/reactivate`
- L'objectif #4 nécessite d'identifier d'abord l'écran qui gère les services
- Les objectifs #9 et #10 améliorent significativement l'UX et doivent être priorisés

---

**Créé le** : 2025-11-01  
**Mis à jour le** : 2025-11-01


