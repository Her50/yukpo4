# 📋 GUIDE COMPLET - OPTIMISATION COMPACITÉ PHASES 3-4-5

## 🎯 OBJECTIF GLOBAL

Optimiser **26 catégories restantes** dans `ProductManagerMobile.tsx` pour :
1. **Compacité UX** : 2 champs par ligne (quand possible)
2. **Modalités intelligentes** : Remplacer `pickerButtons` par `ProductFieldSelector`
3. **Cohérence** : Uniformiser avec Phases 1 & 2

## ✅ DÉJÀ RÉALISÉ (Phases 1 & 2)

### Phase 1 (5 catégories) ✅
- `immobilier_batiment` : Type/Statut, Superficie/Ameublement, Chambres/SDB, Quartier/Ville
- `immobilier_terrain` : Superficie/Prix par m², Quartier/Ville
- `ticket_voyage` : Ville départ/Ville arrivée, Date départ/Heure, Compagnie/Classe
- `hotellerie` : Type/Catégorie, Prix/Chambres, Équipements (multi), Adresse/Ville
- `covoiturage` : Départ/Arrivée, Date/Heure, Prix/Places

### Phase 2 (8 catégories) ✅
- `vetement` : Taille/Couleur, Genre/Marque
- `chaussure` : Type/Pointure, Couleur/Marque
- `electromenager` : Type/Marque, État/Garantie
- `mobilier` : Type/Matériau, Couleur/État
- `decoration` : Type/Style, Matériau/Couleur
- `aliments` : Type/Poids, Origine/Bio
- `quincaillerie` : Type/Marque, Matériau/Usage
- `livres` : Titre/Auteur, Genre/Langue, État/ISBN
- `cosmetique` : Type/Marque, Volume/Ingrédients
- `bijoux` : Type/Matériau, Pierre/Poids

## 🚀 PHASE 3 - Santé & Services (10 catégories)

### 3.1. `pharmacie`
**Champs actuels** : Nom médicament, Type, Forme, Dosage, Ordonnance requise, Laboratoire, Date expiration

**Optimisation** :
```typescript
case 'pharmacie':
    return (
        <>
            {/* Type et Forme sur la même ligne */}
            <View style={styles.fieldRow}>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <ProductFieldSelector
                        label="Type de produit"
                        value={newProduct.typeProduit || ''}
                        productType="pharmacie"
                        fieldName="types"
                        onSelect={(value) => setNewProduct({ ...newProduct, typeProduit: value })}
                        required
                    />
                </View>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <ProductFieldSelector
                        label="Forme"
                        value={newProduct.forme || ''}
                        productType="pharmacie"
                        fieldName="formes"
                        onSelect={(value) => setNewProduct({ ...newProduct, forme: value })}
                    />
                </View>
            </View>

            {/* Nom du médicament */}
            <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nom du médicament <Text style={styles.required}>*</Text></Text>
                <NativeInput
                    placeholder="Ex: Paracétamol"
                    value={newProduct.nomMedicament || ''}
                    onChangeText={(text) => setNewProduct({ ...newProduct, nomMedicament: text })}
                    style={styles.fieldInput}
                />
            </View>

            {/* Dosage et Laboratoire sur la même ligne */}
            <View style={styles.fieldRow}>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Dosage</Text>
                    <NativeInput
                        placeholder="Ex: 500mg"
                        value={newProduct.dosage || ''}
                        onChangeText={(text) => setNewProduct({ ...newProduct, dosage: text })}
                        style={styles.fieldInput}
                    />
                </View>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Laboratoire</Text>
                    <NativeInput
                        placeholder="Ex: Sanofi"
                        value={newProduct.laboratoire || ''}
                        onChangeText={(text) => setNewProduct({ ...newProduct, laboratoire: text })}
                        style={styles.fieldInput}
                    />
                </View>
            </View>

            {/* Ordonnance requise */}
            <View style={styles.fieldContainer}>
                <ProductFieldSelector
                    label="Ordonnance requise"
                    value={newProduct.ordonnanceRequise || ''}
                    productType="pharmacie"
                    fieldName="ordonnance"
                    onSelect={(value) => setNewProduct({ ...newProduct, ordonnanceRequise: value })}
                />
            </View>

            {/* Date d'expiration */}
            <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Date d'expiration</Text>
                <NativeInput
                    placeholder="Ex: 12/2025"
                    value={newProduct.dateExpiration || ''}
                    onChangeText={(text) => setNewProduct({ ...newProduct, dateExpiration: text })}
                    style={styles.fieldInput}
                />
            </View>
        </>
    );
```

### 3.2. `hopital`
**Champs** : Type de service, Spécialité, Équipements disponibles, Nombre de lits, Horaires

**Compacter** :
- Type/Spécialité (ligne 1)
- Équipements (multi-select, ligne seule)
- Nombre lits/Horaires (ligne 2)

### 3.3. `agroalimentaire`
**Champs** : Type produit, Catégorie, Poids/Volume, Origine, Bio, Date production, DLC

**Compacter** :
- Type/Catégorie (ligne 1)
- Poids/Origine (ligne 2)
- Bio/Date production (ligne 3)

### 3.4. `demenagement`
**Champs** : Type service, Volume, Distance, Adresse départ, Adresse arrivée, Date, Équipe

**Compacter** :
- Type service/Volume (ligne 1)
- Adresse départ/Adresse arrivée (ligne 2)
- Date/Distance (ligne 3)

### 3.5. `coiffure`
**Champs** : Type prestation, Longueur cheveux, Type cheveux, Durée, Prix

**Compacter** :
- Type prestation/Longueur (ligne 1)
- Type cheveux/Durée (ligne 2)

### 3.6. `assurance`
**Champs** : Type assurance, Couverture, Prime mensuelle, Franchise, Durée contrat

**Compacter** :
- Type/Couverture (ligne 1)
- Prime/Franchise (ligne 2)
- Durée contrat (ligne seule)

### 3.7. `restauration`
**Champs** : Type cuisine, Spécialités, Capacité, Adresse, Ville, Horaires, Livraison

**Compacter** :
- Type cuisine/Spécialités (ligne 1)
- Capacité/Livraison (ligne 2)
- Adresse/Ville (ligne 3)
- Horaires (ligne seule)

### 3.8. `electronique`
**Champs** : Catégorie, Marque, Modèle, État, Garantie, Année

**Compacter** :
- Catégorie/Marque (ligne 1)
- Modèle/État (ligne 2)
- Garantie/Année (ligne 3)

### 3.9. `musique`
**Champs** : Type instrument, Marque, État, Niveau, Accessoires

**Compacter** :
- Type/Marque (ligne 1)
- État/Niveau (ligne 2)
- Accessoires (multi-select, ligne seule)

### 3.10. `formation`
**Champs** : Type formation, Domaine, Durée, Niveau, Mode (présentiel/distance), Certificat

**Compacter** :
- Type/Domaine (ligne 1)
- Durée/Niveau (ligne 2)
- Mode/Certificat (ligne 3)

## 🌾 PHASE 4 - Agriculture & Loisirs (6 catégories)

### 4.1. `evenementiel`
**Champs** : Type événement, Capacité, Date, Lieu, Adresse, Ville, Équipements

**Compacter** :
- Type/Capacité (ligne 1)
- Date/Lieu (ligne 2)
- Adresse/Ville (ligne 3)
- Équipements (multi-select, ligne seule)

### 4.2. `agriculture`
**Champs** : Type produit, Catégorie, Quantité, Unité, Origine, Bio, Saison

**Compacter** :
- Type/Catégorie (ligne 1)
- Quantité/Unité (ligne 2)
- Origine/Bio (ligne 3)
- Saison (ligne seule)

### 4.3. `sport`
**Champs** : Type sport, Équipement, Taille, Marque, État, Niveau

**Compacter** :
- Type sport/Équipement (ligne 1)
- Taille/Marque (ligne 2)
- État/Niveau (ligne 3)

### 4.4. `bien_etre`
**Champs** : Type prestation, Durée, Zone traitée, Produits utilisés, Niveau

**Compacter** :
- Type/Durée (ligne 1)
- Zone/Produits (ligne 2)
- Niveau (ligne seule)

### 4.5. `animaux`
**Champs** : Type animal, Race, Âge, Sexe, Vaccins, Pedigree

**Compacter** :
- Type/Race (ligne 1)
- Âge/Sexe (ligne 2)
- Vaccins/Pedigree (ligne 3)

### 4.6. `nettoyage`
**Champs** : Type service, Surface, Fréquence, Produits, Équipement

**Compacter** :
- Type/Surface (ligne 1)
- Fréquence/Produits (ligne 2)
- Équipement (multi-select, ligne seule)

## 🔧 PHASE 5 - Métiers & Services (7 catégories)

### 5.1. `jardinage`
**Champs** : Type service, Surface, Fréquence, Équipement, Produits

**Compacter** :
- Type/Surface (ligne 1)
- Fréquence/Équipement (ligne 2)
- Produits (multi-select, ligne seule)

### 5.2. `securite`
**Champs** : Type service, Zone couverte, Équipement, Surveillance, Durée

**Compacter** :
- Type/Zone (ligne 1)
- Équipement/Surveillance (ligne 2)
- Durée (ligne seule)

### 5.3. `plomberie`
**Champs** : Type intervention, Urgence, Zone, Équipement, Garantie

**Compacter** :
- Type/Urgence (ligne 1)
- Zone/Équipement (ligne 2)
- Garantie (ligne seule)

### 5.4. `electricite`
**Champs** : Type intervention, Puissance, Norme, Équipement, Garantie, Urgence

**Compacter** :
- Type/Puissance (ligne 1)
- Norme/Équipement (ligne 2)
- Garantie/Urgence (ligne 3)

### 5.5. `menuiserie`
**Champs** : Type travaux, Matériau, Dimensions, Finition, Délai

**Compacter** :
- Type/Matériau (ligne 1)
- Dimensions/Finition (ligne 2)
- Délai (ligne seule)

### 5.6. `prestation_service`
**Champs** : Type prestation, Domaine, Durée, Expérience, Déplacement

**Compacter** :
- Type/Domaine (ligne 1)
- Durée/Expérience (ligne 2)
- Déplacement (ligne seule)

### 5.7. (Autres catégories génériques)
Pour toute autre catégorie non listée, appliquer le même principe :
- Grouper les champs liés sur la même ligne
- Utiliser `ProductFieldSelector` pour les listes
- Garder les champs texte libres en `NativeInput`

## 🛠️ PATTERN DE CODE STANDARD

### Template de base pour chaque case :
```typescript
case 'nom_categorie':
    return (
        <>
            {/* Commentaire descriptif */}
            <View style={styles.fieldRow}>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <ProductFieldSelector
                        label="Label du champ"
                        value={newProduct.champX || ''}
                        productType="nom_categorie"
                        fieldName="nom_du_field"
                        onSelect={(value) => setNewProduct({ ...newProduct, champX: value })}
                        required  // si obligatoire
                    />
                </View>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Autre champ <Text style={styles.required}>*</Text></Text>
                    <NativeInput
                        placeholder="Ex: valeur"
                        value={newProduct.champY || ''}
                        onChangeText={(text) => setNewProduct({ ...newProduct, champY: value })}
                        style={styles.fieldInput}
                        keyboardType="default"  // ou "numeric" pour les nombres
                    />
                </View>
            </View>
        </>
    );
```

## ✅ CHECKLIST AVANT DE COMMITER

Pour chaque catégorie modifiée :

1. **Indentation correcte** ✅
   - `case` au niveau du switch
   - `return` indenté de 4 espaces
   - `<>` indenté de 8 espaces
   - Contenu indenté de 12+ espaces

2. **Compacité** ✅
   - 2 champs par ligne quand possible
   - Utiliser `styles.fieldRow`
   - `flex: 1` sur chaque fieldContainer

3. **Modalités intelligentes** ✅
   - Remplacer `pickerButtons` par `ProductFieldSelector`
   - Vérifier que `productType` et `fieldName` existent dans `productModalities.ts`

4. **Cohérence** ✅
   - Labels clairs avec émojis si pertinent
   - Placeholders informatifs (Ex: ...)
   - Required `*` si obligatoire

5. **Test** ✅
   - Pas d'erreur linter
   - Formulaire s'affiche correctement
   - Modalités se chargent avec recherche

## 📊 MODALITÉS DANS `productModalities.ts`

Pour chaque catégorie, vérifier que les champs existent. Sinon, les ajouter :

```typescript
pharmacie: {
    types: ['Médicament', 'Complément alimentaire', 'Dispositif médical', 'Parapharmacie'],
    formes: ['Comprimé', 'Gélule', 'Sirop', 'Crème', 'Pommade', 'Injection', 'Suppositoire'],
    ordonnance: ['Oui', 'Non']
},
```

## 🎯 ORDRE D'EXÉCUTION RECOMMANDÉ

### Session 1 (Santé - 2 catégories)
1. `pharmacie`
2. `hopital`
**Test** : Vérifier que les modalités de pharmacie fonctionnent

### Session 2 (Services - 3 catégories)
3. `agroalimentaire`
4. `demenagement`
5. `coiffure`
**Test** : Vérifier la compacité

### Session 3 (Services suite - 5 catégories)
6. `assurance`
7. `restauration`
8. `electronique`
9. `musique`
10. `formation`
**Commit** : Phase 3 complète

### Session 4 (Agriculture & Loisirs - 6 catégories)
11. `evenementiel`
12. `agriculture`
13. `sport`
14. `bien_etre`
15. `animaux`
16. `nettoyage`
**Commit** : Phase 4 complète

### Session 5 (Métiers - 7 catégories)
17. `jardinage`
18. `securite`
19. `plomberie`
20. `electricite`
21. `menuiserie`
22. `prestation_service`
23. (Autres si nécessaire)
**Commit** : Phase 5 complète ✅

## 🚀 COMMANDES UTILES

### Vérifier les erreurs
```bash
npx tsc --noEmit --project mobile/tsconfig.json
```

### Tester sur mobile
```bash
cd mobile
npm start
```

### Vérifier les modalités disponibles
Rechercher dans `mobile/src/data/productModalities.ts` :
```bash
grep -A 5 "nom_categorie:" mobile/src/data/productModalities.ts
```

## 📝 NOTES IMPORTANTES

1. **NE PAS** modifier l'indentation globale - risque de tout casser
2. **TOUJOURS** tester après chaque catégorie
3. **COMMITER** après chaque phase (3, 4, 5)
4. **VÉRIFIER** que `ProductFieldSelector` est importé en haut du fichier
5. **S'ASSURER** que les modalités existent dans `productModalities.ts`

## 🎉 RÉSULTAT ATTENDU

Après les 3 phases :
- ✅ **46/46 catégories** optimisées
- ✅ **Compacité UX** sur tous les formulaires
- ✅ **Modalités intelligentes** avec recherche partout
- ✅ **0 erreur linter**
- ✅ **Expérience utilisateur uniforme**

---

**Ce guide est indexable et réutilisable dans n'importe quelle session de chat !**


