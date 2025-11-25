# ✅ TODO : Services Spécialisés avec Moment Systématique

## 🎯 Objectifs

1. ✅ Recherche avec "moment" systématique (NOW())
2. ✅ Accès regroupé depuis Mon Compte / Avatar
3. ✅ Deux groupes : Santé 🏥 et Transport 🚗
4. ✅ 6 services : Pharmacies, Hôpitaux, Laboratoires, Agences, Covoiturage, Taxi

---

## 📋 Tâches à Faire

### 🔴 Priorité 1 : Backend - Tables

- [ ] **Migration `20251126_create_specialized_services_tables.sql`**
  - [ ] Table `pharmacies`
  - [ ] Table `hopitaux_cliniques`
  - [ ] Table `laboratoires_imagerie`
  - [ ] Table `agences_voyage`
  - [ ] Table `covoiturages` (NOUVEAU)
  - [ ] Table `taxis_ville` (NOUVEAU)
  - [ ] Index pour recherche avec moment
  - [ ] Fonctions de calcul automatique avec NOW()

### 🔴 Priorité 2 : Backend - Recherche avec Moment

- [ ] **Service `specialized_search_service.rs`**
  - [ ] `search_pharmacies_with_moment()` - Moment systématique
  - [ ] `search_hospitals_with_moment()` - Moment systématique
  - [ ] `search_laboratories_with_moment()` - Moment systématique
  - [ ] `search_covoiturages_with_moment()` - Trajets disponibles maintenant/prochaines heures
  - [ ] `search_taxis_with_moment()` - Chauffeurs disponibles maintenant

### 🟡 Priorité 3 : Page "Mes Services Spécialisés"

- [ ] **`MesServicesSpecialisesScreen.tsx` (Mobile)**
  - [ ] Structure avec 2 groupes
  - [ ] Groupe Santé : Pharmacie, Hôpital, Laboratoire
  - [ ] Groupe Transport : Agence, Covoiturage, Taxi
  - [ ] Navigation vers formulaires
  - [ ] Styles modernes

- [ ] **`MesServicesSpecialisesPage.tsx` (Frontend)**
  - [ ] Même structure que mobile
  - [ ] Responsive design

### 🟡 Priorité 4 : Formulaires

- [ ] **PharmacieFormScreen.tsx**
- [ ] **HopitalFormScreen.tsx**
- [ ] **LaboratoireFormScreen.tsx**
- [ ] **AgenceVoyageFormScreen.tsx**
- [ ] **CovoiturageFormScreen.tsx** (NOUVEAU)
- [ ] **TaxiFormScreen.tsx** (NOUVEAU)

### 🟢 Priorité 5 : Intégration Navigation

- [ ] **ProfileScreen.tsx**
  - [ ] Ajouter menu item "Mes Services Spécialisés"
  - [ ] Icône 🏥
  - [ ] Navigation vers page

- [ ] **HomeScreen.tsx** (Optionnel)
  - [ ] Lien dans footer si nécessaire

- [ ] **HomePage.tsx** (Frontend)
  - [ ] Lien dans header dropdown

### 🟢 Priorité 6 : Recherche Enrichie

- [ ] **Modifier `native_search_service.rs`**
  - [ ] Détection type (6 types maintenant)
  - [ ] Recherche BASE toujours active
  - [ ] Recherche ENRICHISSEMENT avec moment
  - [ ] Fusion des résultats

### 🔵 Priorité 7 : Affichage

- [ ] **Composants de cards spécialisées**
  - [ ] `PharmacieResultCard.tsx`
  - [ ] `HopitalResultCard.tsx`
  - [ ] `LaboratoireResultCard.tsx`
  - [ ] `AgenceVoyageResultCard.tsx`
  - [ ] `CovoiturageResultCard.tsx` (NOUVEAU)
  - [ ] `TaxiResultCard.tsx` (NOUVEAU)

- [ ] **Modifier `ResultatBesoinScreen.tsx`**
  - [ ] Détection type de résultats
  - [ ] Affichage conditionnel selon type

---

## 📝 Notes Importantes

### Moment Systématique

**Pour TOUS les services spécialisés, le moment (NOW()) est TOUJOURS pris en compte** :

- **Pharmacies** : `is_on_duty_now` calculé avec `NOW()`
- **Hôpitaux** : `is_available_now` calculé avec `NOW()`
- **Laboratoires** : `is_available_now` calculé avec `NOW()`
- **Covoiturage** : Trajets disponibles **maintenant** ou dans les prochaines 24h
- **Taxi** : Chauffeurs disponibles **maintenant**

### Accès Regroupé

**Un seul lien** : "Mes Services Spécialisés"
- Depuis Avatar/Profil
- Depuis Mon Compte (optionnel)
- Ouvre page avec 2 groupes

### Groupes

**Groupe 1 : Santé 🏥**
- 💊 Pharmacies
- 🏥 Hôpitaux/Cliniques
- 🔬 Laboratoires/Imagerie

**Groupe 2 : Transport 🚗**
- 🚌 Agences de Voyage
- 🚗 Covoiturage
- 🚕 Taxi de Ville

---

## 🚀 Ordre d'Exécution Recommandé

1. **Créer migrations SQL** (Priorité 1)
2. **Créer service de recherche avec moment** (Priorité 2)
3. **Créer page "Mes Services Spécialisés"** (Priorité 3)
4. **Créer formulaires** (Priorité 4)
5. **Intégrer navigation** (Priorité 5)
6. **Modifier recherche enrichie** (Priorité 6)
7. **Créer composants d'affichage** (Priorité 7)

---

**Souhaitez-vous que je commence par créer la migration SQL complète avec les 6 tables ?** 🚀

