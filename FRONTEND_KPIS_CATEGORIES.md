# 📊 Frontend - KPIs Spécifiques par Catégorie

## 🎯 OBJECTIF

Ajouter des **KPIs spécifiques** à chaque catégorie de produits et afficher uniquement les catégories avec services disponibles.

---

## 📋 INTERFACE TypeScript

```typescript
interface CategoryStats {
  name: string;
  count: number;
  views: number;
  interactions: number;
  icon: string;
  color: string;
  // KPIs spécifiques par catégorie
  kpis: {
    label: string;
    value: string | number;
    unit?: string;
    icon: string;
  }[];
}
```

---

## 🔧 FONCTION DE CALCUL DES KPIS

Ajouter dans `frontend/src/pages/dashboard/MonActivite.tsx` :

```typescript
// Fonction pour calculer les KPIs spécifiques par catégorie
const calculateCategoryKPIs = (categoryKey: string, services: any[]): CategoryStats['kpis'] => {
  if (services.length === 0) return [];

  const produits = services.flatMap(s => s.data?.produits || []);
  
  switch (categoryKey) {
    case 'immobilier':
    case 'immobilier_batiment':
    case 'immobilier_terrain':
      const superficies = produits
        .map(p => parseFloat(p.superficie || p.surface || '0'))
        .filter(s => s > 0);
      const prix = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);
      const nbChambres = produits
        .map(p => parseInt(p.nbChambres || p.chambres || '0'))
        .filter(n => n > 0);

      return [
        { 
          label: 'Prix moyen', 
          value: prix.length > 0 ? Math.round(prix.reduce((a, b) => a + b, 0) / prix.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Superficie moy.', 
          value: superficies.length > 0 ? Math.round(superficies.reduce((a, b) => a + b, 0) / superficies.length) : 0, 
          unit: 'm²', 
          icon: 'Maximize2' 
        },
        { 
          label: 'Chambres moy.', 
          value: nbChambres.length > 0 ? Math.round(nbChambres.reduce((a, b) => a + b, 0) / nbChambres.length) : 0, 
          icon: 'Home' 
        }
      ];

    case 'automobile':
      const kilometrages = produits
        .map(p => parseFloat(p.kilometrage || '0'))
        .filter(k => k > 0);
      const annees = produits
        .map(p => parseInt(p.annee || '0'))
        .filter(a => a > 0);
      const prixAuto = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);

      return [
        { 
          label: 'Prix moyen', 
          value: prixAuto.length > 0 ? Math.round(prixAuto.reduce((a, b) => a + b, 0) / prixAuto.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Km moyen', 
          value: kilometrages.length > 0 ? Math.round(kilometrages.reduce((a, b) => a + b, 0) / kilometrages.length) : 0, 
          unit: 'km', 
          icon: 'Navigation' 
        },
        { 
          label: 'Année moy.', 
          value: annees.length > 0 ? Math.round(annees.reduce((a, b) => a + b, 0) / annees.length) : 0, 
          icon: 'Calendar' 
        }
      ];

    case 'prestation_service':
      const prestations = produits.flatMap(p => p.prestations || []);
      const montants = prestations
        .map(p => parseFloat(p.montantMinimum || p.prix || '0'))
        .filter(m => m > 0);
      const tauxSatisfaction = services
        .map(s => s.rating || 0)
        .filter(r => r > 0);

      return [
        { 
          label: 'Tarif moyen', 
          value: montants.length > 0 ? Math.round(montants.reduce((a, b) => a + b, 0) / montants.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Offres', 
          value: prestations.length, 
          icon: 'Briefcase' 
        },
        { 
          label: 'Satisfaction', 
          value: tauxSatisfaction.length > 0 ? (tauxSatisfaction.reduce((a, b) => a + b, 0) / tauxSatisfaction.length).toFixed(1) : '0', 
          unit: '/5', 
          icon: 'Star' 
        }
      ];

    case 'hopital_clinique':
      const prestationsMedicales = produits.flatMap(p => p.prestationsMedicales || []);
      const avecBanqueSang = produits.filter(p => p.banqueSang === true).length;
      const avecRdvEnLigne = produits.filter(p => p.rdvEnLigne === true).length;

      return [
        { 
          label: 'Spécialités', 
          value: new Set(prestationsMedicales).size, 
          icon: 'Heart' 
        },
        { 
          label: 'Banque sang', 
          value: avecBanqueSang, 
          unit: `/${produits.length}`, 
          icon: 'Droplet' 
        },
        { 
          label: 'RDV en ligne', 
          value: avecRdvEnLigne, 
          unit: `/${produits.length}`, 
          icon: 'Calendar' 
        }
      ];

    case 'demenagement':
      const volumes = produits
        .map(p => parseFloat(p.volumeEstime || '0'))
        .filter(v => v > 0);
      const distances = produits
        .map(p => parseFloat(p.distanceKm || '0'))
        .filter(d => d > 0);
      const prixDem = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);

      return [
        { 
          label: 'Prix moyen', 
          value: prixDem.length > 0 ? Math.round(prixDem.reduce((a, b) => a + b, 0) / prixDem.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Volume moy.', 
          value: volumes.length > 0 ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : 0, 
          unit: 'm³', 
          icon: 'Package' 
        },
        { 
          label: 'Distance moy.', 
          value: distances.length > 0 ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : 0, 
          unit: 'km', 
          icon: 'Navigation' 
        }
      ];

    case 'telephone':
    case 'ordinateur':
      const stockages = produits
        .map(p => parseInt(p.stockage || '0'))
        .filter(s => s > 0);
      const rams = produits
        .map(p => parseInt(p.RAM || p.ram || '0'))
        .filter(r => r > 0);
      const prixTech = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);

      return [
        { 
          label: 'Prix moyen', 
          value: prixTech.length > 0 ? Math.round(prixTech.reduce((a, b) => a + b, 0) / prixTech.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Stockage moy.', 
          value: stockages.length > 0 ? Math.round(stockages.reduce((a, b) => a + b, 0) / stockages.length) : 0, 
          unit: 'GB', 
          icon: 'HardDrive' 
        },
        { 
          label: 'RAM moy.', 
          value: rams.length > 0 ? Math.round(rams.reduce((a, b) => a + b, 0) / rams.length) : 0, 
          unit: 'GB', 
          icon: 'Cpu' 
        }
      ];

    case 'electromenager':
      const typesElectro = new Set(produits.map(p => p.typeElectro).filter(Boolean));
      const avecGarantie = produits.filter(p => p.garantie).length;
      const prixElectro = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);

      return [
        { 
          label: 'Prix moyen', 
          value: prixElectro.length > 0 ? Math.round(prixElectro.reduce((a, b) => a + b, 0) / prixElectro.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Types', 
          value: typesElectro.size, 
          icon: 'Zap' 
        },
        { 
          label: 'Avec garantie', 
          value: avecGarantie, 
          unit: `/${produits.length}`, 
          icon: 'Shield' 
        }
      ];

    case 'assurance':
      const couvertures = produits
        .map(p => parseFloat(p.couverture || '0'))
        .filter(c => c > 0);
      const primes = produits
        .map(p => parseFloat(p.prix || p.prime || '0'))
        .filter(p => p > 0);

      return [
        { 
          label: 'Prime moy.', 
          value: primes.length > 0 ? Math.round(primes.reduce((a, b) => a + b, 0) / primes.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'Couverture moy.', 
          value: couvertures.length > 0 ? Math.round(couvertures.reduce((a, b) => a + b, 0) / couvertures.length) : 0, 
          unit: 'FCFA', 
          icon: 'Shield' 
        },
        { 
          label: 'Offres', 
          value: produits.length, 
          icon: 'Briefcase' 
        }
      ];

    case 'pharmacie':
      const h24 = produits.filter(p => p.typePharmacie === 'Garde' || p.urgences24h).length;
      const avecConseil = produits.filter(p => p.services?.includes('Conseil')).length;

      return [
        { 
          label: 'Services 24h', 
          value: h24, 
          unit: `/${produits.length}`, 
          icon: 'Clock' 
        },
        { 
          label: 'Avec conseil', 
          value: avecConseil, 
          unit: `/${produits.length}`, 
          icon: 'UserCheck' 
        },
        { 
          label: 'Pharmacies', 
          value: produits.length, 
          icon: 'Pill' 
        }
      ];

    default:
      // KPIs génériques pour les autres catégories
      const prixGeneral = produits
        .map(p => parseFloat(p.prix || '0'))
        .filter(p => p > 0);
      const enStock = produits.filter(p => p.stock > 0 || p.disponible).length;

      return [
        { 
          label: 'Prix moyen', 
          value: prixGeneral.length > 0 ? Math.round(prixGeneral.reduce((a, b) => a + b, 0) / prixGeneral.length) : 0, 
          unit: 'FCFA', 
          icon: 'DollarSign' 
        },
        { 
          label: 'En stock', 
          value: enStock, 
          unit: `/${produits.length}`, 
          icon: 'Package' 
        },
        { 
          label: 'Produits', 
          value: produits.length, 
          icon: 'ShoppingBag' 
        }
      ];
  }
};
```

---

## 🔧 FONCTION DE CALCUL DES STATS

Modifier la fonction `calculateCategoryStats` dans `MonActivite.tsx` :

```typescript
const calculateCategoryStats = (servicesData: any[]) => {
  const categoryMap = new Map<string, CategoryStats>();
  
  // Catégories avec icônes et couleurs
  const categoryIcons: { [key: string]: { icon: string; color: string } } = {
    'immobilier': { icon: 'Home', color: '#3B82F6' },
    'automobile': { icon: 'Car', color: '#EF4444' },
    'electromenager': { icon: 'Zap', color: '#14B8A6' },
    'telephone': { icon: 'Smartphone', color: '#FF9800' },
    'ordinateur': { icon: 'Monitor', color: '#00BCD4' },
    'mobilier': { icon: 'Package', color: '#F97316' },
    'vetement': { icon: 'Shirt', color: '#EC4899' },
    'chaussure': { icon: 'Shoe', color: '#6366F1' },
    'prestation_service': { icon: 'Briefcase', color: '#8B5CF6' },
    'hopital_clinique': { icon: 'Heart', color: '#DC2626' },
    'pharmacie': { icon: 'Pill', color: '#059669' },
    'demenagement': { icon: 'Truck', color: '#F97316' },
    'assurance': { icon: 'Shield', color: '#0891B2' },
    'quincaillerie': { icon: 'Hammer', color: '#F59E0B' },
    'decoration': { icon: 'Palette', color: '#E91E63' },
    'autre': { icon: 'Grid', color: '#6B7280' }
  };

  // Stockage temporaire pour calculer les KPIs par catégorie
  const categoryData: { [key: string]: any[] } = {};

  servicesData.forEach(service => {
    let category = 'autre';

    if (service.data?.category?.valeur) {
      category = service.data.category.valeur.toLowerCase();
    } else if (service.data?.produits && Array.isArray(service.data.produits) && service.data.produits.length > 0) {
      const firstProduct = service.data.produits[0];
      if (firstProduct.type) {
        category = firstProduct.type.toLowerCase();
      }
    }

    const cleanCategory = category.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const categoryKey = category.replace(/\s+/g, '_').toLowerCase();

    if (!categoryMap.has(cleanCategory)) {
      const categoryInfo = categoryIcons[categoryKey] || categoryIcons['autre'];

      categoryMap.set(cleanCategory, {
        name: cleanCategory,
        count: 0,
        views: 0,
        interactions: 0,
        icon: categoryInfo.icon,
        color: categoryInfo.color,
        kpis: []
      });

      categoryData[cleanCategory] = [];
    }

    const stat = categoryMap.get(cleanCategory)!;
    stat.count++;
    stat.views += service.views || 0;
    stat.interactions += service.interactions || 0;

    categoryData[cleanCategory].push(service);
  });

  // Calculer les KPIs spécifiques pour chaque catégorie
  categoryMap.forEach((stat, categoryName) => {
    const services = categoryData[categoryName];
    const categoryKey = categoryName.toLowerCase().replace(/\s+/g, '_');
    
    stat.kpis = calculateCategoryKPIs(categoryKey, services);
  });

  // Convertir en tableau et filtrer les catégories vides
  const stats = Array.from(categoryMap.values())
    .filter(stat => stat.count > 0)  // ✅ Uniquement les catégories avec services
    .sort((a, b) => b.count - a.count);
  
  setCategoryStats(stats);
};
```

---

## 🎨 AFFICHAGE HTML/React

```tsx
{/* Section Par catégorie */}
{categoryStats.length > 0 && (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold">Par catégorie</h2>
      <button className="text-indigo-600 hover:text-indigo-700 font-semibold">
        Voir plus
      </button>
    </div>
    <div className="flex overflow-x-auto space-x-4 pb-4">
      {categoryStats.map((category, index) => {
        const Icon = iconMap[category.icon]; // Mapper icônes Lucide

        return (
          <div
            key={index}
            className="bg-white rounded-xl p-6 shadow-sm border border-l-4 min-w-[200px]"
            style={{ borderLeftColor: category.color }}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: category.color + '20' }}
            >
              <Icon className="w-6 h-6" style={{ color: category.color }} />
            </div>
            <p className="font-semibold text-gray-900 mb-1">{category.name}</p>
            <p className="text-sm text-gray-500 mb-3">
              {category.count} service{category.count > 1 ? 's' : ''}
            </p>

            {/* KPIs spécifiques */}
            {category.kpis.length > 0 && (
              <div className="border-t border-gray-200 pt-3 mb-3 space-y-2">
                {category.kpis.map((kpi, kpiIndex) => {
                  const KpiIcon = iconMap[kpi.icon];
                  return (
                    <div key={kpiIndex} className="flex items-center space-x-2 text-xs">
                      <KpiIcon className="w-3 h-3" style={{ color: category.color }} />
                      <span className="font-semibold text-gray-700">
                        {kpi.label}: {kpi.value}{kpi.unit || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats générales */}
            <div className="flex space-x-3 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Eye className="w-3 h-3" />
                <span>{category.views}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-3 h-3" />
                <span>{category.interactions}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

---

## 🗺️ MAPPING DES ICÔNES LUCIDE REACT

```typescript
import {
  Home, Car, Zap, Smartphone, Monitor, Package, Shirt, Shoe,
  Briefcase, Heart, Pill, Truck, Shield, Hammer, Palette, Grid,
  DollarSign, Maximize2, Navigation, Calendar, Star, Droplet,
  HardDrive, Cpu, UserCheck, Clock, ShoppingBag, Eye, MessageCircle
} from 'lucide-react';

const iconMap: { [key: string]: any } = {
  'Home': Home,
  'Car': Car,
  'Zap': Zap,
  'Smartphone': Smartphone,
  'Monitor': Monitor,
  'Package': Package,
  'Shirt': Shirt,
  'Shoe': Shoe,
  'Briefcase': Briefcase,
  'Heart': Heart,
  'Pill': Pill,
  'Truck': Truck,
  'Shield': Shield,
  'Hammer': Hammer,
  'Palette': Palette,
  'Grid': Grid,
  'DollarSign': DollarSign,
  'Maximize2': Maximize2,
  'Navigation': Navigation,
  'Calendar': Calendar,
  'Star': Star,
  'Droplet': Droplet,
  'HardDrive': HardDrive,
  'Cpu': Cpu,
  'UserCheck': UserCheck,
  'Clock': Clock,
  'ShoppingBag': ShoppingBag,
  'Eye': Eye,
  'MessageCircle': MessageCircle
};
```

---

## 📊 KPIs PAR CATÉGORIE

### 🏠 Immobilier
- Prix moyen (FCFA)
- Superficie moyenne (m²)
- Chambres moyennes

### 🚗 Automobile
- Prix moyen (FCFA)
- Kilométrage moyen (km)
- Année moyenne

### 🎯 Prestation de Service
- Tarif moyen (FCFA)
- Nombre d'offres
- Taux de satisfaction (/5)

### 🏥 Clinique/Hôpital
- Nombre de spécialités
- Avec banque de sang (ratio)
- Avec RDV en ligne (ratio)

### 📦 Déménagement
- Prix moyen (FCFA)
- Volume moyen (m³)
- Distance moyenne (km)

### 📱 Téléphone/Ordinateur
- Prix moyen (FCFA)
- Stockage moyen (GB)
- RAM moyenne (GB)

### 🔌 Électroménager
- Prix moyen (FCFA)
- Nombre de types
- Avec garantie (ratio)

### 🛡️ Assurance
- Prime moyenne (FCFA)
- Couverture moyenne (FCFA)
- Nombre d'offres

### 💊 Pharmacie
- Services 24h (ratio)
- Avec conseil (ratio)
- Nombre de pharmacies

### 📦 Autres catégories (générique)
- Prix moyen (FCFA)
- En stock (ratio)
- Nombre de produits

---

## ✅ CHECKLIST

- [ ] Copier l'interface `CategoryStats`
- [ ] Ajouter la fonction `calculateCategoryKPIs()`
- [ ] Modifier `calculateCategoryStats()` pour inclure KPIs
- [ ] Filtrer les catégories vides (`.filter(stat => stat.count > 0)`)
- [ ] Importer les icônes Lucide React
- [ ] Créer le mapping `iconMap`
- [ ] Mettre à jour l'affichage HTML avec les KPIs
- [ ] Tester avec différents types de services

---

## 🎉 RÉSULTAT ATTENDU

### Exemple pour Immobilier (3 services) :
```
┌────────────────────────────────┐
│ 🏠 Immobilier                  │
│ 3 services                     │
├────────────────────────────────┤
│ 💰 Prix moyen: 45M FCFA       │
│ 📏 Superficie moy.: 85 m²     │
│ 🏡 Chambres moy.: 3           │
├────────────────────────────────┤
│ 👁️ 230  💬 120                │
└────────────────────────────────┘
```

---

**Mobile ✅ TERMINÉ**  
**Frontend 📝 À implémenter** (suivre cette documentation)

