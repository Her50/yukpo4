# Système Intelligent d'Affichage Adaptatif par Catégorie

## 📋 Vue d'ensemble

Ce document décrit le système intelligent mis en place pour **ResultatBesoinScreen** (mobile) et **ResultatBesoin** (frontend) qui adapte automatiquement l'affichage, les filtres, et la terminologie selon la catégorie de produit.

---

## ✅ Ce qui a été implémenté

### 🎯 1. Système de Configuration par Catégorie

#### Fichiers créés :
- `mobile/src/config/categoryConfig.ts`
- `frontend/src/config/categoryConfig.ts`

#### Fonctionnalités :
Chaque catégorie de produit dispose maintenant de :

1. **Terminologie adaptée** :
   - Labels personnalisés (ex: "Bien immobilier" pour immobilier, "Véhicule" pour automobile)
   - Messages d'état adaptés
   - Labels de tri personnalisés

2. **Filtres intelligents** :
   - Filtres spécifiques par catégorie
   - Types variés : range, select, multiselect, toggle, date, time
   - Unités et plages adaptées

3. **Styles personnalisés** :
   - Couleurs primaires par catégorie
   - Icônes emoji représentatives
   - Dégradés et couleurs d'accentuation

4. **Configuration comportementale** :
   - Méthodes de contact prioritaires (WhatsApp, téléphone, message)
   - Affichage de la distance et notation
   - Layout de carte (horizontal, vertical, grid)

#### Catégories configurées :
✅ Immobilier - Bâtiments (🏢)
✅ Immobilier - Terrains (🏞️)
✅ Automobile (🚗)
✅ Tickets de Voyage (🎫)
✅ Hôpital/Clinique (🏥)
✅ Pharmacie (💊)
✅ Prestation de Service (🎯)
✅ Chaussures (👟)
✅ Aliments (🍎)
✅ Configuration par défaut (📦)

---

### 📱 2. Composants Mobiles Améliorés

#### A. ProductCard avec WhatsApp (✅ Terminé)
**Fichier** : `mobile/src/components/ProductCard.tsx`

**Améliorations** :
- ✅ **Bouton WhatsApp principal** : Affiché en priorité si numéro disponible
- ✅ **Message pré-rempli** : "Bonjour, je suis intéressé(e) par [nom du produit]"
- ✅ **Indicateur de disponibilité** : Checkmark vert sur le bouton WhatsApp
- ✅ **Fallback intelligent** : Bouton chat si WhatsApp non disponible
- ✅ **Récupération du numéro** : Depuis service.data.whatsapp ou prestataire.whatsapp
- ✅ **Boutons secondaires** : Téléphone, galerie, partage adaptés à la catégorie
- ✅ **Styles dynamiques** : Couleurs basées sur la configuration de catégorie

#### B. CategoryFilters (✅ Terminé)
**Fichier** : `mobile/src/components/CategoryFilters.tsx`

**Fonctionnalités** :
- ✅ Modal de filtres adaptatifs
- ✅ Rendu dynamique selon le type de filtre
- ✅ Compteur de filtres actifs
- ✅ Styles personnalisés par catégorie
- ✅ Réinitialisation et application des filtres

#### C. ResultatBesoinScreen (✅ Terminé)
**Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx`

**Améliorations** :
- ✅ **Détection automatique** de la catégorie dominante
- ✅ **Terminologie adaptée** dans tout l'écran
- ✅ **Filtres avancés** par catégorie
- ✅ **Compteur de filtres** actifs avec badge
- ✅ **Tri intelligent** avec labels adaptés
- ✅ **Messages d'état** personnalisés (vide, chargement, erreur)
- ✅ **Styles dynamiques** selon la catégorie

---

### 💻 3. Composants Frontend

#### A. CategoryFilters (✅ Terminé)
**Fichier** : `frontend/src/components/CategoryFilters.tsx`

**Fonctionnalités** :
- ✅ Dialog modal pour filtres
- ✅ Composants UI réutilisables (shadcn/ui)
- ✅ Rendu adaptatif des filtres
- ✅ Compteur de filtres actifs
- ✅ Styles personnalisés par catégorie

---

## 🔨 Ce qui reste à implémenter

### 📱 Mobile

#### 1. Améliorer l'affichage des cartes produits par catégorie (TODO #6 équivalent mobile - déjà fait ✅)
Les cartes sont déjà adaptées avec :
- Détails spécifiques par type (renderProductDetails())
- WhatsApp intégré
- Styles dynamiques

### 💻 Frontend

#### 2. Améliorer les cartes produits avec WhatsApp (TODO #6)
**Fichier à modifier** : `frontend/src/components/ui/ProductManager.tsx` ou créer `frontend/src/components/ProductCard.tsx`

**Actions nécessaires** :
```typescript
// Ajouter dans ProductCard ou ProductManager
import { getCategoryConfig, getCategoryStyle } from '@/config/categoryConfig';

// Récupérer le numéro WhatsApp
const whatsappNumber = service.data?.whatsapp?.valeur || 
                       service.data?.whatsapp || 
                       prestataireInfo?.whatsapp;

// Ajouter bouton WhatsApp
<Button 
  onClick={() => openWhatsApp(whatsappNumber, productName)}
  style={{ backgroundColor: categoryStyle.primaryColor }}
>
  <MessageCircle className="w-4 h-4" />
  WhatsApp
</Button>

// Fonction pour ouvrir WhatsApp
const openWhatsApp = (number: string, productName: string) => {
  const phoneNumber = number.replace(/\s+/g, '').replace(/\+/g, '');
  const message = encodeURIComponent(`Bonjour, je suis intéressé(e) par ${productName}.`);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
  window.open(whatsappUrl, '_blank');
};
```

#### 3. Mettre à jour ResultatBesoin avec le système intelligent (TODO #8)
**Fichier à modifier** : `frontend/src/pages/ResultatBesoin.tsx`

**Actions nécessaires** :
```typescript
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '@/config/categoryConfig';
import { CategoryFilters } from '@/components/CategoryFilters';

// Dans le composant
const [categoryFilters, setCategoryFilters] = useState<Record<string, any>>({});
const [showCategoryFilters, setShowCategoryFilters] = useState(false);

// Détecter la catégorie dominante
const dominantCategory = useMemo(() => {
  if (products.length === 0) return 'default';
  const categoryCount: Record<string, number> = {};
  products.forEach((product) => {
    const category = product.type || 'default';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });
  let maxCount = 0;
  let dominant = 'default';
  Object.entries(categoryCount).forEach(([category, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominant = category;
    }
  });
  return dominant;
}, [products]);

const categoryConfig = getCategoryConfig(dominantCategory);
const categoryStyle = getCategoryStyle(dominantCategory);
const terminology = getCategoryTerminology(dominantCategory);

// Utiliser la terminologie dans le JSX
<h1>{terminology.productsLabel} correspondants</h1>
<Button onClick={() => setShowCategoryFilters(true)}>
  Filtres avancés {Object.keys(categoryFilters).length > 0 && `(${Object.keys(categoryFilters).length})`}
</Button>

// Ajouter le composant de filtres
<CategoryFilters
  category={dominantCategory}
  open={showCategoryFilters}
  onOpenChange={setShowCategoryFilters}
  onApply={(filters) => setCategoryFilters(filters)}
  initialFilters={categoryFilters}
/>
```

---

## 📊 Configuration des Catégories

### Exemple : Immobilier - Bâtiments

```typescript
immobilier_batiment: {
  terminology: {
    productLabel: 'Bien immobilier',
    productsLabel: 'Biens immobiliers',
    priceLabel: 'Prix/Loyer',
    locationLabel: 'Quartier',
    providerLabel: 'Propriétaire',
    searchPlaceholder: 'Rechercher un appartement, villa...',
    emptyMessage: 'Aucun bien immobilier trouvé dans cette zone',
    sortLabels: {
      relevance: 'Pertinence',
      price_asc: 'Prix croissant',
      price_desc: 'Prix décroissant',
      distance: 'Proximité',
    },
  },
  filters: [
    {
      id: 'typeTransaction',
      label: 'Type de transaction',
      type: 'select',
      options: [
        { value: 'vente', label: 'Vente' },
        { value: 'location', label: 'Location' },
      ],
    },
    // ... autres filtres
  ],
  style: {
    primaryColor: '#3B82F6',
    gradientColors: ['#3B82F6', '#1D4ED8'],
    icon: '🏢',
    badgeColor: '#EFF6FF',
    accentColor: '#2563EB',
  },
  displayPriority: ['superficie', 'nbPieces', 'quartier', 'prix'],
  contactMethods: ['whatsapp', 'phone', 'message'],
  showDistance: true,
  showRating: true,
  cardLayout: 'horizontal',
}
```

---

## 🎨 Exemples d'Affichage par Catégorie

### 🏢 Immobilier
- **Couleur** : Bleu (#3B82F6)
- **Filtres** : Type de transaction, nombre de pièces, superficie, équipements
- **Priorité d'affichage** : Superficie → Pièces → Quartier → Prix
- **Contact** : WhatsApp, Téléphone, Message

### 🚗 Automobile
- **Couleur** : Rouge (#EF4444)
- **Filtres** : Type de véhicule, marque, année, kilométrage, carburant
- **Priorité d'affichage** : Marque → Modèle → Année → Km → Prix
- **Contact** : WhatsApp, Téléphone, Message

### 🏥 Hôpital/Clinique
- **Couleur** : Rouge foncé (#DC2626)
- **Filtres** : Type d'établissement, spécialités, banque de sang, urgences 24h
- **Priorité d'affichage** : Type → Spécialités → Horaires → Services
- **Contact** : Téléphone, WhatsApp, Message (priorité téléphone pour urgences)

### 💊 Pharmacie
- **Couleur** : Vert (#059669)
- **Filtres** : Type de pharmacie, de garde, livraison, services
- **Priorité d'affichage** : Type → Garde → Horaires → Téléphone urgence
- **Contact** : Téléphone, WhatsApp (priorité téléphone)

---

## 🔧 Comment ajouter une nouvelle catégorie

1. **Ajouter la configuration** dans `categoryConfig.ts` :
```typescript
nouvelle_categorie: {
  terminology: { ... },
  filters: [ ... ],
  style: { ... },
  displayPriority: [ ... ],
  contactMethods: [ ... ],
  showDistance: true,
  showRating: true,
  cardLayout: 'horizontal',
}
```

2. **Les composants s'adapteront automatiquement** :
- Les filtres seront générés dynamiquement
- Les couleurs et styles seront appliqués
- La terminologie sera utilisée partout
- Les méthodes de contact seront priorisées

3. **Tester l'affichage** :
- Créer un produit avec le nouveau type
- Vérifier que les filtres s'affichent correctement
- Vérifier que la terminologie est adaptée
- Vérifier que le bouton WhatsApp fonctionne

---

## 📝 Notes importantes

### Mobile ✅
- ✅ Tous les composants sont implémentés
- ✅ Le bouton WhatsApp est fonctionnel
- ✅ Les filtres sont adaptatifs
- ✅ La terminologie est intelligente
- ✅ Les styles sont dynamiques

### Frontend ⚠️
- ✅ Configuration créée
- ✅ Composant de filtres créé
- ⚠️ À faire : Intégrer WhatsApp dans ProductCard/ProductManager
- ⚠️ À faire : Mettre à jour ResultatBesoin.tsx

---

## 🚀 Avantages du système

1. **Extensibilité** : Ajouter une catégorie = ajouter une configuration
2. **Maintenabilité** : Toute la logique est centralisée
3. **UX améliorée** : Terminologie et filtres adaptés à chaque domaine
4. **Contact facilité** : WhatsApp intégré avec message pré-rempli
5. **Cohérence** : Même logique sur mobile et frontend
6. **Performance** : Pas de requêtes supplémentaires, tout en configuration

---

## 📞 Fonctionnalité WhatsApp

### Comment ça marche

1. **Récupération du numéro** :
   ```typescript
   const whatsappNumber = service.data?.whatsapp?.valeur || 
                          service.data?.whatsapp || 
                          prestataire?.whatsapp || 
                          prestataire?.telephone;
   ```

2. **Génération du lien** :
   ```typescript
   const phoneNumber = whatsappNumber.replace(/\s+/g, '').replace(/\+/g, '');
   const message = encodeURIComponent(`Bonjour, je suis intéressé(e) par ${productName}.`);
   const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${message}`;
   ```

3. **Ouverture** :
   - Mobile : Ouvre l'application WhatsApp
   - Web : Ouvre WhatsApp Web ou Desktop

4. **Fallback** :
   - Si WhatsApp non disponible : affiche le bouton Chat
   - Si numéro non disponible : message d'erreur

---

## 🎯 État d'avancement

### Complété ✅
- [x] Système de configuration (mobile + frontend)
- [x] ProductCard avec WhatsApp (mobile)
- [x] CategoryFilters (mobile + frontend)
- [x] ResultatBesoinScreen adaptatif (mobile)

### En cours ⚠️
- [ ] ProductCard avec WhatsApp (frontend) - TODO #6
- [ ] ResultatBesoin adaptatif (frontend) - TODO #8

### Pourcentage d'avancement : **75%** (6/8 tâches complétées)

---

## 🔍 Pour tester

1. **Mobile** :
   ```bash
   cd mobile
   npm start
   # Naviguer vers ResultatBesoinScreen
   # Vérifier les filtres adaptatifs
   # Tester le bouton WhatsApp
   ```

2. **Frontend** :
   ```bash
   cd frontend
   npm run dev
   # Une fois TODO #6 et #8 complétés
   # Naviguer vers ResultatBesoin
   # Vérifier l'adaptation selon la catégorie
   ```

---

## 📚 Documentation des types

Voir les interfaces dans `categoryConfig.ts` :
- `CategoryFilter` : Configuration d'un filtre
- `CategoryTerminology` : Terminologie adaptée
- `CategoryStyle` : Styles personnalisés
- `CategoryConfig` : Configuration complète d'une catégorie

---

**Créé le** : 20 octobre 2025
**Dernière mise à jour** : 20 octobre 2025
**Version** : 1.0

