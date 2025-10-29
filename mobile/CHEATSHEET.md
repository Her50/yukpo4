# ⚡ CHEATSHEET - YUKPOMNANG

## 📋 ÉTAT ACTUEL
- ✅ Système modalités : COMPLET
- ✅ Phases 1 & 2 : TERMINÉES (13/46)
- ⏳ Phases 3-4-5 : À FAIRE (26/46)

## 🚀 POUR CONTINUER RAPIDEMENT

### 1. Ouvrir le fichier
```bash
code mobile/src/components/ProductManagerMobile.tsx
```

### 2. Chercher la catégorie
```bash
# Exemple : pharmacie
grep -n "case 'pharmacie'" mobile/src/components/ProductManagerMobile.tsx
```

### 3. Appliquer le template (2 champs/ligne)
```typescript
case 'categorie':
    return (
        <>
            <View style={styles.fieldRow}>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <ProductFieldSelector
                        label="Champ 1"
                        value={newProduct.champ1 || ''}
                        productType="categorie"
                        fieldName="champs1"
                        onSelect={(value) => setNewProduct({ ...newProduct, champ1: value })}
                        required
                    />
                </View>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                    <ProductFieldSelector
                        label="Champ 2"
                        value={newProduct.champ2 || ''}
                        productType="categorie"
                        fieldName="champs2"
                        onSelect={(value) => setNewProduct({ ...newProduct, champ2: value })}
                    />
                </View>
            </View>
        </>
    );
```

### 4. Ajouter les modalités
```bash
code mobile/src/data/productModalities.ts
```

```typescript
categorie: {
    champs1: ['Option 1', 'Option 2', 'Option 3'],
    champs2: ['Valeur A', 'Valeur B', 'Valeur C']
},
```

### 5. Tester
```bash
npx tsc --noEmit
```

## 📊 PHASE 3 (10 CATÉGORIES)

| Catégorie | Champs à compacter |
|-----------|-------------------|
| pharmacie | Type/Forme, Dosage/Labo |
| hopital | Type/Spécialité, Lits/Horaires |
| agroalimentaire | Type/Catégorie, Poids/Origine |
| demenagement | Type/Volume, Départ/Arrivée |
| coiffure | Type/Longueur, Cheveux/Durée |
| assurance | Type/Couverture, Prime/Franchise |
| restauration | Type/Spécialités, Capacité/Livraison |
| electronique | Catégorie/Marque, Modèle/État |
| musique | Type/Marque, État/Niveau |
| formation | Type/Domaine, Durée/Niveau |

## 📚 DOCS ESSENTIELLES

- **COMPRENDRE** → `RESUME_FINAL_POUR_UTILISATEUR.md`
- **DÉVELOPPER** → `QUICK_START_PHASES_3_4_5.md`
- **DÉTAILS** → `GUIDE_COMPLET_PHASES_3_4_5.md`
- **ARCHITECTURE** → `RECAP_COMPLET_SYSTEME_MODALITES.md`

## ⚡ COMMANDES UTILES

```bash
# Vérifier erreurs
npx tsc --noEmit

# Chercher un case
grep "case 'pharmacie'" mobile/src/components/ProductManagerMobile.tsx

# Voir modalités
grep -A 3 "pharmacie:" mobile/src/data/productModalities.ts

# Compter cases
grep -c "case '" mobile/src/components/ProductManagerMobile.tsx

# Lancer l'app
cd mobile && npm start
```

## ❌ ERREURS À ÉVITER

1. Mauvaise indentation → 308 erreurs
2. Oublier de fermer balises
3. ProductFieldSelector sans modalités
4. Modifier sans vérifier avec tsc

## ✅ CHECKLIST PAR CATÉGORIE

- [ ] Indentation correcte (4 espaces)
- [ ] 2 champs par ligne (styles.fieldRow)
- [ ] ProductFieldSelector au lieu de pickerButtons
- [ ] Modalités dans productModalities.ts
- [ ] Test : npx tsc --noEmit
- [ ] Formulaire s'affiche
- [ ] Recherche fonctionne

## 🎯 OBJECTIF

```
[████████████░░░░░░░░░░░░░░░░░░░░] 28%
13/46 catégories
```

**Finir** : 26 catégories en ~6h

---

**⏱️ TEMPS/CATÉGORIE** : 2 minutes  
**📚 GUIDE COMPLET** : `QUICK_START_PHASES_3_4_5.md`









