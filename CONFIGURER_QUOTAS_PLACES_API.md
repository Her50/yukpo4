# 🔧 Configuration Quotas Places API - GCP Console

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Objectif** : Limiter les appels Places API pour éviter les coûts excessifs

---

## 🎯 URLs Directes

### Quotas Places API
```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

### Quotas Translation API
```
https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas?project=738929393617
```

---

## 📋 Configuration des Quotas

### Étape 1 : Accéder aux Quotas Places API

1. **Aller sur** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
2. **Ou via Console** :
   - APIs & Services → Enabled APIs
   - Rechercher "Places API (New)" ou "places-backend.googleapis.com"
   - Cliquer sur "Quotas"

### Étape 2 : Configurer les Limites

#### Quota 1 : Requests per day (Requêtes par jour)

**Recommandation** : Limiter à 50,000 requêtes/jour

1. **Chercher** : "Requests per day" ou "Requêtes par jour"
2. **Cliquer sur** "EDIT QUOTAS" ou "Modifier les quotas"
3. **Nouvelle limite** : `50000` (50,000)
4. **Justification** :
   ```
   Limitation pour éviter les coûts excessifs suite à un bug de code.
   Application en développement avec un seul testeur.
   ```
5. **Sauvegarder**

#### Quota 2 : Requests per minute (Requêtes par minute)

**Recommandation** : Limiter à 100 requêtes/minute

1. **Chercher** : "Requests per minute" ou "Requêtes par minute"
2. **Cliquer sur** "EDIT QUOTAS"
3. **Nouvelle limite** : `100` (100)
4. **Justification** : Même que ci-dessus
5. **Sauvegarder**

#### Quota 3 : Requests per 100 seconds (Requêtes par 100 secondes)

**Recommandation** : Limiter à 200 requêtes/100 secondes

1. **Chercher** : "Requests per 100 seconds"
2. **Cliquer sur** "EDIT QUOTAS"
3. **Nouvelle limite** : `200` (200)
4. **Sauvegarder**

---

## 🔔 Configuration des Alertes de Quota

### Étape 1 : Créer une Alerte

1. **Dans la page Quotas**, cliquer sur "CREATE ALERT" ou "Créer une alerte"
2. **Nom** : `Places API - Alerte Quota`
3. **Condition** :
   - **Métrique** : Requests per day
   - **Seuil** : 80% (40,000 requêtes)
   - **Période** : 1 jour
4. **Notifications** :
   - **Email** : Votre email
   - **Optionnel** : Webhook, SMS
5. **Sauvegarder**

---

## 📊 Calcul des Limites Recommandées

### Pour un Usage Normal (Développement/Test)

**Scénario** : 1 testeur, quelques tests par jour

- **50,000 requêtes/jour** = ~2,083 requêtes/heure = ~35 requêtes/minute
- **100 requêtes/minute** = Protection contre les boucles infinies
- **200 requêtes/100 secondes** = Protection supplémentaire

### Si Limite Atteinte

- L'API retournera une erreur `429 Too Many Requests`
- L'application utilisera les fallbacks (base de données locale)
- Pas de coûts supplémentaires

---

## ✅ Vérification

### Vérifier les Quotas Configurés

1. **Retourner sur** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
2. **Vérifier** que les limites sont appliquées
3. **Vérifier** que les alertes sont actives

---

## 🎯 Résultat Attendu

Après configuration :
- ✅ Maximum 50,000 requêtes/jour
- ✅ Maximum 100 requêtes/minute
- ✅ Alerte à 80% (40,000 requêtes)
- ✅ Protection contre les boucles infinies
- ✅ Pas de coûts excessifs possibles

---

**Note** : Les quotas peuvent prendre quelques minutes à être appliqués.

