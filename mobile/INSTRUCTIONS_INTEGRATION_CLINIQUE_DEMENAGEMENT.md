# Instructions d'intégration - Clinique/Hôpital et Déménagement

## Modifications à apporter dans `ProductManagerMobile.tsx`

### 1. ✅ DÉJÀ FAIT
- [x] Ajout de 'demenagement' au type ProductType (ligne 60)
- [x] Ajout des nouveaux champs dans l'interface Product (lignes 281-297)
- [x] Ajout de déménagement dans PRODUCT_TYPES (ligne 327)
- [x] Mise à jour des templates Excel (lignes 466-472)
- [x] Mise à jour des placeholders (ligne 536)
- [x] Mise à jour de l'import Excel pour hopital_clinique (lignes 943-953)
- [x] Ajout de l'import Excel pour demenagement (lignes 955-970)

### 2. ⚠️ À FAIRE MANUELLEMENT

#### A. Remplacer le formulaire hopital_clinique (lignes 2456-2552)
Remplacer tout le bloc `case 'hopital_clinique':` par le contenu du fichier:
`mobile/src/components/_temp_hopital_form.txt`

#### B. Ajouter le formulaire demenagement
Juste AVANT `case 'assurance':` (ligne 2554), insérer le contenu du fichier:
`mobile/src/components/_temp_demenagement_form.txt`

#### C. Ajouter les styles manquants
À la fin de la section `const styles = StyleSheet.create({` (après la ligne 3900 environ), ajouter :

```typescript
    // Styles pour listes à cocher
    checkboxList: {
        maxHeight: 300,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        marginTop: 8,
    },
    checkboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    
    // Styles pour planning hebdomadaire
    planningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    planningJour: {
        width: 80,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    planningInputs: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    planningInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    planningDivider: {
        fontSize: 14,
        color: modernColors.textSecondary,
        paddingHorizontal: 4,
    },
    checkboxSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    checkboxLabelSmall: {
        fontSize: 12,
        color: modernColors.text,
    },
```

## Modifications à apporter dans `ResultatBesoinScreen.tsx`

### Affichage spécifique pour hopital_clinique

Chercher la section d'affichage des produits et ajouter un cas spécifique pour `hopital_clinique`:

```typescript
{product.type === 'hopital_clinique' && (
    <View style={styles.productSpecifics}>
        <Text style={styles.productSpecificsTitle}>🏥 Informations médicales</Text>
        
        {product.typeEtablissement && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Type:</Text>
                <Text style={styles.specificValue}>{product.typeEtablissement}</Text>
            </View>
        )}
        
        {product.banqueSang && (
            <View style={styles.badgeContainer}>
                <Text style={styles.badge}>🩸 Banque de sang disponible</Text>
            </View>
        )}
        
        {product.prestationsMedicales && product.prestationsMedicales.length > 0 && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Prestations:</Text>
                <Text style={styles.specificValue}>
                    {product.prestationsMedicales.join(', ')}
                </Text>
            </View>
        )}
        
        {product.planningHebdomadaire && (
            <View style={styles.planningSection}>
                <Text style={styles.specificLabel}>Horaires d'ouverture:</Text>
                {Object.entries(product.planningHebdomadaire).map(([jour, horaires]) => (
                    <Text key={jour} style={styles.planningText}>
                        {jour}: {horaires.permanent ? '24h/24' : `${horaires.debut} - ${horaires.fin}`}
                    </Text>
                ))}
            </View>
        )}
        
        {product.rdvEnLigne && (
            <View style={styles.badgeContainer}>
                <Text style={styles.badgeSuccess}>📅 RDV en ligne disponible</Text>
            </View>
        )}
    </View>
)}
```

### Affichage spécifique pour demenagement

```typescript
{product.type === 'demenagement' && (
    <View style={styles.productSpecifics}>
        <Text style={styles.productSpecificsTitle}>📦 Détails du déménagement</Text>
        
        {product.typeDemenagement && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Type:</Text>
                <Text style={styles.specificValue}>{product.typeDemenagement}</Text>
            </View>
        )}
        
        {product.volumeEstime && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Volume max:</Text>
                <Text style={styles.specificValue}>{product.volumeEstime} m³</Text>
            </View>
        )}
        
        {product.typeVehicule && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Véhicule:</Text>
                <Text style={styles.specificValue}>{product.typeVehicule}</Text>
            </View>
        )}
        
        {product.nbDemenageurs && (
            <View style={styles.specificRow}>
                <Text style={styles.specificLabel}>Déménageurs:</Text>
                <Text style={styles.specificValue}>{product.nbDemenageurs}</Text>
            </View>
        )}
        
        <View style={styles.servicesContainer}>
            <Text style={styles.specificLabel}>Services inclus:</Text>
            {product.assuranceMarchandise && <Text style={styles.serviceItem}>✓ Assurance marchandise</Text>}
            {product.serviceManutention && <Text style={styles.serviceItem}>✓ Manutention</Text>}
            {product.montageDemontage && <Text style={styles.serviceItem}>✓ Montage/Démontage</Text>}
            {product.emballageCartons && <Text style={styles.serviceItem}>✓ Emballage fourni</Text>}
            {product.gardeMeuble && <Text style={styles.serviceItem}>✓ Garde-meuble</Text>}
            {product.debarras && <Text style={styles.serviceItem}>✓ Débarras</Text>}
        </View>
    </View>
)}
```

## ✅ Prochaines étapes

1. [ ] Appliquer les modifications ci-dessus dans ProductManagerMobile.tsx
2. [ ] Appliquer les modifications dans ResultatBesoinScreen.tsx  
3. [ ] Faire la même chose côté frontend (ProductManager.tsx et ResultatBesoin)
4. [ ] Tester l'import Excel pour les deux catégories
5. [ ] Vérifier l'affichage dans ResultatBesoinScreen

## Aide

Les fichiers temporaires contiennent les formulaires complets :
- `mobile/src/components/_temp_hopital_form.txt` - Nouveau formulaire clinique/hôpital
- `mobile/src/components/_temp_demenagement_form.txt` - Nouveau formulaire déménagement

Copiez-collez simplement leur contenu aux emplacements indiqués ci-dessus.

