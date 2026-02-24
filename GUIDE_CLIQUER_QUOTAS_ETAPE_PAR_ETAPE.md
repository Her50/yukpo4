# 🖱️ Guide : Où Cliquer pour Configurer les Quotas

**Page actuelle** : Google Maps Platform → Quotas → Places API

---

## 📍 Étape 1 : Cliquer sur le Lien Bleu

**Sur la page actuelle, vous voyez :**

```
┌─────────────────────────────────────┐
│ Utilisation actuelle > 90%          │
│ 0                                    │
│ Afficher les quotas et les limites  │ ← **CLIQUEZ ICI**
│ du système                           │
└─────────────────────────────────────┘
```

**Action** : Cliquez sur le lien bleu **"Afficher les quotas et les limites du système"**

---

## 📍 Étape 2 : Voir la Liste des Quotas

Après avoir cliqué, vous verrez une **liste de quotas** comme :

- Requests per day (Requêtes par jour)
- Requests per minute (Requêtes par minute)
- Requests per 100 seconds
- etc.

---

## 📍 Étape 3 : Modifier un Quota

Pour chaque quota que vous voulez modifier :

1. **Cocher la case** à gauche du nom du quota (ex: "Requests per day")
2. **Cliquer sur le bouton "EDIT QUOTAS"** (en haut de la liste) ou **"Modifier les quotas"**
3. **Remplir le formulaire** :
   - Nouvelle limite : `50000` (pour Requests per day)
   - Justification : "Limitation pour éviter coûts excessifs suite à bug code. Application en développement avec un seul testeur."
4. **Cliquer sur "SUBMIT REQUEST"** ou **"Soumettre la demande"**

---

## 🎯 Quotas à Configurer

| Quota | Limite | Action |
|-------|--------|--------|
| **Requests per day** | 50,000 | Cocher → EDIT QUOTAS → 50000 |
| **Requests per minute** | 100 | Cocher → EDIT QUOTAS → 100 |

---

## ⚠️ Si le Lien n'Apparaît Pas

**Alternative** : Cliquez sur l'onglet **"Increase Requests"** (à côté de "Quotas & System Limits")

Ou utilisez l'URL directe :
```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

---

**Prochaine étape** : Après avoir cliqué sur le lien, vous verrez la liste des quotas à modifier.

