# 💰 Configuration Budgets et Alertes GCP

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Objectif** : Protéger contre les coûts excessifs

---

## 🎯 URLs Directes

### Budgets et Alertes
```
https://console.cloud.google.com/billing/budgets?project=738929393617
```

### Créer un Budget
```
https://console.cloud.google.com/billing/budgets/create?project=738929393617
```

---

## 📋 Configuration d'un Budget

### Étape 1 : Accéder aux Budgets

1. **Aller sur** : https://console.cloud.google.com/billing/budgets?project=738929393617
2. **Ou via Console** :
   - Billing → Budgets & alerts
   - Cliquer sur "CREATE BUDGET" ou "Créer un budget"

### Étape 2 : Configurer le Budget

#### Informations de Base

1. **Nom du budget** : `Budget Mensuel Yukpo - $100`
2. **Compte de facturation** : Sélectionner `yukpo` (ou votre compte)
3. **Période** : `Monthly` (Mensuel)
4. **Montant** : `100` USD

#### Filtres (Optionnel)

**Pour limiter au projet spécifique** :
- **Filtre** : Project
- **Valeur** : `yukpo-project` (738929393617)

**Pour limiter aux APIs Google Maps** :
- **Filtre** : Service
- **Valeur** : `Places API (New)` ou `places-backend.googleapis.com`

### Étape 3 : Configurer les Alertes

#### Alerte 1 : À 50% du Budget

1. **Pourcentage** : `50%`
2. **Montant** : `$50`
3. **Notifications** :
   - **Email** : Votre email
   - **Optionnel** : Webhook, SMS
4. **Cocher** : "Send alert email"

#### Alerte 2 : À 80% du Budget

1. **Pourcentage** : `80%`
2. **Montant** : `$80`
3. **Notifications** : Même email
4. **Cocher** : "Send alert email"

#### Alerte 3 : À 100% du Budget (CRITIQUE)

1. **Pourcentage** : `100%`
2. **Montant** : `$100`
3. **Notifications** : Même email
4. **Cocher** : "Send alert email"
5. **⚠️ IMPORTANT** : Si disponible, activer "Disable billing" ou "Stop services"

### Étape 4 : Sauvegarder

1. **Cliquer sur** "CREATE" ou "Créer"
2. **Vérifier** que le budget est créé
3. **Vérifier** que les alertes sont actives

---

## 🔔 Configuration d'Alertes Supplémentaires

### Alerte Quotidienne (Optionnel)

**Pour surveiller les coûts quotidiens** :

1. **Créer un budget quotidien** : `$5/jour` (environ $150/mois)
2. **Alertes** :
   - À 50% : $2.50
   - À 80% : $4
   - À 100% : $5

### Alerte par Service (Optionnel)

**Pour surveiller spécifiquement Places API** :

1. **Créer un budget** : `$50/mois` pour Places API uniquement
2. **Filtre** : Service = `Places API (New)`
3. **Alertes** :
   - À 50% : $25
   - À 80% : $40
   - À 100% : $50

---

## 📊 Calcul des Montants Recommandés

### Budget Mensuel : $100

**Justification** :
- **Places API** : $200 gratuit/mois (11,765 requêtes)
- **Au-delà** : $0.017/requête
- **50,000 requêtes/mois** = (50,000 - 11,765) × $0.017 = **$650**
- **Budget $100** = Protection contre les coûts excessifs
- **Alerte à $50** = Avertissement précoce

### Budget Quotidien : $5

**Justification** :
- **$5/jour** = $150/mois maximum
- **Protection** contre les pics quotidiens
- **Alerte précoce** si problème

---

## ✅ Vérification

### Vérifier les Budgets Configurés

1. **Retourner sur** : https://console.cloud.google.com/billing/budgets?project=738929393617
2. **Vérifier** que les budgets sont actifs
3. **Vérifier** que les alertes sont configurées
4. **Tester** : Vérifier que vous recevez les emails de notification

---

## 🎯 Résultat Attendu

Après configuration :
- ✅ Budget mensuel : $100
- ✅ Alerte à 50% : $50
- ✅ Alerte à 80% : $80
- ✅ Alerte à 100% : $100
- ✅ Protection contre les coûts excessifs
- ✅ Notifications par email

---

## ⚠️ Actions Automatiques (Si Disponibles)

### Option 1 : Désactiver les Services

Si disponible dans les options :
- **À 100% du budget** : Désactiver automatiquement Places API
- **Protection maximale** contre les coûts

### Option 2 : Limiter les Quotas

Si disponible :
- **À 80% du budget** : Réduire automatiquement les quotas
- **À 100% du budget** : Bloquer complètement les appels

---

## 📝 Notes Importantes

1. **Les budgets ne bloquent pas automatiquement** les services par défaut
2. **Les alertes sont informatives** - vous devez agir manuellement
3. **Vérifiez régulièrement** les emails d'alerte
4. **Ajustez les montants** selon vos besoins réels

---

**Note** : Les budgets et alertes sont actifs immédiatement après création.

