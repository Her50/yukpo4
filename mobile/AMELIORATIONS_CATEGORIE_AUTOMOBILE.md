# 🚗 Plan d'Améliorations - Catégorie Automobile

## 📋 État Actuel

**Problèmes identifiés** :
- ❌ Pas de formulaire spécifique pour automobile (utilise formulaire par défaut)
- ❌ Pas de système intelligent Marque → Modèle
- ❌ Listes déroulantes sans modalités par défaut
- ❌ Pas de liens Marque-Modèle sauvegardés
- ❌ Formulaire non structuré par sections

## ✅ Solutions à Implémenter

### 1. **Base de Données** - Table `vehicle_models`

**Structure** :
```sql
CREATE TABLE vehicle_models (
  id SERIAL PRIMARY KEY,
  brand VARCHAR(100) NOT NULL,       -- Marque (Toyota, Peugeot, etc.)
  model VARCHAR(200) NOT NULL,       -- Modèle (Corolla, 308, etc.)
  year_min INTEGER,                  -- Année min de production
  year_max INTEGER,                  -- Année max de production
  category VARCHAR(50),              -- Voiture, Moto, Camion
  usage_count INTEGER DEFAULT 0,    -- Popularité
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(brand, model)
);
```

**Données par défaut** :
- Toyota : Corolla, Camry, RAV4, Land Cruiser, Hilux, Yaris, Prado...
- Peugeot : 206, 207, 208, 307, 308, 508, Partner, 3008, 5008...
- Mercedes : Classe A, Classe C, Classe E, GLA, GLE, ML, Vito...
- Nissan : Patrol, Navara, X-Trail, Qashqai, Micra...
- Honda : Civic, Accord, CR-V, Pilot...
- Etc. (15+ marques avec leurs modèles)

### 2. **Composant** - `VehicleModelSelector`

**Fonctionnalités** :
- Liste filtrée selon la marque sélectionnée
- Si Marque = "Toyota" → Affiche uniquement modèles Toyota
- Recherche textuelle dans les modèles
- Ajout progressif de nouveaux modèles (sauvegardés avec lien marque)
- Tri alphabétique

### 3. **Formulaire Structuré**

**Sections** :
```
📋 Section 1: Identité du Véhicule
   ├─ Marque * (liste)
   ├─ Modèle * (liste filtrée par marque)
   ├─ Année | Kilométrage (2 colonnes)
   └─ Couleur | Carrosserie (2 colonnes)

⚙️ Section 2: Caractéristiques Techniques
   ├─ Carburant | Transmission (2 colonnes)
   ├─ Cylindrée | Puissance (2 colonnes)
   └─ Nombre de portes | Nombre de places (2 colonnes)

🔍 Section 3: État et Historique
   ├─ État général * (liste)
   ├─ 1ère main | Carte grise (toggles)
   └─ Visite technique | Entretien régulier (toggles)

🔧 Section 4: Équipements
   ├─ Climatisation | Vitres électriques (toggles)
   ├─ GPS | Bluetooth | Caméra recul (toggles)
   └─ Autres équipements (multi-select)

📄 Section 5: Documents
   ├─ Facture | Carnet entretien (toggles)
   └─ Garantie constructeur | Assurance (toggles)
```

### 4. **Modalités Par Défaut**

**Marques** (30+) :
- Toyota, Peugeot, Mercedes, BMW, Nissan, Honda, Hyundai, Kia...

**Couleurs** (20+) :
- Blanc, Noir, Gris, Argent, Bleu, Rouge, Vert, Beige...

**Carrosseries** (15+) :
- Berline, SUV, 4x4, Break, Coupé, Cabriolet, Pick-up...

**Carburants** (6) :
- Essence, Diesel, Hybride, Électrique, GPL, Bioéthanol

**Transmissions** (3) :
- Manuelle, Automatique, Semi-automatique

**États** (6) :
- Neuf, Excellent état, Très bon état, Bon état, État moyen, À réparer

### 5. **ProductCard Optimisé**

**Affichage** :
```
┌─────────────────────────────────────┐
│ [🚗 Berline] [⛽ Diesel] [⚙️ Auto]  │
│                                     │
│ 🚗 Toyota Corolla 2020              │
│                                     │
│ 📊 15 000 km • 1ère main            │
│ ⚙️ 1.8L Diesel • 150 CV             │
│                                     │
│ ✓ Équipements :                     │
│ [✓ Clim] [✓ GPS] [✓ Caméra recul]  │
│ +5 autres                           │
│                                     │
│ 📄 Carte grise ✓ | Visite tech ✓   │
└─────────────────────────────────────┘
```

---

## 🎯 Actions à Réaliser

1. Créer migration `vehicle_models` avec données par défaut
2. Créer API backend pour CRUD vehicle_models
3. Créer `VehicleModelSelector.tsx` (filtré par marque)
4. Créer `AUTOMOBILE_MODALITIES` complètes
5. Créer formulaire automobile structuré
6. Optimiser ProductCard automobile
7. Adapter filtrage ResultatBesoinScreen
8. Mettre à jour import CSV

**EN COURS...**







