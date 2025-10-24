# 📋 Formulaires à créer - 15 catégories manquantes

## 🎯 Objectif

Créer les formulaires de produits pour les 15 catégories qui ont des modalités définies mais pas encore de formulaire.

---

## 📊 Liste des catégories manquantes

### 1. **restauration** (798:845)
**Modalités** :
- types_cuisine (12 options)
- specialites (15 options)
- services (8 options)
- ambiances (8 options)
- gammes_prix (5 options)
- certifications (6 options)
- options_alimentaires (8 options)
- capacites (6 options)
- jours_fermeture (8 options)

**Champs du formulaire** :
- Type de cuisine (select)
- Spécialités (multi-select)
- Services (multi-select)
- Ambiance (select)
- Gamme de prix (select)
- Capacité (number)
- Certifications (multi-select)
- Options alimentaires (multi-select)
- Jours de fermeture (multi-select)
- Horaires (text)

---

### 2. **electronique** (846:874)
**Modalités** :
- types (10 options)
- marques (15 options)
- etats (8 options)
- garanties (7 options)
- connectivites (10 options)

**Champs du formulaire** :
- Type d'appareil (select)
- Marque (select)
- Modèle (text)
- État (select)
- Garantie (select)
- Connectivités (multi-select)

---

### 3. **formation_education** (875:915)
**Modalités** :
- types (10 options)
- niveaux (12 options)
- matieres (30+ options)
- modes (5 options)
- durees (8 options)
- certifications (8 options)

**Champs du formulaire** :
- Type de formation (select)
- Niveau (select)
- Matières (multi-select)
- Mode (select)
- Durée (select)
- Certification (select)

---

### 4. **evenementiel** (916:944)
**Modalités** :
- types (12 options)
- services (15 options)
- capacites (6 options)
- tarifs (5 options)

**Champs du formulaire** :
- Type d'événement (select)
- Services inclus (multi-select)
- Capacité (number)
- Tarif (select)

---

### 5. **agriculture** (945:978)
**Modalités** :
- types (15 options)
- cultures (20 options)
- saisons (5 options)
- certifications (6 options)
- unites (8 options)

**Champs du formulaire** :
- Type de produit (select)
- Culture (select)
- Saison (select)
- Certifications (multi-select)
- Unité de vente (select)
- Quantité disponible (number)

---

### 6. **sport_fitness** (979:1013)
**Modalités** :
- types (15 options)
- niveaux (5 options)
- durees (8 options)
- equipements (12 options)

**Champs du formulaire** :
- Type d'activité (select)
- Niveau (select)
- Durée (select)
- Équipements fournis (multi-select)

---

### 7. **bien_etre_spa** (1014:1042)
**Modalités** :
- types (12 options)
- services (15 options)
- durees (8 options)
- tarifs (5 options)

**Champs du formulaire** :
- Type de service (select)
- Services (multi-select)
- Durée (select)
- Gamme tarifaire (select)

---

### 8. **animaux_veterinaire** (1043:1072)
**Modalités** :
- types (10 options)
- races (30+ options)
- ages (6 options)
- services (12 options)

**Champs du formulaire** :
- Type d'animal (select)
- Race (select)
- Âge (select)
- Services vétérinaires (multi-select)

---

### 9. **nettoyage_entretien** (1073:1101)
**Modalités** :
- types (10 options)
- frequences (6 options)
- surfaces (6 options)
- equipements (10 options)

**Champs du formulaire** :
- Type de service (select)
- Fréquence (select)
- Surface (select)
- Équipements (multi-select)

---

### 10. **jardinage_paysagisme** (1102:1129)
**Modalités** :
- types (12 options)
- saisons (5 options)
- surfaces (6 options)
- services (15 options)

**Champs du formulaire** :
- Type de service (select)
- Saison recommandée (select)
- Surface (select)
- Services inclus (multi-select)

---

### 11. **securite_surveillance** (1130:1157)
**Modalités** :
- types (10 options)
- zones (8 options)
- durees (7 options)
- equipements (12 options)

**Champs du formulaire** :
- Type de service (select)
- Zone à couvrir (select)
- Durée du contrat (select)
- Équipements (multi-select)

---

### 12. **plomberie** (1158:1179)
**Modalités** :
- types (12 options)
- urgences (3 options)
- materiaux (8 options)
- garanties (6 options)

**Champs du formulaire** :
- Type de service (select)
- Service d'urgence (select)
- Matériaux (multi-select)
- Garantie (select)

---

### 13. **electricite** (1180:1201)
**Modalités** :
- types (12 options)
- puissances (8 options)
- certifications (6 options)
- garanties (6 options)

**Champs du formulaire** :
- Type de service (select)
- Puissance (select)
- Certifications (multi-select)
- Garantie (select)

---

### 14. **menuiserie** (1202:1228)
**Modalités** :
- types (12 options)
- bois (10 options)
- finitions (8 options)
- styles (8 options)

**Champs du formulaire** :
- Type de produit/service (select)
- Type de bois (select)
- Finition (select)
- Style (select)
- Dimensions (text)

---

### 15. **musique_instruments** (1229:1254)
**Modalités** :
- types (15 options)
- marques (20 options)
- etats (8 options)
- niveaux (4 options)

**Champs du formulaire** :
- Type d'instrument (select)
- Marque (select)
- Modèle (text)
- État (select)
- Niveau (select)

---

## 🎯 Template de formulaire

```typescript
case 'nom_categorie':
    return (
        <>
            <ProductFieldSelector
                label="Label du champ"
                fieldName="nom_champ"
                productType="nom_categorie"
                value={newProduct.nomChamp || ''}
                onSelect={(value) => setNewProduct({ ...newProduct, nomChamp: value })}
                required
            />
            
            {/* Champ texte */}
            <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Label</Text>
                <NativeInput
                    placeholder="Ex: ..."
                    value={newProduct.field || ''}
                    onChangeText={(text) => setNewProduct({ ...newProduct, field: text })}
                    style={styles.fieldInput}
                />
            </View>
            
            {/* Champ nombre */}
            <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Label</Text>
                <NativeInput
                    placeholder="Ex: 100"
                    value={newProduct.field || ''}
                    onChangeText={(text) => setNewProduct({ ...newProduct, field: text })}
                    keyboardType="numeric"
                    style={styles.fieldInput}
                />
            </View>
        </>
    );
```

---

## ✅ Ordre de création

1. [ ] restauration
2. [ ] electronique
3. [ ] formation_education
4. [ ] evenementiel
5. [ ] agriculture
6. [ ] sport_fitness
7. [ ] bien_etre_spa
8. [ ] animaux_veterinaire
9. [ ] nettoyage_entretien
10. [ ] jardinage_paysagisme
11. [ ] securite_surveillance
12. [ ] plomberie
13. [ ] electricite
14. [ ] menuiserie
15. [ ] musique_instruments
