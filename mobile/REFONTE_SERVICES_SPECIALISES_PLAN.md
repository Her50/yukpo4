# 📋 Plan de Refonte des Services Spécialisés - Interface Professionnelle

## 🎯 Objectif
Refondre progressivement chaque écran de recherche de service spécialisé pour créer une interface professionnelle alignée avec :
- La configuration backend du service
- La logique métier spécifique
- Les normes d'interface professionnelle
- L'alignement avec l'écran de configuration correspondant

---

## 📊 Liste des Services Spécialisés (14 services)

### 🏥 SANTÉ (4 services)
1. ✅ **Pharmacie** - `specialized_type=pharmacie` (EN COURS)
2. ⏳ **Hôpital/Clinique** - `specialized_type=hopital_clinique`
3. ⏳ **Laboratoire** - `specialized_type=laboratoire_imagerie`
4. ⏳ **Banque de sang** - `specialized_type=banque_sang`

### 🚗 TRANSPORT (3 services)
5. ⏳ **Taxi** - `specialized_type=taxi_ville`
6. ⏳ **Covoiturage** - `specialized_type=covoiturage`
7. ⏳ **Bus/Tickets** - Contrôleur `bus_ticket_controller`

### ✈️ VOYAGE (1 service)
8. ⏳ **Agence de voyage** - `specialized_type=agence_voyage`

### 🏠 IMMOBILIER (1 service)
9. ⏳ **Immobilier** - `specialized_type=immobilier`

### 📚 ÉDUCATION (2 services)
10. ⏳ **Livre scolaire** - Bourse du livre
11. ⏳ **Orientation scolaire** - Établissements, programmes

### 🛒 MARCHANDISE (1 service)
12. ⏳ **BayamSelam** - Comparatif prix, marchés

### 🚙 AUTOMOBILE (1 service)
13. ⏳ **Automobile** - Vente véhicules

### 🛡️ ASSURANCE (1 service)
14. ⏳ **Assurance** - Produits assurance

---

## 🔄 Processus Standard pour Chaque Service

### Étape 1 : Analyse Backend
**Objectif** : Comprendre la configuration et la logique métier

**Actions** :
- [ ] Identifier le `specialized_type` dans le backend
- [ ] Analyser le contrôleur spécialisé (`*_controller.rs`)
- [ ] Examiner les champs spécifiques dans `data` (JSON)
- [ ] Comprendre les filtres de recherche disponibles
- [ ] Identifier les contraintes métier (horaires, disponibilité, etc.)
- [ ] Vérifier les endpoints API de recherche

**Fichiers à examiner** :
- `backend/src/controllers/specialized_services_controller.rs`
- `backend/src/controllers/*_controller.rs` (spécifique au service)
- `backend/src/services/*_service.rs` (logique métier)
- `backend/migrations/*.sql` (schéma de données)

### Étape 2 : Vérification Logique Métier
**Objectif** : Comprendre les règles de recherche spécifiques

**Actions** :
- [ ] Identifier les critères de recherche uniques au service
- [ ] Comprendre les filtres temporels (horaires, disponibilité)
- [ ] Analyser les filtres géographiques (GPS, zones, quartiers)
- [ ] Vérifier les filtres spécifiques (type, statut, caractéristiques)
- [ ] Comprendre le scoring/ranking des résultats
- [ ] Identifier les recherches rapides courantes

**Exemples** :
- Pharmacie : garde 24/7, disponibilité maintenant, distance
- Immobilier : zone polygonale, quartiers multiples, prix/superficie
- Taxi : disponibilité temps réel, type véhicule

### Étape 3 : Construction Interface Recherche Professionnelle
**Objectif** : Créer une interface moderne et intuitive

**Composants à inclure** :
- [ ] **Header avec gradient** : Icône service, titre, sous-titre
- [ ] **Recherches rapides** : 3-4 boutons pour recherches courantes
- [ ] **Formulaire de recherche** : Dans une carte moderne
  - [ ] Localisation (ville, quartier, GPS)
  - [ ] Distance maximale (slider interactif)
  - [ ] Filtres spécifiques au service
- [ ] **Options avancées** : Switches avec icônes et descriptions
- [ ] **Section informative** : "Bon à savoir" avec conseils
- [ ] **Bouton recherche** : Design moderne avec icône

**Normes de design** :
- Utiliser `LinearGradient` pour les headers
- Cartes avec ombres et bordures arrondies
- Icônes Lucide cohérentes
- Couleurs du thème moderne (`modernColors`)
- Haptic feedback sur interactions
- Animations subtiles

**Référence** : `PharmacieSearchScreen.tsx` (version refondue)

### Étape 4 : Vérification Alignement Configuration
**Objectif** : S'assurer que l'écran de configuration correspond

**Actions** :
- [ ] Examiner `*FormScreen.tsx` correspondant
- [ ] Vérifier que les champs de recherche correspondent aux champs de configuration
- [ ] S'assurer que les filtres utilisent les mêmes valeurs que la config
- [ ] Vérifier la cohérence des noms de champs
- [ ] Tester le flux : Configuration → Recherche → Résultats

**Exemples de vérifications** :
- Pharmacie : `type` (garde/classique) dans Form = filtre dans Search
- Immobilier : `type_bien`, `statut`, `standing` cohérents
- Taxi : `type_vehicule`, `disponibilite` alignés

---

## 📝 Template de Checklist par Service

Pour chaque service, utiliser cette checklist :

```markdown
## [NOM_SERVICE]

### ✅ Étape 1 : Analyse Backend
- [ ] specialized_type identifié : `xxx`
- [ ] Contrôleur analysé : `xxx_controller.rs`
- [ ] Champs data.json documentés
- [ ] Endpoints API identifiés
- [ ] Logique métier comprise

### ✅ Étape 2 : Logique Métier
- [ ] Critères de recherche identifiés
- [ ] Filtres temporels compris
- [ ] Filtres géographiques compris
- [ ] Filtres spécifiques documentés
- [ ] Recherches rapides définies

### ✅ Étape 3 : Interface Recherche
- [ ] Header avec gradient créé
- [ ] Recherches rapides implémentées
- [ ] Formulaire dans carte moderne
- [ ] Filtres spécifiques ajoutés
- [ ] Options avancées avec switches
- [ ] Section informative ajoutée
- [ ] Design professionnel validé

### ✅ Étape 4 : Alignement Configuration
- [ ] FormScreen examiné
- [ ] Champs alignés vérifiés
- [ ] Valeurs cohérentes
- [ ] Flux testé
- [ ] Documentation mise à jour
```

---

## 🎨 Standards de Design

### Couleurs par Catégorie
- **Santé** : `#EC4899` → `#F472B6` (rose)
- **Transport** : `#06B6D4` → `#22D3EE` (cyan)
- **Voyage** : `#06B6D4` → `#22D3EE` (cyan)
- **Immobilier** : `#8B5CF6` → `#A78BFA` (violet)
- **Éducation** : `#3B82F6` → `#60A5FA` (bleu)
- **Marchandise** : `#10B981` → `#34D399` (vert)
- **Automobile** : `#EF4444` → `#F87171` (rouge)
- **Assurance** : `#14B8A6` → `#2DD4BF` (turquoise)

### Composants Réutilisables
- `LinearGradient` pour headers
- `SafeIcon` pour icônes
- `NativeInput`, `NativeButton` pour formulaires
- `ModernGPSModal` pour sélection GPS
- `SafeNativeView` pour safe area

### Patterns de Recherche Rapide
Chaque service doit avoir 3-4 recherches rapides :
1. **Plus proche** : Distance minimale, disponible maintenant
2. **Urgence** : Disponible immédiatement, distance limitée
3. **Spécifique au service** : Ex. "De garde" (pharmacie), "Urgence" (hôpital)

---

## 📚 Ressources

### Fichiers de Référence
- `mobile/src/screens/specialized/PharmacieSearchScreen.tsx` (version refondue)
- `mobile/src/screens/specialized/HealthServicesHubScreen.tsx` (hub exemple)
- `mobile/src/components/YukpoServicesQuickAccess.tsx` (icônes services)

### Backend à Examiner
- `backend/src/controllers/specialized_services_controller.rs`
- `backend/src/controllers/pharmacy_controller.rs`
- `backend/src/controllers/blood_bank_controller.rs`
- `backend/src/controllers/specialized_services_controller.rs` (hôpital, labo, etc.)

### Services Backend
- `backend/src/services/scheduling_search_service.rs` (recherche avec horaires)
- `backend/src/services/native_search_service.rs` (recherche native)
- `backend/src/services/gps_matching.rs` (matching GPS)

---

## 🚀 Ordre de Priorité Recommandé

1. ✅ **Pharmacie** (EN COURS - modèle de référence)
2. **Banque de sang** (similaire à pharmacie, urgence médicale)
3. **Hôpital** (complexité moyenne, urgence)
4. **Laboratoire** (similaire à hôpital)
5. **Immobilier** (déjà avancé, compléter)
6. **Taxi** (recherche intelligente existante)
7. **Covoiturage** (similaire à taxi)
8. **Bus/Tickets** (logique de réservation)
9. **Agence de voyage** (packages, destinations)
10. **Livre scolaire** (bourse, échange)
11. **Orientation scolaire** (hub complexe)
12. **BayamSelam** (comparatif, nouveau)
13. **Automobile** (nouveau)
14. **Assurance** (nouveau)

---

## ✅ Validation Finale

Pour chaque service refondu, vérifier :
- [ ] Design professionnel et moderne
- [ ] Tous les filtres backend disponibles dans l'UI
- [ ] Recherches rapides fonctionnelles
- [ ] Alignement avec écran de configuration
- [ ] Tests sur différents appareils
- [ ] Documentation à jour
- [ ] Pas de régression sur fonctionnalités existantes

---

**Dernière mise à jour** : 2025-01-XX
**Statut global** : 1/14 services terminés (Pharmacie)






