# 📍 Accès à l'interface de gestion des horaires d'agence

## 🎯 Situation actuelle

**❌ Interface dédiée n'existe pas encore**

L'interface pour gérer les horaires de départ par ville/agence n'a pas encore été créée côté frontend/mobile.

## 🔧 Où créer l'interface ?

### Option 1 : Dans le panneau agence existant (RECOMMANDÉ)

**Emplacement suggéré** : 
- **Frontend** : `/frontend/src/pages/agency/` ou `/frontend/src/components/agency/`
- **Mobile** : `/mobile/src/screens/agency/` ou `/mobile/src/screens/specialized/`

**Intégration** : Ajouter un onglet/section "Horaires de départ" dans :
- La page de gestion des tickets bus de l'agence
- Le panneau de configuration de l'agence de voyage

### Option 2 : Page dédiée

**Route suggérée** :
- Frontend : `/agency/schedules` ou `/agence-voyage/horaires`
- Mobile : Écran `AgencyScheduleManagementScreen.tsx`

## 📋 Fonctionnalités à implémenter

### Pour les agences (interface de gestion)

1. **Liste des horaires existants**
   - Afficher tous les horaires par trajet (ville → ville)
   - Filtrer par ville de départ/arrivée
   - Filtrer par jour de la semaine
   - Activer/désactiver un horaire

2. **Créer un horaire**
   - Sélectionner ville de départ (avec Google Places)
   - Sélectionner ville d'arrivée (avec Google Places)
   - Ajouter plusieurs horaires (ex: ["08:00", "14:00", "20:00"])
   - Optionnel : Spécifier un jour de la semaine (sinon = tous les jours)
   - Notes optionnelles

3. **Modifier un horaire**
   - Modifier les horaires disponibles
   - Changer le jour de la semaine
   - Modifier les notes

4. **Supprimer un horaire**
   - Soft delete (is_active = FALSE)

### Pour les utilisateurs (sélection lors du paiement)

1. **Afficher horaires disponibles**
   - Lors du paiement aller-retour
   - Filtrer par date de retour souhaitée
   - Afficher uniquement les horaires de l'agence du bus aller

2. **Sélection heure retour**
   - Dropdown/liste des horaires disponibles
   - Validation que l'heure choisie existe dans les horaires de l'agence

## 🔌 APIs disponibles

### Backend (déjà implémenté)

1. **GET** `/api/bus-tickets/agencies/{agency_id}/schedules?from={city}&to={city}&date={date}`
   - **PUBLIQUE** - Récupère les horaires disponibles pour un trajet
   - Utilisé lors du paiement pour afficher les horaires

2. **POST** `/api/bus-tickets/agencies/schedules` (Protégé JWT)
   - Créer un horaire
   - Requiert : `departure_city`, `arrival_city`, `departure_times[]`, `day_of_week?`, `notes?`

3. **GET** `/api/bus-tickets/agencies/schedules` (Protégé JWT)
   - Liste tous les horaires de l'agence connectée
   - Filtres : `departure_city?`, `arrival_city?`, `day_of_week?`, `is_active?`

4. **PUT** `/api/bus-tickets/agencies/schedules/{schedule_id}` (Protégé JWT)
   - Modifier un horaire

5. **DELETE** `/api/bus-tickets/agencies/schedules/{schedule_id}` (Protégé JWT)
   - Désactiver un horaire

## 📝 Exemple d'utilisation

### Créer un horaire (agence)

```typescript
const createSchedule = async () => {
  const response = await fetch('/api/bus-tickets/agencies/schedules', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      departure_city: 'Douala',
      arrival_city: 'Yaoundé',
      departure_times: ['08:00', '14:00', '20:00'],
      day_of_week: null, // Tous les jours
      notes: 'Horaires réguliers'
    })
  });
};
```

### Récupérer horaires disponibles (utilisateur)

```typescript
const getAvailableTimes = async (agencyId: number, from: string, to: string, date?: string) => {
  const url = `/api/bus-tickets/agencies/${agencyId}/schedules?from=${from}&to=${to}${date ? `&date=${date}` : ''}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.available_times; // [{ time: "08:00", day_of_week: null, is_specific_day: false }, ...]
};
```

## 🎨 Composants à créer

### Frontend
- `AgencyScheduleManager.tsx` - Gestion complète des horaires
- `ScheduleForm.tsx` - Formulaire création/modification
- `ScheduleList.tsx` - Liste des horaires avec filtres
- `AvailableTimesSelector.tsx` - Sélecteur d'heure pour paiement

### Mobile
- `AgencyScheduleManagementScreen.tsx` - Écran principal
- `CreateScheduleScreen.tsx` - Création horaire
- `ScheduleTimePicker.tsx` - Sélecteur d'heure

## ✅ Prochaines étapes

1. Créer l'interface de gestion des horaires pour les agences
2. Intégrer le sélecteur d'heure dans le formulaire de paiement aller-retour
3. Tester le flux complet : création horaire → paiement → matching

