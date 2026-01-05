# Analyse : Redondance des données partenaire dans les écrans de formulaire

## Écrans avec PartnerSelector (4 écrans)

1. ✅ **PharmacieFormScreen** - Déjà modifié
2. ✅ **HopitalFormScreen** - Déjà modifié
3. ⏳ **LaboratoireFormScreen** - À modifier
4. ⏳ **AgenceVoyageFormScreen** - À modifier

## Écrans SANS PartnerSelector

- **TaxiFormScreen** : Pas de champ partenaire (nom_chauffeur, téléphone, etc.)
- **CovoiturageFormScreen** : Pas de champ partenaire (départ, destination, etc.)
- **ImmobilierFormScreen** : Pas de champ partenaire (détails du bien)
- **OffresEmploiFormScreen** : Pas de champ partenaire (détails de l'offre)

## Analyse de la logique

### Problème identifié
Pour un partenaire connecté (`role = 'partenaire'`), afficher ses propres informations (nom, adresse, téléphone, email) dans le formulaire est **redondant** car :
1. Il connaît déjà ces informations
2. Elles sont déjà chargées depuis `/api/partners/me`
3. Elles prennent de l'espace inutilement dans le formulaire

### Solution proposée

**Option 1 : Afficher uniquement le nom dans l'en-tête (RECOMMANDÉ)**
- Afficher le nom du partenaire dans l'en-tête de l'écran
- Masquer complètement les champs redondants (nom, adresse, téléphone, email) pour les partenaires
- Garder uniquement les champs spécifiques au service (heures, services, prestations, etc.)

**Option 2 : Champs en lecture seule**
- Afficher les champs mais en lecture seule (non éditables)
- Moins optimal car prend toujours de l'espace

**Option 3 : Section collapsible**
- Afficher les champs dans une section repliable "Informations partenaire"
- Permet de voir/modifier si nécessaire mais ne prend pas d'espace par défaut

## Champs à masquer pour les partenaires

### PharmacieFormScreen
- ❌ `nom` (affiché dans l'en-tête)
- ❌ `adresse` (chargée automatiquement)
- ❌ `telephone` (chargé automatiquement)
- ❌ `email` (chargé automatiquement)
- ✅ Garder : `quartier`, `jours_garde`, `heures_ouverture`, `services`, etc.

### HopitalFormScreen
- ❌ `nom` (affiché dans l'en-tête)
- ❌ `adresse` (chargée automatiquement)
- ❌ `telephone` (chargé automatiquement)
- ❌ `email` (chargé automatiquement)
- ✅ Garder : `type_etablissement`, `prestations_medicales`, `planning_prestations`, etc.

### LaboratoireFormScreen
- ❌ `nom` (affiché dans l'en-tête)
- ❌ `adresse` (chargée automatiquement)
- ❌ `telephone` (chargé automatiquement)
- ❌ `email` (chargé automatiquement)
- ✅ Garder : `type_laboratoire`, `analyses_disponibles`, `examination_types`, etc.

### AgenceVoyageFormScreen
- ❌ `nom_agence` (affiché dans l'en-tête)
- ❌ `adresse` (chargée automatiquement)
- ❌ `telephone` (chargé automatiquement)
- ❌ `email` (chargé automatiquement)
- ✅ Garder : `horaires`, `schedules`, `destinations`, etc.

## Implémentation recommandée

1. **En-tête avec nom du partenaire** :
   ```tsx
   {user?.role === 'partenaire' && partnerData && (
     <View style={styles.partnerHeader}>
       <Text style={styles.partnerName}>{partnerData.name}</Text>
       <Text style={styles.partnerType}>{partnerData.partner_type}</Text>
     </View>
   )}
   ```

2. **Masquer les champs redondants** :
   ```tsx
   {user?.role !== 'partenaire' && (
     <NativeInput
       label="Nom de la pharmacie *"
       value={formData.nom}
       onChangeText={(text) => setFormData({ ...formData, nom: text })}
     />
   )}
   ```

3. **Charger les données partenaire silencieusement** :
   - Charger depuis `/api/partners/me` en arrière-plan
   - Pré-remplir les champs nécessaires pour l'envoi au backend
   - Ne pas afficher ces champs dans l'UI

## Avantages

1. ✅ Interface plus claire et moins encombrée
2. ✅ Focus sur les informations spécifiques au service
3. ✅ Moins de confusion pour le partenaire
4. ✅ Meilleure UX

