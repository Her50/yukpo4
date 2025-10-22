# 📊 SYSTÈME DE RECOMMANDATION - Produits & Publicités

**Date**: 22 Octobre 2025  
**Objectif**: Afficher produits organiques + publicités dans HomeScreen

---

## 🎯 **ÉTAT ACTUEL**

### **HomeScreen - Actuellement**
```typescript
<ScrollView>
  <PublicitesCarousel 
    userId={user?.id}
    userBehavior={userBehaviorCategories}
  />
</ScrollView>
```

**Problème** :
- ✅ Publicités affichées avec comportement utilisateur
- ❌ **Aucun produit organique** n'est affiché
- ❌ Pas de recommandations basées sur le comportement

---

## 🔄 **SYSTÈME PROPOSÉ**

### **1. Architecture**

```
HomeScreen
  ├─ PublicitesCarousel (toutes les 3 produits)
  ├─ ProduitsRecommandes (basé sur comportement)
  └─ Alternance intelligente
```

### **2. Logique de Fréquence**

#### **A. Ratio Publicité/Produits**
```typescript
// Configuration
const RATIO_CONFIG = {
  publiciteFrequency: 3, // 1 publicité toutes les 3 cartes
  maxPublicites: 5,      // Max 5 publicités dans le scroll
  maxProduits: 15        // Max 15 produits organiques
};

// Exemple de scroll
[Produit 1] 
[Produit 2]
[Produit 3]
[PUBLICITÉ 1] ⭐
[Produit 4]
[Produit 5]
[Produit 6]
[PUBLICITÉ 2] ⭐
[Produit 7]
...
```

#### **B. Algorithme de Mélange**
```typescript
function mixPublicitesEtProduits(
  publicites: Publicite[],
  produits: Produit[],
  frequency: number = 3
): (Publicite | Produit)[] {
  const result: any[] = [];
  let pubIndex = 0;
  
  produits.forEach((produit, index) => {
    result.push({ type: 'produit', data: produit });
    
    // Insérer publicité tous les X produits
    if ((index + 1) % frequency === 0 && pubIndex < publicites.length) {
      result.push({ 
        type: 'publicite', 
        data: publicites[pubIndex],
        isPaid: true 
      });
      pubIndex++;
    }
  });
  
  return result;
}
```

---

## 🎨 **IMPLÉMENTATION**

### **1. Nouveau Composant: ProduitsRecommandes.tsx**

```typescript
interface ProduitsRecommandesProps {
  userId?: string;
  userBehavior?: string[];
  maxItems?: number;
}

const ProduitsRecommandes: React.FC<ProduitsRecommandesProps> = ({
  userId,
  userBehavior = [],
  maxItems = 15
}) => {
  const [produits, setProduits] = useState<any[]>([]);
  
  useEffect(() => {
    loadProduitsRecommandes();
  }, [userId, userBehavior]);
  
  const loadProduitsRecommandes = async () => {
    try {
      // Appel API pour produits recommandés
      const params = new URLSearchParams();
      if (userBehavior.length > 0) {
        params.append('categories', userBehavior.join(','));
      }
      params.append('limit', maxItems.toString());
      
      const response = await apiGet(`/api/produits/recommandes?${params}`);
      
      if (response.success && response.data) {
        // Trier par pertinence
        const sorted = response.data.sort((a, b) => {
          const scoreA = calculateRelevanceScore(a, userBehavior);
          const scoreB = calculateRelevanceScore(b, userBehavior);
          return scoreB - scoreA;
        });
        
        setProduits(sorted);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  };
  
  const calculateRelevanceScore = (produit: any, behavior: string[]): number => {
    let score = 0;
    
    // +10 si catégorie correspond
    if (behavior.includes(produit.type)) {
      score += 10;
    }
    
    // +5 si en promotion
    if (produit.en_promotion) {
      score += 5;
    }
    
    // +3 si récent (< 7 jours)
    const daysSinceCreation = getDaysSince(produit.created_at);
    if (daysSinceCreation < 7) {
      score += 3;
    }
    
    // +2 si bien noté
    if (produit.rating && produit.rating >= 4) {
      score += 2;
    }
    
    return score;
  };
  
  return (
    <View>
      {produits.map((produit, index) => (
        <ProductCard key={produit.id} product={produit} />
      ))}
    </View>
  );
};
```

### **2. Composant Mixte: MixedContentCarousel.tsx**

```typescript
interface MixedContentCarouselProps {
  userId?: string;
  userBehavior?: string[];
  publiciteFrequency?: number; // Tous les X produits
}

const MixedContentCarousel: React.FC<MixedContentCarouselProps> = ({
  userId,
  userBehavior = [],
  publiciteFrequency = 3
}) => {
  const [mixedContent, setMixedContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadMixedContent();
  }, [userId, userBehavior]);
  
  const loadMixedContent = async () => {
    try {
      setLoading(true);
      
      // Charger publicités ET produits en parallèle
      const [pubsResponse, produitsResponse] = await Promise.all([
        apiGet(`/api/publicites/actives?categories=${userBehavior.join(',')}`),
        apiGet(`/api/produits/recommandes?categories=${userBehavior.join(',')}&limit=15`)
      ]);
      
      const publicites = pubsResponse.data || [];
      const produits = produitsResponse.data || [];
      
      // Mélanger intelligemment
      const mixed = mixPublicitesEtProduits(
        publicites,
        produits,
        publiciteFrequency
      );
      
      setMixedContent(mixed);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement contenu mixte:', error);
      setLoading(false);
    }
  };
  
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {mixedContent.map((item, index) => {
        if (item.type === 'publicite') {
          return (
            <PubliciteCard 
              key={`pub-${index}`} 
              publicite={item.data}
              isPaid={true}
            />
          );
        } else {
          return (
            <ProductCard 
              key={`prod-${index}`} 
              product={item.data}
              isRecommended={true}
            />
          );
        }
      })}
    </ScrollView>
  );
};
```

### **3. Mise à Jour HomeScreen**

```typescript
// Dans HomeScreen.tsx
<ScrollView>
  <View>
    {/* ✅ NOUVEAU: Contenu mixte publicités + produits */}
    <MixedContentCarousel
      userId={user?.id}
      userBehavior={userBehaviorCategories}
      publiciteFrequency={3} // 1 pub toutes les 3 cartes
    />
    
    {/* OU alternative: Affichage séparé */}
    
    {/* Section Publicités */}
    <Text style={styles.sectionTitle}>🎯 Publicités</Text>
    <PublicitesCarousel
      userId={user?.id}
      userBehavior={userBehaviorCategories}
    />
    
    {/* Section Recommandations */}
    <Text style={styles.sectionTitle}>✨ Recommandé pour vous</Text>
    <ProduitsRecommandes
      userId={user?.id}
      userBehavior={userBehaviorCategories}
      maxItems={15}
    />
  </View>
</ScrollView>
```

---

## 📊 **GESTION DE LA FRÉQUENCE**

### **Configuration Flexible**

```typescript
// config/recommendationConfig.ts
export const RECOMMENDATION_CONFIG = {
  // Fréquence d'apparition des publicités
  publiciteFrequency: 3, // 1 pub tous les 3 produits
  
  // Limites
  maxPublicitesPerSession: 5, // Max 5 pubs par session
  maxProduitsOrganiques: 15,  // Max 15 produits organiques
  
  // Poids pour le scoring
  scoring: {
    categoryMatch: 10,      // +10 si catégorie correspond
    promotion: 5,           // +5 si en promotion
    recent: 3,              // +3 si récent (< 7j)
    rating: 2,              // +2 si bien noté (>= 4⭐)
    distance: 1             // +1 si proche géographiquement
  },
  
  // Rotation
  rotationInterval: 30000, // 30s entre rotations auto
  
  // Cache
  cacheExpiration: 300000 // 5 min avant recharger
};
```

### **Gestion Intelligente**

```typescript
class RecommendationManager {
  private publicitesSeen: Set<string> = new Set();
  private produitsShown: Set<string> = new Set();
  
  // Éviter de montrer la même pub trop souvent
  shouldShowPublicite(pubId: string): boolean {
    if (this.publicitesSeen.has(pubId)) {
      // Déjà vue, vérifier le cooldown
      const lastSeen = this.getLastSeenTime(pubId);
      const cooldown = 300000; // 5 minutes
      
      if (Date.now() - lastSeen < cooldown) {
        return false; // Trop récent
      }
    }
    
    return true;
  }
  
  // Marquer comme vue
  markPubliciteAsSeen(pubId: string): void {
    this.publicitesSeen.add(pubId);
    this.saveLastSeenTime(pubId, Date.now());
  }
  
  // Rotation intelligente
  getNextContent(
    publicites: any[],
    produits: any[],
    currentPosition: number
  ): any {
    // Position pour publicité ?
    if (currentPosition % RECOMMENDATION_CONFIG.publiciteFrequency === 0) {
      // Trouver une pub non vue récemment
      const eligiblePubs = publicites.filter(p => 
        this.shouldShowPublicite(p.id)
      );
      
      if (eligiblePubs.length > 0) {
        const pub = eligiblePubs[0];
        this.markPubliciteAsSeen(pub.id);
        return { type: 'publicite', data: pub };
      }
    }
    
    // Sinon, produit organique
    const eligibleProds = produits.filter(p =>
      !this.produitsShown.has(p.id)
    );
    
    if (eligibleProds.length > 0) {
      const prod = eligibleProds[0];
      this.produitsShown.add(prod.id);
      return { type: 'produit', data: prod };
    }
    
    return null;
  }
}
```

---

## 🎯 **INDICATEURS VISUELS**

### **Différenciation Publicité/Produit Organique**

```typescript
// Badge "Sponsorisé"
const PubliciteCard = ({ publicite, isPaid }) => (
  <View style={styles.card}>
    {isPaid && (
      <View style={styles.sponsoredBadge}>
        <SafeIcon name="star" size={12} color="#FFD700" />
        <Text style={styles.sponsoredText}>Sponsorisé</Text>
      </View>
    )}
    {/* Contenu de la carte */}
  </View>
);

// Badge "Recommandé"
const ProductCard = ({ product, isRecommended }) => (
  <View style={styles.card}>
    {isRecommended && (
      <View style={styles.recommendedBadge}>
        <SafeIcon name="sparkles" size={12} color="#6366F1" />
        <Text style={styles.recommendedText}>Pour vous</Text>
      </View>
    )}
    {/* Contenu de la carte */}
  </View>
);
```

---

## 📈 **MÉTRIQUES & ANALYTICS**

### **Tracking**

```typescript
// Tracker les impressions
const trackImpression = async (itemId: string, type: 'publicite' | 'produit') => {
  await apiPost('/api/analytics/impression', {
    item_id: itemId,
    type: type,
    user_id: userId,
    timestamp: Date.now()
  });
};

// Tracker les clics
const trackClick = async (itemId: string, type: 'publicite' | 'produit') => {
  await apiPost('/api/analytics/click', {
    item_id: itemId,
    type: type,
    user_id: userId,
    timestamp: Date.now()
  });
};

// Calculer CTR (Click-Through Rate)
const calculateCTR = (clicks: number, impressions: number): number => {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
};
```

---

## ✅ **AVANTAGES DU SYSTÈME**

### **Pour les Utilisateurs**
- ✅ **Découverte variée** : publicités + produits organiques
- ✅ **Personnalisé** : basé sur leur comportement
- ✅ **Non intrusif** : 1 pub toutes les 3 cartes seulement
- ✅ **Visibilité claire** : badges "Sponsorisé" vs "Pour vous"

### **Pour les Prestataires**
- ✅ **Visibilité organique** : produits apparaissent sans payer
- ✅ **Boost payant** : publicités pour plus de visibilité
- ✅ **Ciblage intelligent** : basé sur comportement utilisateur
- ✅ **ROI mesurable** : analytics impressions/clics

### **Pour la Plateforme**
- ✅ **Monétisation** : publicités payantes
- ✅ **Engagement** : contenu varié et pertinent
- ✅ **Équité** : tous les produits ont une chance organique
- ✅ **Données** : meilleure compréhension du comportement

---

## 🔄 **PLAN D'IMPLÉMENTATION**

### **Phase 1: Produits Organiques** (Prioritaire)
1. ✅ Créer endpoint `/api/produits/recommandes`
2. ✅ Créer composant `ProduitsRecommandes.tsx`
3. ✅ Intégrer dans HomeScreen
4. ✅ Tester avec comportement utilisateur

### **Phase 2: Mélange Intelligent**
1. ✅ Créer composant `MixedContentCarousel.tsx`
2. ✅ Implémenter algorithme de mélange
3. ✅ Ajouter badges visuels
4. ✅ Tester fréquence d'apparition

### **Phase 3: Analytics**
1. ✅ Tracker impressions
2. ✅ Tracker clics
3. ✅ Dashboard analytics
4. ✅ Optimisation continue

---

## 📊 **EXEMPLE CONCRET**

### **Utilisateur "Jean" - Comportement**
- Recherches récentes : "restaurant", "pizza", "livraison"
- Catégories : Restaurant, Fast-food, Livraison

### **Scroll HomeScreen de Jean**
```
[Produit: Pizza Mario] 🍕 (Organique - Catégorie match)
[Produit: Restaurant Le Gourmet] 🍽️ (Organique - Catégorie match)
[Produit: Burger King] 🍔 (Organique - En promotion)
[PUBLICITÉ: Super Pizza - 20% OFF] ⭐ (Sponsorisé - Ciblé restaurants)
[Produit: Sushi Bar] 🍱 (Organique - Nouveau)
[Produit: Livraison Express] 🚚 (Organique - Service livraison)
[Produit: Café Central] ☕ (Organique - Proximité)
[PUBLICITÉ: Mega Burger - Menu duo] ⭐ (Sponsorisé - Ciblé fast-food)
[Produit: Pâtes Italiennes] 🍝 (Organique - Catégorie match)
...
```

**Résultat** :
- Jean voit **des produits pertinents** (organiques)
- **2 publicités ciblées** toutes les 6-7 cartes
- **Expérience fluide** et personnalisée
- **Prestataires satisfaits** : visibilité organique + option boost payant

---

**✅ SYSTÈME COMPLET ET ÉQUILIBRÉ**
