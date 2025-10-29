# 🌍 Mots-clés Locaux Africains - Yukpomnang

## 📋 Vue d'ensemble

Ce document liste tous les **mots-clés locaux africains** intégrés dans Yukpomnang pour faciliter la recherche et l'accès aux catégories par les utilisateurs d'Afrique francophone.

---

## ✅ Catégories avec Mots-clés Intégrés

### 👕 **VÊTEMENT & PRÊT-À-PORTER**

#### **Friperie & Seconde Main** (Cameroun & Afrique francophone)
- `friperie`, `fripe` - Terme général Afrique francophone
- `dead stock`, `dead-stock`, `deadstock` - Vêtements neufs invendus
- `seconde main`, `deuxième main`, `occasion`, `used`
- `okrika` - Friperie au Nigeria (terme très populaire)
- `bend skin`, `bendskin` - Friperie au Cameroun
- `kaki benda`, `kakibenda` - Friperie au Cameroun
- `mitumba`, `boutique mitumba`, `marché mitumba` - Friperie en Afrique de l'Est

#### **Marchés Populaires**
- **Cameroun** : `marché mokolo`, `mokolo`
- **Sénégal** : `sandaga`, `marché sandaga`
- **Côte d'Ivoire** : `adjamé`, `marché adjamé`, `treichville`, `cocody`
- **Nigeria** : `lagos market`
- **Bénin** : `cotonou market`

#### **Mode Africaine**
- **Tissus** : `wax`, `pagne`, `bazin`, `bogolan`, `kente`, `ankara`
- **Tenues traditionnelles** : `boubou`, `kaftan`, `dashiki`, `agbada`, `kaba`
- **Styles** : `tenue africaine`, `mode africaine`, `african fashion`, `afro-fusion`, `afro wear`, `african wear`

#### **Termes Locaux par Pays**
- **Cameroun** : `ndole fashion`, `makossa style`, `bikutsi look`, `bamiléké outfit`, `bassa dress`
- **Côte d'Ivoire** : `wêwê`, `gbagba`, `brouteur style`, `zouglou fashion`
- **Sénégal** : `thiès fashion`, `dakar style`, `teranga wear`
- **Congo** : `congolaise`, `sapeur`, `sape`, `la sape`, `kinshasa fashion`, `brazzaville style`

#### **Occasions Spéciales**
- `tenue de mariage`, `tenue de cérémonie`, `tenue de baptême`
- `tenue de soirée`, `tenue de gala`, `tenue de fête`

#### **Marques Locales Africaines**
- **Tissus** : `vlisco`, `uniwax`, `abc wax`, `gtp`, `woodin`
- **Marques** : `amsik` (Cameroun), `alios` (Côte d'Ivoire), `modahnik` (Cameroun)

---

### 👟 **CHAUSSURES**

#### **Friperie & Seconde Main**
- `friperie chaussures`, `fripe chaussures`
- `dead stock shoes` - Chaussures neuves invendues
- `chaussures occasion`, `chaussures seconde main`
- `okrika shoes` - Nigeria
- `bend skin shoes`, `bendskin shoes` - Cameroun
- `mitumba shoes`, `kaki benda shoes` - Afrique de l'Est/Cameroun

#### **Types Populaires**
- **Sport** : `basket`, `baskets`, `tennis`, `running`, `sneaker`, `sneakers`
- **Femme** : `escarpin`, `escarpins`, `talon`, `talons`, `ballerine`, `ballerines`
- **Décontracté** : `sandale`, `sandales`, `tong`, `tongs`, `claquette`, `claquettes`
- **Hiver** : `botte`, `bottes`, `bottine`, `bottines`
- **Ville** : `mocassin`, `mocassins`, `derby`, `richelieu`
- **Maison** : `charentaise`, `pantoufle`, `chausson`, `nu-pied`, `nu-pieds`

#### **Marques Populaires**
- **Sport** : `nike`, `adidas`, `puma`, `reebok`, `new balance`, `converse`, `vans`
- **Premium** : `jordan`, `air max`, `yeezy`
- **Travail** : `timberland`, `caterpillar`, `clarks`

#### **Marchés Populaires**
- **Cameroun** : `mokolo chaussures`
- **Sénégal** : `sandaga chaussures`, `dakar shoes`
- **Côte d'Ivoire** : `adjamé chaussures`, `treichville chaussures`, `cocody shoes`

#### **Termes Locaux**
- **Cameroun** : `makossa shoes`, `ndolé style shoes`
- **Sénégal** : `sandaga shoes`
- **Côte d'Ivoire** : `adjamé shoes`

#### **Usage & Occasions**
- `chaussures de sport`, `chaussures de ville`
- `chaussures de mariage`, `chaussures de soirée`
- `chaussures de football`, `chaussures de basket`
- `chaussures de course`, `chaussures de trail`

---

## 🎯 Comment Ça Marche ?

### **1. Recherche Intelligente**
Les utilisateurs peuvent taper n'importe quel mot-clé local et Yukpomnang trouvera automatiquement la catégorie correspondante :

```typescript
// Exemple : recherche "friperie" → trouve "vetement"
const category = findCategoryByKeyword("friperie");
// Retourne: "vetement"

// Exemple : recherche "okrika" → trouve "vetement"
const category2 = findCategoryByKeyword("okrika");
// Retourne: "vetement"

// Exemple : recherche "bend skin" → trouve "vetement"
const category3 = findCategoryByKeyword("bend skin");
// Retourne: "vetement"
```

### **2. Accès Direct aux Catégories**
- Un utilisateur cherche "**friperie**" → Yukpomnang le dirige vers **Vêtements**
- Un utilisateur cherche "**okrika shoes**" → Yukpomnang le dirige vers **Chaussures**
- Un utilisateur cherche "**bazin**" → Yukpomnang le dirige vers **Vêtements**

### **3. Fonctions Utilitaires**

#### **findCategoryByKeyword(keyword: string)**
Trouve la catégorie correspondant à un mot-clé :
```typescript
findCategoryByKeyword("friperie") // → "vetement"
findCategoryByKeyword("okrika") // → "vetement"
findCategoryByKeyword("mitumba") // → "vetement"
findCategoryByKeyword("dead stock") // → "vetement"
```

#### **getCategoryKeywords(category: string)**
Obtient tous les mots-clés d'une catégorie :
```typescript
getCategoryKeywords("vetement")
// → ["friperie", "fripe", "okrika", "bend skin", ...]

getCategoryKeywords("chaussure")
// → ["basket", "escarpin", "okrika shoes", ...]
```

---

## 📈 Impact & Bénéfices

### **Pour les Utilisateurs**
✅ **Recherche naturelle** : Ils peuvent chercher avec leurs propres mots
✅ **Accès rapide** : Plus besoin de naviguer dans les menus
✅ **Contextualisation locale** : Yukpomnang "parle leur langue"
✅ **Découverte facilitée** : Trouvent facilement ce qu'ils cherchent

### **Pour Yukpomnang**
✅ **Différenciation** : Seul marketplace avec contextualisation africaine
✅ **Engagement** : Utilisateurs trouvent plus facilement ce qu'ils cherchent
✅ **Conversion** : Moins d'abandon grâce à la recherche facilitée
✅ **SEO local** : Meilleur référencement sur les termes locaux

### **Exemples d'Utilisation**

#### **Scénario 1 : Recherche Friperie**
- **Utilisateur** : Tape "friperie" dans la recherche
- **Yukpomnang** : Détecte le mot-clé et affiche tous les vêtements d'occasion
- **Résultat** : Accès direct aux vêtements seconde main

#### **Scénario 2 : Recherche Okrika**
- **Utilisateur** : Tape "okrika" (terme nigérian très populaire)
- **Yukpomnang** : Reconnaît le terme et affiche vêtements + chaussures occasion
- **Résultat** : Utilisateur trouve rapidement ce qu'il cherche

#### **Scénario 3 : Recherche Bazin**
- **Utilisateur** : Tape "bazin" (tissu malien très recherché)
- **Yukpomnang** : Dirige vers vêtements africains en bazin
- **Résultat** : Découverte de tenues traditionnelles

---

## 🚀 Prochaines Étapes

### **Catégories à Enrichir**

#### **🏠 Immobilier**
- `studio`, `chambre salon`, `appartement meublé`
- `mini cité`, `duplex`, `villa basse`
- Marchés : `bastos`, `akwa`, `bonanjo`, `makepe`

#### **🚗 Automobile**
- `voiture occasion`, `auto occasion`, `véhicule d'occasion`
- `toyota yaris`, `honda civic`, `nissan almera`
- `casse auto`, `pièces détachées`, `garage`
- Termes locaux : `convoyage`, `arrivage`, `direct japon`

#### **📱 Téléphone & Électronique**
- `phone occasion`, `portable occasion`, `smartphone occasion`
- `iphone`, `samsung`, `tecno`, `infinix`, `itel`
- Marchés : `marché mokolo`, `sandaga tech`

#### **🍴 Restauration**
- `ndolé`, `poulet DG`, `koki`, `eru`, `achu`
- `attiéké`, `aloko`, `garba`, `tchep`
- `thiéboudienne`, `mafé`, `yassa`
- `poulet braisé`, `soya`, `brochettes`

#### **🎵 Événementiel**
- `makossa`, `bikutsi`, `ndombolo`, `coupé-décalé`
- `dj mariage`, `sonorisation`, `animation`
- `deuil`, `anniversaire`, `baptême`

---

## 📊 Statistiques d'Usage

### **Mots-clés les Plus Populaires** (à suivre)
1. `friperie` - Recherché partout en Afrique francophone
2. `okrika` - Très populaire (Nigeria + diaspora)
3. `bend skin` - Spécifique Cameroun
4. `mitumba` - Afrique de l'Est
5. `wax`, `pagne`, `bazin` - Mode africaine

### **Termes par Pays**
- **Cameroun** : `friperie`, `bend skin`, `kaki benda`, `mokolo`
- **Nigeria** : `okrika`, `lagos market`
- **Sénégal** : `sandaga`, `thiès`, `dakar`
- **Côte d'Ivoire** : `adjamé`, `treichville`, `cocody`
- **RDC/Congo** : `la sape`, `sapeur`, `kinshasa`

---

## 🔧 Maintenance & Évolution

### **Ajout de Nouveaux Mots-clés**
1. Analyser les recherches utilisateurs
2. Identifier les termes locaux non couverts
3. Ajouter dans `categoryConfig.ts` → `searchKeywords`
4. Tester avec `findCategoryByKeyword()`

### **Surveillance**
- Suivre les recherches infructueuses
- Identifier les nouveaux termes populaires
- Adapter aux évolutions linguistiques locales

---

## 📝 Notes Techniques

### **Fichiers Modifiés**
- `mobile/src/config/categoryConfig.ts` - Configuration principale
  - Interface `CategoryConfig` enrichie avec `searchKeywords?: string[]`
  - Fonction `findCategoryByKeyword(keyword: string)`
  - Fonction `getCategoryKeywords(category: string)`

### **Structure des Mots-clés**
```typescript
interface CategoryConfig {
  // ... autres propriétés
  searchKeywords?: string[]; // ✅ NOUVEAU
}
```

### **Algorithme de Recherche**
1. Normalisation du mot-clé (lowercase, trim)
2. Parcours de toutes les catégories
3. Recherche dans les `searchKeywords` de chaque catégorie
4. Match exact OU inclusion (pour flexibilité)
5. Retour de la première catégorie trouvée

---

## ✨ Conclusion

L'intégration des **mots-clés locaux africains** dans Yukpomnang permet :

✅ **Accessibilité** : Recherche naturelle avec les termes locaux
✅ **Contextualisation** : Adaptation parfaite au marché africain
✅ **Différenciation** : Yukpomnang comprend le langage des utilisateurs
✅ **Performance** : Conversion améliorée grâce à l'UX facilitée

**Yukpomnang** est maintenant le **premier marketplace africain** à intégrer nativement les termes locaux populaires dans sa recherche ! 🌍🚀

---

**Dernière mise à jour** : 27 octobre 2025
**Version** : 1.0
**Catégories enrichies** : Vêtement, Chaussure

