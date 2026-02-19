# 📋 Instructions Configuration Manuelle - Quotas et Budgets

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)

---

## ✅ État Actuel

### Budgets Existants
- ✅ **Budget trouvé** : "100$ Alerte de budget mensuel"
- ⚠️ **Vérifier** : Si ce budget est configuré correctement (montant, alertes, filtres)

### API Activée
- ✅ **Billing Budget API** : Activée

---

## 🔧 Configuration Manuelle Requise

### 1. Configurer les Quotas Places API

**URL Directe** :
```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

**Étapes** :

1. **Aller sur l'URL ci-dessus**

2. **Chercher "Requests per day" (Requêtes par jour)**
   - Cliquer sur **"EDIT QUOTAS"** ou **"Modifier les quotas"**
   - **Nouvelle limite** : `50000` (50,000)
   - **Justification** :
     ```
     Limitation pour éviter les coûts excessifs suite à un bug de code.
     Application en développement avec un seul testeur.
     ```
   - **Sauvegarder**

3. **Chercher "Requests per minute" (Requêtes par minute)**
   - Cliquer sur **"EDIT QUOTAS"**
   - **Nouvelle limite** : `100` (100)
   - **Justification** : Même que ci-dessus
   - **Sauvegarder**

4. **Chercher "Requests per 100 seconds"**
   - Cliquer sur **"EDIT QUOTAS"**
   - **Nouvelle limite** : `200` (200)
   - **Sauvegarder**

**⚠️ Note** : Les quotas peuvent nécessiter une demande d'approbation. Google peut prendre quelques jours pour approuver.

---

### 2. Vérifier/Configurer le Budget

**URL Directe** :
```
https://console.cloud.google.com/billing/budgets?project=738929393617
```

**Budget Existant** : "100$ Alerte de budget mensuel"

**Actions** :

1. **Vérifier le budget existant** :
   - Cliquer sur le budget "100$ Alerte de budget mensuel"
   - Vérifier :
     - ✅ Montant : $100 USD
     - ✅ Période : Mensuel
     - ✅ Filtres : Projet yukpo-project (optionnel)
     - ✅ Alertes : 50%, 80%, 100%

2. **Si le budget n'est pas correct** :
   - **Modifier** le budget existant
   - **OU** Créer un nouveau budget :
     - URL : https://console.cloud.google.com/billing/budgets/create?project=738929393617
     - Nom : "Budget Mensuel Yukpo - $100"
     - Montant : 100 USD
     - Période : Mensuel
     - Alertes : 50% ($50), 80% ($80), 100% ($100)

---

## 📊 Résumé des Configurations Recommandées

### Quotas Places API
- **Requests per day** : 50,000
- **Requests per minute** : 100
- **Requests per 100 seconds** : 200

### Budget
- **Montant** : $100/mois
- **Alertes** :
  - 50% : $50
  - 80% : $80
  - 100% : $100

---

## ✅ Vérification

### Après Configuration

1. **Vérifier les quotas** :
   - Retourner sur : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
   - Vérifier que les limites sont appliquées

2. **Vérifier le budget** :
   - Retourner sur : https://console.cloud.google.com/billing/budgets?project=738929393617
   - Vérifier que le budget est actif
   - Vérifier que les alertes sont configurées

3. **Tester les alertes** :
   - Vérifier que vous recevez les emails de notification
   - Tester avec un petit montant si possible

---

## 🎯 Résultat Attendu

Après configuration :
- ✅ Quotas Places API limités (50,000/jour, 100/minute)
- ✅ Budget mensuel : $100
- ✅ Alertes configurées (50%, 80%, 100%)
- ✅ Protection contre les coûts excessifs
- ✅ Notifications par email

---

**Note** : La configuration via console est la méthode la plus fiable car les quotas nécessitent souvent une approbation de Google.

