# ⚖️ SYSTÈME DE FRÉQUENCE ÉQUITABLE - Publicités vs Organiques

**Date**: 22 Octobre 2025  
**Principe**: Un produit organique NE DOIT PAS avoir plus de visibilité qu'un produit payant

---

## 🎯 **RÈGLE FONDAMENTALE**

### **Principe d'Équité**

```
❌ INTERDIT:
Produit organique vu 10 fois
Publicité vue 2 fois
→ Produit gratuit a plus de visibilité que produit payant !

✅ CORRECT:
Produit organique vu 1 fois
Publicité vue 1 fois
→ Équité totale !

✅ OPTIMAL:
Produit organique vu 1 fois
Publicité vue 2-3 fois
→ Avantage payant (normal !)
```

---

## 📊 **SYSTÈME DE ROTATION**

### **1. Limite de Visibilité par Session**

```typescript
interface VisibilityLimits {
  // Organiques (gratuits)
  organicMaxAppearances: 1,      // Max 1 fois par session
  organicCooldown: 3600000,      // 1h avant réapparition
  
  // Publicités (payantes)
  paidMaxAppearances: 3,          // Max 3 fois par session
  paidCooldown: 1800000,          // 30 min avant réapparition
  
  // Rotation
  sessionDuration: 1800000,       // Session = 30 min
  minItemsBetweenSame: 5          // Min 5 cartes entre 2 apparitions
}
```

### **2. Tracking des Apparitions**

```typescript
class VisibilityTracker {
  private organicSeen: Map<string, number> = new Map(); // ID → timestamp
  private paidSeen: Map<string, number[]> = new Map();  // ID → timestamps[]
  private sessionStart: number = Date.now();
  
  // Vérifier si un produit organique peut apparaître
  canShowOrganic(productId: string): boolean {
    const lastSeen = this.organicSeen.get(productId);
    
    // Jamais vu ?
    if (!lastSeen) return true;
    
    // Vu récemment (< 1h) ?
    const timeSince = Date.now() - lastSeen;
    if (timeSince < VISIBILITY_LIMITS.organicCooldown) {
      return false; // ❌ Trop récent
    }
    
    // Nouvelle session ?
    if (Date.now() - this.sessionStart > VISIBILITY_LIMITS.sessionDuration) {
      this.resetSession();
      return true;
    }
    
    return true;
  }
  
  // Vérifier si une publicité peut apparaître
  canShowPaid(pubId: string): boolean {
    const appearances = this.paidSeen.get(pubId) || [];
    
    // Jamais vue ?
    if (appearances.length === 0) return true;
    
    // Déjà vue 3 fois dans cette session ?
    const recentAppearances = appearances.filter(
      timestamp => Date.now() - timestamp < VISIBILITY_LIMITS.sessionDuration
    );
    
    if (recentAppearances.length >= VISIBILITY_LIMITS.paidMaxAppearances) {
      return false; // ❌ Quota atteint
    }
    
    // Vue trop récemment (< 30 min) ?
    const lastSeen = appearances[appearances.length - 1];
    if (Date.now() - lastSeen < VISIBILITY_LIMITS.paidCooldown) {
      return false; // ❌ Trop récent
    }
    
    return true;
  }
  
  // Marquer comme vu
  markAsSeen(itemId: string, isPaid: boolean): void {
    const now = Date.now();
    
    if (isPaid) {
      const appearances = this.paidSeen.get(itemId) || [];
      appearances.push(now);
      this.paidSeen.set(itemId, appearances);
    } else {
      this.organicSeen.set(itemId, now);
    }
  }
  
  // Réinitialiser la session
  resetSession(): void {
    this.organicSeen.clear();
    this.paidSeen.clear();
    this.sessionStart = Date.now();
  }
}
```

---

## 🔄 **ALGORITHME DE SÉLECTION**

### **1. Pool de Candidats**

```typescript
interface ContentPool {
  availableOrganic: Product[];   // Produits organiques éligibles
  availablePaid: Publicite[];    // Publicités éligibles
  lastShownIds: string[];        // Derniers IDs montrés (éviter répétition)
}

function buildContentPool(
  allOrganic: Product[],
  allPaid: Publicite[],
  tracker: VisibilityTracker
): ContentPool {
  // Filtrer les organiques éligibles
  const availableOrganic = allOrganic.filter(product => {
    // Peut apparaître selon les règles ?
    if (!tracker.canShowOrganic(product.id)) return false;
    
    // Pas montré dans les 5 dernières cartes ?
    if (tracker.lastShownIds.slice(-5).includes(product.id)) return false;
    
    return true;
  });
  
  // Filtrer les publicités éligibles
  const availablePaid = allPaid.filter(pub => {
    // Peut apparaître selon les règles ?
    if (!tracker.canShowPaid(pub.id)) return false;
    
    // Pas montrée dans les 5 dernières cartes ?
    if (tracker.lastShownIds.slice(-5).includes(pub.id)) return false;
    
    return true;
  });
  
  return {
    availableOrganic,
    availablePaid,
    lastShownIds: tracker.lastShownIds
  };
}
```

### **2. Sélection Intelligente**

```typescript
function selectNextContent(
  pool: ContentPool,
  currentPosition: number,
  tracker: VisibilityTracker
): ContentItem | null {
  
  // Position pour publicité ? (tous les 3)
  const isPaidPosition = currentPosition % 3 === 0;
  
  if (isPaidPosition && pool.availablePaid.length > 0) {
    // ✅ Priorité aux publicités PAYANTES
    const pub = pool.availablePaid[0];
    tracker.markAsSeen(pub.id, true);
    return { type: 'paid', data: pub };
  }
  
  // Sinon, produit organique
  if (pool.availableOrganic.length > 0) {
    const product = pool.availableOrganic[0];
    tracker.markAsSeen(product.id, false);
    return { type: 'organic', data: product };
  }
  
  // Aucun contenu disponible ?
  // Fallback: montrer une publicité même si ce n'est pas sa position
  if (pool.availablePaid.length > 0) {
    const pub = pool.availablePaid[0];
    tracker.markAsSeen(pub.id, true);
    return { type: 'paid', data: pub };
  }
  
  return null; // Plus rien à montrer
}
```

---

## 📈 **SYSTÈME DE BOOST (OPTIONNEL)**

### **Niveaux de Publicité**

```typescript
enum PaidBoostLevel {
  BASIC = 'basic',       // 500 FCFA/jour : 1 apparition toutes les 3 cartes
  PREMIUM = 'premium',   // 1500 FCFA/jour : 1 apparition toutes les 2 cartes
  ULTRA = 'ultra'        // 3000 FCFA/jour : 1 apparition par carte (50% du feed)
}

interface PaidConfig {
  level: PaidBoostLevel;
  frequency: number;        // Toutes les X cartes
  maxAppearances: number;   // Max par session
  cooldown: number;         // Temps avant réapparition
}

const BOOST_CONFIGS: Record<PaidBoostLevel, PaidConfig> = {
  basic: {
    level: PaidBoostLevel.BASIC,
    frequency: 3,           // 1 pub toutes les 3 cartes
    maxAppearances: 3,      // 3 fois par session
    cooldown: 1800000       // 30 min
  },
  premium: {
    level: PaidBoostLevel.PREMIUM,
    frequency: 2,           // 1 pub toutes les 2 cartes
    maxAppearances: 5,      // 5 fois par session
    cooldown: 900000        // 15 min
  },
  ultra: {
    level: PaidBoostLevel.ULTRA,
    frequency: 1,           // 1 pub par carte (alterné)
    maxAppearances: 10,     // 10 fois par session
    cooldown: 300000        // 5 min
  }
};
```

### **Sélection avec Boost**

```typescript
function selectWithBoost(
  pool: ContentPool,
  position: number,
  paidConfigs: Map<string, PaidConfig>
): ContentItem | null {
  
  // Déterminer quel niveau de boost doit apparaître
  for (const [pubId, config] of paidConfigs) {
    // Position pour ce niveau de boost ?
    if (position % config.frequency === 0) {
      const pub = pool.availablePaid.find(p => p.id === pubId);
      if (pub) {
        return { type: 'paid', data: pub, boost: config.level };
      }
    }
  }
  
  // Sinon, contenu organique
  if (pool.availableOrganic.length > 0) {
    return { type: 'organic', data: pool.availableOrganic[0] };
  }
  
  return null;
}
```

---

## 📊 **EXEMPLES CONCRETS**

### **Scénario 1: Session 30 Minutes**

```typescript
// Session utilisateur Jean (30 min de scroll)

Position 1:  [Produit A] organique ✅
Position 2:  [Produit B] organique ✅
Position 3:  [Produit C] organique ✅
Position 4:  [PUBLICITÉ 1] payante ⭐
Position 5:  [Produit D] organique ✅
Position 6:  [Produit E] organique ✅
Position 7:  [Produit F] organique ✅
Position 8:  [PUBLICITÉ 2] payante ⭐
Position 9:  [Produit G] organique ✅
Position 10: [Produit H] organique ✅
Position 11: [Produit I] organique ✅
Position 12: [PUBLICITÉ 1] payante ⭐ (2e apparition, après 30min)
Position 13: [Produit J] organique ✅ (nouveau, pas Produit A)
Position 14: [Produit K] organique ✅
Position 15: [Produit L] organique ✅
Position 16: [PUBLICITÉ 3] payante ⭐
...

RÉSULTAT:
- Produits organiques: 12 différents (jamais répétés)
- Publicités: 3 publicités × 2-3 fois chacune
- Ratio: ~75% organique / 25% payant
```

### **Scénario 2: Produit A Organique**

```
Session 1 (9h00 - 9h30):
Position 5:  [Produit A] organique ✅ (1ère fois)
Position 15: [Produit A] ❌ BLOQUÉ (déjà vu dans session)

Session 2 (10h30 - 11h00):
Position 3:  [Produit A] organique ✅ (2e fois, nouvelle session)

Session 3 (12h00 - 12h30):
Position 8:  [Produit A] organique ✅ (3e fois, nouvelle session)

RÉSULTAT:
- Produit A apparaît MAX 1 fois par session
- Jamais 2 fois dans les 5 dernières cartes
- Respecte le cooldown de 1h
```

### **Scénario 3: Publicité Pizza Restaurant**

```
Session 1 (14h00 - 14h30):
Position 4:  [Publicité Pizza] ⭐ (1ère fois)
Position 12: [Publicité Pizza] ⭐ (2e fois, après 30min cooldown)
Position 20: [Publicité Pizza] ⭐ (3e fois)
Position 28: [Publicité Pizza] ❌ BLOQUÉ (quota 3 atteint)

Session 2 (15h00 - 15h30):
Position 4:  [Publicité Pizza] ⭐ (4e fois, nouvelle session)

RÉSULTAT:
- Publicité apparaît 3 fois max par session
- Respecte le cooldown de 30 min
- Peut réapparaître dans nouvelle session
```

---

## ⚖️ **TABLEAU COMPARATIF**

### **Visibilité par Type**

| Métrique | Organique (Gratuit) | Publicité Basic | Publicité Premium | Publicité Ultra |
|----------|-------------------|-----------------|-------------------|-----------------|
| **Prix** | 0 FCFA | 500 FCFA/jour | 1500 FCFA/jour | 3000 FCFA/jour |
| **Fréquence** | Aléatoire | 1 toutes les 3 | 1 toutes les 2 | 1 sur 2 |
| **Max/Session** | 1 fois | 3 fois | 5 fois | 10 fois |
| **Cooldown** | 1 heure | 30 min | 15 min | 5 min |
| **Ratio Feed** | ~60% | ~10% | ~20% | ~40% |
| **Rotation** | Jamais répété | Après cooldown | Après cooldown | Après cooldown |

### **Visibilité Totale (Session 30 min)**

```
Utilisateur scroll 20 cartes en 30 min:

Organiques: 15 cartes (15 produits DIFFÉRENTS)
├─ Produit A: 1 fois ✅
├─ Produit B: 1 fois ✅
├─ Produit C: 1 fois ✅
└─ ... 12 autres produits différents

Publicités: 5 cartes
├─ Pub 1 (Basic): 2 fois ⭐
├─ Pub 2 (Premium): 2 fois ⭐⭐
└─ Pub 3 (Basic): 1 fois ⭐

RÉSULTAT:
✅ Produits organiques: 1 apparition max
✅ Publicités payantes: 2-3 apparitions
✅ Équité respectée: payant > gratuit
```

---

## 🎯 **RÈGLES STRICTES**

### **1. Produit Organique**

```typescript
// ❌ INTERDIT
{
  appearances: 3,              // Apparaît 3 fois
  cooldown: 300000,           // 5 min seulement
  priority: 'high'            // Priorité haute
}
// → Trop de visibilité pour du gratuit !

// ✅ CORRECT
{
  appearances: 1,              // 1 fois MAX par session
  cooldown: 3600000,          // 1h avant réapparition
  priority: 'normal'          // Priorité normale
}
// → Visibilité limitée, équitable
```

### **2. Publicité Payante**

```typescript
// ✅ AVANTAGES PAYANTS
{
  appearances: 3,              // Jusqu'à 3 fois
  cooldown: 1800000,          // 30 min (plus court)
  priority: 'high',           // Priorité haute
  boost: 'basic'              // Boost niveau payant
}
// → Plus de visibilité que gratuit (normal !)
```

### **3. Anti-Spam**

```typescript
// Protection contre répétition excessive
const ANTI_SPAM_RULES = {
  minItemsBetweenSame: 5,     // Min 5 cartes entre 2 apparitions
  maxSameInRow: 0,            // Jamais 2 fois de suite
  diversityScore: 0.7         // 70% de diversité minimum
};

function isSpam(itemId: string, recentItems: string[]): boolean {
  // Vérifie les 5 dernières cartes
  const last5 = recentItems.slice(-5);
  
  if (last5.includes(itemId)) {
    return true; // ❌ Déjà vu récemment
  }
  
  return false;
}
```

---

## 📈 **ANALYTICS & OPTIMISATION**

### **Métriques à Tracker**

```typescript
interface VisibilityMetrics {
  // Par produit
  productId: string;
  isPaid: boolean;
  totalImpressions: number;    // Nombre total de vues
  uniqueUsers: number;         // Nombre d'utilisateurs uniques
  avgTimeOnScreen: number;     // Temps moyen à l'écran
  clickThrough: number;        // Taux de clic
  
  // Équité
  organicAvgViews: number;     // Moyenne vues organiques
  paidAvgViews: number;        // Moyenne vues payantes
  fairnessRatio: number;       // Ratio équité (doit être < 1)
}

// Calcul d'équité
function calculateFairness(metrics: VisibilityMetrics[]): number {
  const organic = metrics.filter(m => !m.isPaid);
  const paid = metrics.filter(m => m.isPaid);
  
  const avgOrganic = organic.reduce((sum, m) => sum + m.totalImpressions, 0) / organic.length;
  const avgPaid = paid.reduce((sum, m) => sum + m.totalImpressions, 0) / paid.length;
  
  // Ratio d'équité (doit être <= 0.5 : organique a max 50% de visibilité du payant)
  const fairness = avgOrganic / avgPaid;
  
  if (fairness > 0.5) {
    console.warn('⚠️ ALERTE: Produits organiques ont trop de visibilité !');
  }
  
  return fairness;
}
```

---

## ✅ **IMPLÉMENTATION**

### **Composant MixedContentCarousel (mise à jour)**

```typescript
const MixedContentCarousel: React.FC = ({ userId, userBehavior }) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const tracker = useRef(new VisibilityTracker()).current;
  
  // Charger contenu initial
  useEffect(() => {
    loadInitialContent();
  }, []);
  
  const loadInitialContent = async () => {
    // Charger organiques + publicités
    const [organic, paid] = await Promise.all([
      apiGet('/api/produits/recommandes'),
      apiGet('/api/publicites/actives')
    ]);
    
    // Construire pool éligible
    const pool = buildContentPool(
      organic.data,
      paid.data,
      tracker
    );
    
    // Générer 20 cartes avec rotation équitable
    const items: ContentItem[] = [];
    for (let i = 0; i < 20; i++) {
      const item = selectNextContent(pool, i, tracker);
      if (item) {
        items.push(item);
      }
    }
    
    setContent(items);
  };
  
  // Charger plus de contenu au scroll
  const loadMoreContent = () => {
    // Recharger pool avec nouveaux produits organiques
    // (excluant ceux déjà vus)
    loadInitialContent();
  };
  
  return (
    <ScrollView
      onEndReached={loadMoreContent}
      onEndReachedThreshold={0.5}
    >
      {content.map((item, index) => (
        <ContentCard
          key={`${item.type}-${item.data.id}-${index}`}
          item={item}
          isPaid={item.type === 'paid'}
        />
      ))}
    </ScrollView>
  );
};
```

---

## 🎯 **RÉSUMÉ**

### **Principe Clé**

```
GRATUIT ≤ PAYANT

Produit organique: MAX 1 fois/session
Publicité payante: MAX 3 fois/session

→ Payant a 3× plus de visibilité ✅
```

### **Règles d'Or**

1. ✅ **1 apparition max** pour produit organique par session
2. ✅ **3 apparitions max** pour publicité par session
3. ✅ **Cooldown 1h** pour organiques
4. ✅ **Cooldown 30min** pour publicités
5. ✅ **Min 5 cartes** entre 2 apparitions du même item
6. ✅ **Rotation intelligente** pour diversité

### **Avantages**

**Pour les prestataires payants** :
- ✅ Visibilité garantie supérieure
- ✅ Plus de réapparitions
- ✅ Cooldown plus court
- ✅ ROI justifié

**Pour les prestataires organiques** :
- ✅ Visibilité gratuite limitée mais réelle
- ✅ Chance d'apparaître
- ✅ Incitation à payer pour boost

**Pour la plateforme** :
- ✅ Équité respectée
- ✅ Monétisation justifiée
- ✅ Expérience utilisateur préservée

---

**✅ SYSTÈME ÉQUITABLE ET RENTABLE !**
