# 📋 Résumé - Analyse des Anomalies de Coûts GCP

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Solde actuel** : 64 488,94 $US

---

## 🔍 Source Probable Identifiée

### **Google Places API (Autocomplete Frontend)** ⚠️ **TRÈS PROBABLE**

**Problème** :
- L'autocomplete Google Places est appelé à **chaque frappe** de l'utilisateur dans le frontend mobile
- Pas de limite de quota configurée
- Pas de cache côté frontend
- Beaucoup d'utilisateurs = beaucoup d'appels

**Calcul estimatif** :
```
Scénario réaliste:
- 10,000 utilisateurs actifs/mois
- Chaque utilisateur fait 10 recherches de lieu
- Chaque recherche = 15 frappes (autocomplete)
- Total: 10,000 × 10 × 15 = 1,500,000 appels/mois
- Coût: (1,500,000 - 11,765) × $0.017 = $25,300/mois

Si accumulation sur 2-3 mois: 64k$ est possible
```

**Fichiers concernés** :
- `mobile/src/components/ModernGPSModal.tsx` (ligne 211)
- `mobile/src/components/LocationSelector.tsx` (ligne 578)
- `mobile/src/services/hotelPlacesService.ts`
- `mobile/src/services/healthPlacesService.ts`

---

## 📊 Actions Immédiates

### 1. Télécharger les Rapports de Facturation

**URL directe** :
```
https://console.cloud.google.com/billing/reports?project=738929393617
```

**Étapes** :
1. Aller sur l'URL ci-dessus
2. Sélectionner la période : **3-6 derniers mois**
3. Grouper par : **Service**, **SKU**, **Project**
4. Exporter en **CSV**
5. Analyser quel service génère le plus de coûts

### 2. Vérifier les Quotas d'Utilisation

**Places API** :
```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

**Translation API** :
```
https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas?project=738929393617
```

### 3. Vérifier si BigQuery est Utilisé

**Vérification** :
- Chercher dans le codebase : `bigquery`, `BigQuery`
- Vérifier dans Console GCP si BigQuery est utilisé
- BigQuery peut être très coûteux si utilisé

### 4. Contacter le Support Google Cloud

**Méthodes** :
1. **Console GCP** : https://console.cloud.google.com/support
2. **Email** : billing-support@google.com

**Informations à fournir** :
- Projet ID : 738929393617
- Solde actuel : 64 488,94 $US
- Source probable : Google Places API (autocomplete frontend)
- Calcul estimatif : 1,500,000+ appels/mois possibles
- Demande : Annulation facture + Explication utilisation + Protections

**Template de demande** : Voir `CONTACT_SUPPORT_GOOGLE_CLOUD_ANOMALIES_COUTS.md`

---

## 🔧 Optimisations à Mettre en Place

### 1. Augmenter le Debounce de l'Autocomplete

**Fichiers à modifier** :
- `mobile/src/components/ModernGPSModal.tsx`
- `mobile/src/components/LocationSelector.tsx`

**Changement** :
```typescript
// Changer de 300ms à 500ms ou 1000ms
const debounceTime = 1000; // Au lieu de 300
```

### 2. Limiter les Appels Places API

**Option A** : Ne pas appeler si moins de 3 caractères
```typescript
if (query.length < 3) {
    return; // Ne pas appeler l'API
}
```

**Option B** : Mettre en cache les résultats
```typescript
const cache = new Map<string, string[]>();
```

**Option C** : Désactiver temporairement l'autocomplete frontend
```typescript
// Utiliser uniquement le backend (moins d'appels)
```

### 3. Configurer des Budgets et Alertes

**URL** :
```
https://console.cloud.google.com/billing/budgets?project=738929393617
```

**Configuration** :
- Budget mensuel : $50-100
- Alerte à 80% du budget
- Blocage automatique à 100%

### 4. Configurer des Quotas

**Places API** :
- Limiter les requêtes/jour
- Configurer des alertes

**Translation API** :
- Limiter les caractères/mois
- Configurer des alertes

---

## 📁 Fichiers Générés

1. **`CONTACT_SUPPORT_GOOGLE_CLOUD_ANOMALIES_COUTS.md`** - Guide complet pour contacter le support
2. **`ANALYSE_SOURCE_ANOMALIES_COUTS.md`** - Analyse détaillée des sources probables
3. **`billing-support-info/support-info_*.txt`** - Informations collectées sur les ressources
4. **`scripts/collect-billing-info-for-support.ps1`** - Script de collecte d'informations
5. **`scripts/download-billing-reports.ps1`** - Script pour télécharger les rapports

---

## ✅ Checklist

- [ ] Télécharger les rapports de facturation depuis Console GCP
- [ ] Analyser les coûts par service/API
- [ ] Vérifier les quotas Places API
- [ ] Vérifier les quotas Translation API
- [ ] Vérifier si BigQuery est utilisé
- [ ] Identifier la source principale des coûts
- [ ] Contacter le support avec toutes ces informations
- [ ] Optimiser l'utilisation Places API (debounce, cache, limites)
- [ ] Configurer des budgets et alertes
- [ ] Configurer des quotas

---

## 🎯 Conclusion

La source la plus probable des anomalies de coûts est **Google Places API** utilisé dans l'autocomplete frontend, qui peut générer des millions d'appels si beaucoup d'utilisateurs. Il est crucial de :

1. **Télécharger les rapports de facturation** pour confirmer
2. **Contacter le support Google Cloud** avec ces informations
3. **Mettre en place des protections** (budgets, quotas, optimisations)

**Priorité** : **URGENTE** - Contacter le support rapidement pour maximiser les chances d'obtenir une annulation.


