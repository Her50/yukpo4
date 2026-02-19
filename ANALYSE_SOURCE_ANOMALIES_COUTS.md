# 🔍 Analyse de la Source des Anomalies de Coûts

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Solde actuel** : 64 488,94 $US

---

## 📊 APIs Google Utilisées dans l'Application

### 1. Google Places API (Places API New)

#### Utilisation Backend
- **Fichier** : `backend/src/services/google_places_service.rs`
- **Endpoint** : `https://places.googleapis.com/v1/places:searchText`
- **Appels** :
  - Création de service : 1 appel/service créé
  - Enrichissement lieu : 1-2 appels/service
  - **Fréquence** : ~1-2 appels par service créé

#### Utilisation Frontend Mobile
- **Fichiers** :
  - `mobile/src/components/ModernGPSModal.tsx` (ligne 211)
  - `mobile/src/components/LocationSelector.tsx` (ligne 578)
  - `mobile/src/services/hotelPlacesService.ts`
  - `mobile/src/services/healthPlacesService.ts`

- **Appels** :
  - **Autocomplete** : Appel à **chaque frappe** de l'utilisateur (avec debounce 300ms)
  - **Fréquence** : Potentiellement **très élevée** si beaucoup d'utilisateurs

#### ⚠️ RISQUE IDENTIFIÉ : Autocomplete Frontend

**Problème potentiel** :
```
Si 1000 utilisateurs tapent 10 caractères chacun pour rechercher un lieu:
- 10,000 appels Places API
- Coût: 10,000 × $0.017 = $170 (après $200 gratuit/mois)
```

**Si 10,000 utilisateurs** :
- 100,000 appels = **$1,700**
- Si chaque utilisateur fait plusieurs recherches = **coûts exponentiels**

#### Coûts Places API
- **Gratuit** : $200/mois (environ 11,765 requêtes)
- **Au-delà** : $0.017 par requête
- **Estimation** : Variable selon usage

---

### 2. Google Translation API

#### Utilisation Backend
- **Fichier** : `backend/src/services/creer_service.rs` (ligne 6524)
- **Endpoint** : `https://translation.googleapis.com/language/translate/v2`
- **Appels** :
  - Traduction texte en anglais : 1 appel/traduction
  - Appelé lors création de service
  - **Fréquence** : ~1 appel par service créé

#### Coûts Translation API
- **Gratuit** : 500,000 caractères/mois
- **Au-delà** : $20 par million de caractères
- **Estimation** : Probablement faible si seulement pour traductions de services

---

### 3. Autres Services GCP Actifs

#### Cloud Run
- **Service** : `yukpo-backend`
- **Coût** : Facturé par CPU/mémoire utilisée
- **Risque** : Moyen (si beaucoup de requêtes)

#### Cloud SQL
- **Instances** : 2 instances (db-f1-micro)
- **Coût** : **Gratuit** normalement (niveau f1-micro)
- **Risque** : **Faible** (ne devrait pas générer de coûts)

#### Cloud Storage
- **Bucket** : `yukpo-project-yukpo-backend-media`
- **Coût** : Facturé par stockage/transfert
- **Risque** : Moyen (si beaucoup de fichiers/transferts)

#### BigQuery (41 APIs activées)
- **Risque** : **ÉLEVÉ** si utilisé (BigQuery peut être très coûteux)
- **Vérification** : Vérifier si BigQuery est utilisé dans l'application

---

## 🎯 Analyse des Sources Probables

### Source #1 : Google Places API (Autocomplete Frontend) ⚠️ **TRÈS PROBABLE**

**Indices** :
- Autocomplete appelé à chaque frappe utilisateur
- Pas de limite de quota configurée
- Pas de cache côté frontend
- Beaucoup d'utilisateurs = beaucoup d'appels

**Calcul estimatif** :
```
Scénario conservateur:
- 5,000 utilisateurs actifs/mois
- Chaque utilisateur fait 5 recherches de lieu
- Chaque recherche = 10 frappes (autocomplete)
- Total: 5,000 × 5 × 10 = 250,000 appels/mois
- Coût: (250,000 - 11,765) × $0.017 = $4,050/mois

Scénario réaliste:
- 10,000 utilisateurs actifs/mois
- Chaque utilisateur fait 10 recherches
- Chaque recherche = 15 frappes
- Total: 10,000 × 10 × 15 = 1,500,000 appels/mois
- Coût: (1,500,000 - 11,765) × $0.017 = $25,300/mois
```

**Si accumulation sur plusieurs mois** : **64k$ est possible**

### Source #2 : BigQuery ⚠️ **À VÉRIFIER**

**Indices** :
- 41 APIs activées incluant BigQuery
- BigQuery peut être très coûteux si utilisé
- Pas de vérification d'utilisation dans le code

**Action** : Vérifier si BigQuery est utilisé dans l'application

### Source #3 : Cloud Run (Scaling) ⚠️ **MOYEN**

**Indices** :
- Service Cloud Run actif
- Facturé par CPU/mémoire
- Si beaucoup de requêtes = scaling = coûts

**Action** : Vérifier les métriques Cloud Run

### Source #4 : Cloud Storage (Transfert) ⚠️ **MOYEN**

**Indices** :
- Bucket actif
- Facturé par transfert de données
- Si beaucoup de téléchargements = coûts

**Action** : Vérifier les métriques Cloud Storage

---

## 🔧 Actions Immédiates

### 1. Télécharger les Rapports de Facturation

```powershell
.\scripts\download-billing-reports.ps1
```

Puis exporter manuellement depuis :
- https://console.cloud.google.com/billing/reports?project=738929393617

### 2. Analyser les Coûts par Service

Dans Console GCP :
1. **Billing** → **Reports**
2. **Grouper par** : Service, SKU, Project
3. **Période** : 3-6 derniers mois
4. **Exporter** en CSV

### 3. Vérifier les Quotas d'Utilisation

- **Places API** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
- **Translation API** : https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas?project=738929393617

### 4. Optimiser l'Utilisation Places API

#### Option A : Augmenter le Debounce
```typescript
// Dans ModernGPSModal.tsx et LocationSelector.tsx
// Changer de 300ms à 500ms ou 1000ms
const debounceTime = 1000; // Au lieu de 300
```

#### Option B : Limiter les Appels
```typescript
// Ne pas appeler si moins de 3 caractères
if (query.length < 3) {
    return; // Ne pas appeler l'API
}
```

#### Option C : Mettre en Cache
```typescript
// Cache les résultats d'autocomplete
const cache = new Map<string, string[]>();
```

#### Option D : Désactiver Temporairement
```typescript
// Désactiver l'autocomplete Google Places côté frontend
// Utiliser uniquement le backend (moins d'appels)
```

### 5. Configurer des Budgets et Alertes

1. **Billing** → **Budgets & alerts**
2. **Créer un budget** :
   - Montant : $50-100/mois
   - Alerte à 80%
   - Blocage à 100%

### 6. Configurer des Quotas

1. **APIs & Services** → **Quotas**
2. **Places API** :
   - Limiter les requêtes/jour
   - Configurer des alertes
3. **Translation API** :
   - Limiter les caractères/mois
   - Configurer des alertes

---

## 📝 Informations pour le Support Google Cloud

### À Mentionner dans la Demande

1. **Source probable identifiée** : Google Places API (autocomplete frontend)
2. **Calcul estimatif** : 1,500,000+ appels/mois possibles
3. **Coût estimé** : $25,000+/mois si non limité
4. **Problème** : Pas de limite de quota configurée
5. **Demande** : 
   - Annulation de la facture
   - Explication détaillée de l'utilisation
   - Mise en place de protections

### Preuves à Fournir

1. Rapports de facturation (CSV exporté)
2. Quotas d'utilisation Places API
3. Code source montrant l'utilisation (autocomplete)
4. Estimation du nombre d'utilisateurs

---

## ✅ Checklist

- [ ] Télécharger les rapports de facturation détaillés
- [ ] Analyser les coûts par service/API
- [ ] Vérifier les quotas Places API
- [ ] Vérifier les quotas Translation API
- [ ] Vérifier si BigQuery est utilisé
- [ ] Vérifier les métriques Cloud Run
- [ ] Vérifier les métriques Cloud Storage
- [ ] Identifier la source principale des coûts
- [ ] Optimiser l'utilisation Places API (debounce, cache, limites)
- [ ] Configurer des budgets et alertes
- [ ] Configurer des quotas
- [ ] Contacter le support avec toutes ces informations

---

**Conclusion** : La source la plus probable des anomalies de coûts est **Google Places API** utilisé dans l'autocomplete frontend, qui peut générer des millions d'appels si beaucoup d'utilisateurs. Il est crucial de télécharger les rapports de facturation pour confirmer et contacter le support Google Cloud avec ces informations.


