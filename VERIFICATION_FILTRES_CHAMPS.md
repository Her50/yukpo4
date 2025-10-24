# VÉRIFICATION CORRESPONDANCE FILTRES ↔ CHAMPS FORMULAIRES

## 🏨 HOTELLERIE

### Champs Formulaire (ProductManagerMobile)
- ✅ `typeHebergement` (types)
- ✅ `categorieHotel` (categories) → Étoiles 1-5, Palace
- ❌ `prixParNuit` (nombre)
- ❌ `nbChambresHotel` (nombre)
- ✅ `typesChambre` (chambres) - multiselect
- ✅ `equipementsHotel` (equipements) - multiselect
- `adresseHotel`, `villeHotel`, `gpsHotel`

### Filtres categoryConfig ACTUELS
- ✅ `typeHebergement` → MATCH
- ✅ `etoiles` → MATCH (categorieHotel)
- ❌ `nbPersonnes` → MISMATCH (devrait être nbChambresHotel)
- ✅ `services` → MATCH (equipementsHotel)

**ACTION: Corriger nbPersonnes → nbChambres**

---

## 🍽️ RESTAURATION

### Champs Formulaire
- ✅ `typeCuisine` (types_cuisine)
- ✅ `specialites` (specialites) - multiselect
- ✅ `servicesRestau` (services) - multiselect
- ❌ `ambiance` (ambiances)
- ❌ `gammePrix` (gammes_prix)
- ❌ `capacite` (nombre)
- ❌ `horaires` (texte)
- `certificationsRestau`, `optionsAlimentaires`

### Filtres categoryConfig ACTUELS
- ❌ `typeRestaurant` → MISMATCH (devrait être typeCuisine)
- ❌ `cuisineType` → DUPLICATION (c'est typeCuisine)
- ❌ `livraison` → ABSENT du formulaire
- ❌ `terrasse` → ABSENT du formulaire

**ACTION: Remplacer par specialites, servicesRestau, gammePrix, capacite**

---

## 💪 SPORT & FITNESS

### Champs Formulaire
- ✅ `typeSport` (types)
- ✅ `niveauSport` (niveaux)
- ✅ `dureeSport` (durees)
- ❌ `equipementsSport` (equipements)
- ❌ `frequenceSport` (frequences)
- ❌ `nbSeances` (nombre)

### Filtres categoryConfig ACTUELS
- ✅ `typeSport` → MATCH
- ✅ `niveau` → MATCH (niveauSport)
- ❌ `coaching` → ABSENT du formulaire

**ACTION: Ajouter duree, equipements, frequence**

---

## 🎓 FORMATION & ÉDUCATION

### Champs Formulaire
- ✅ `typeFormation` (types)
- ✅ `niveauFormation` (niveaux)
- ✅ `modeFormation` (modes)
- ❌ `dureeFormation` (durees)
- ❌ `langueFormation` (langues)
- ❌ `certificationFormation` (certifications)
- ❌ `horairesFormation` (texte)

### Filtres categoryConfig ACTUELS
- ❌ `domaine` → MISMATCH (devrait être typeFormation)
- ✅ `format` → MATCH (modeFormation)
- ✅ `certification` → MATCH

**ACTION: Remplacer domaine → typeFormation, ajouter niveau, duree**

---

## 🎉 ÉVÉNEMENTIEL

### Champs Formulaire
- ✅ `typeEvenement` (types)
- ✅ `servicesEvenement` (services) - multiselect
- ❌ `capaciteEvenement` (nombre)
- ❌ `dureeEvenement` (durees)
- ❌ `lieuEvenement` (lieux)
- ❌ `equipementsEvenement` (equipements)

### Filtres categoryConfig ACTUELS
- ✅ `typeEvenement` → MATCH
- ✅ `nbPersonnes` → MATCH (capaciteEvenement)

**ACTION: Ajouter servicesEvenement, duree, lieu, equipements**

---

## RÉSUMÉ CORRECTIONS NÉCESSAIRES

### Priorité HAUTE (filtres incorrects)
1. **hotellerie**: nbPersonnes → nbChambres
2. **restauration**: Refonte complète (typeCuisine, specialites, services)
3. **formation_education**: domaine → typeFormation
4. **sport_fitness**: Ajouter duree, frequence

### Priorité MOYENNE (filtres manquants)
5. Ajouter filtres pour les 10+ catégories restantes

