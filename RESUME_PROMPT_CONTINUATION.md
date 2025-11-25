# Résumé Prompt de Continuation

## 📄 Document Principal
**Fichier** : `PROMPT_CONTINUATION_TICKETS_BUS.md`

## 🎯 Contenu du Prompt

### 1. Contexte Complet
- Architecture application Yukpomnang
- Services spécialisés (Santé et Transport)
- **Contraintes SQLx offline mode** ⚠️
- Intégration auto_migrate.rs et 0000_create_all_tables.sql

### 2. Tickets Bus (Partie 1)
- ✅ Backend complété (100%)
- ⚠️ Mobile partiellement complété :
  - BusSeatSelector à créer
  - handleSubmit à compléter
  - AgenceVoyageResultCard à améliorer

### 3. Banque de Sang (Partie 2)

#### 3.1 Améliorations de Base
- ✅ Backend complété (100%)
- ⚠️ Mobile nécessite :
  - Gestion stocks détaillée avec indicateurs visuels
  - **Intégration OrderDeliveryModal (livraison intelligente)** ⚠️
  - Intégration ChatModalMobile
  - Amélioration BanqueSangFormScreen

#### 3.2 Système Intelligent Matching 🚨 PRIORITÉ CRITIQUE
- Tables SQL : `blood_donation_requests`, `user_blood_groups`, `blood_donation_matches`
- Fonctions SQL : `find_potential_blood_donors`, `create_blood_donation_request`
- Contrôleur Rust : `blood_donation_matching_controller.rs`
- Notifications push avec son d'alerte
- Capturer position GPS temps réel
- Composant `BloodDonationAlertModal`
- Gestion groupe sanguin utilisateur

### 4. Pharmacies
- ⚠️ **Intégration OrderDeliveryModal (livraison intelligente)** ⚠️
- Intégration ChatModalMobile (optionnel)

---

## 🔑 Points Critiques Documentés

### Livraison Intelligente Yukpo
- **Pharmacies** : Bouton "Livraison" dans `PharmacieResultCard`
- **Banques de Sang** : Bouton "Livraison" dans `BloodBankResultCard`
- Utiliser `OrderDeliveryModal` avec `serviceId` uniquement
- Même système que `ProductCard`

### Système Intelligent Banque de Sang
- Alerte automatique si aucun stock disponible
- Recherche donneurs dans rayon 5km
- Notification push avec son
- Contact direct demandeur ↔ donneur
- Position GPS temps réel

### Contraintes Migrations
- ⚠️ SQLx offline mode (pas de SELECT retournant résultats)
- ⚠️ Intégration auto_migrate.rs obligatoire
- ⚠️ Intégration 0000_create_all_tables.sql obligatoire

---

## 📋 Checklist Complète dans le Prompt

- Tickets Bus : 8 tâches
- Banque de Sang - Base : 5 tâches
- Banque de Sang - Intelligent : 7 tâches
- Pharmacies : 3 tâches

**Total** : 23 tâches détaillées avec étapes précises

---

**Le prompt est prêt pour continuation dans une autre session** ✅

