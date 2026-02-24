# ✅ Vérification des Étapes - Réponse à Andrew

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Nouvelle clé API** : `AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo`

---

## 📋 Checklist des Étapes

### 1. ✅ Créer une nouvelle clé API avec restrictions d'application

**Statut** : ✅ **FAIT** (si vous avez créé la clé dans Google Cloud Console)

**Vérification requise** :
- [ ] Aller sur : https://console.cloud.google.com/apis/credentials?project=738929393617
- [ ] Vérifier que la clé `AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo` existe
- [ ] Vérifier les restrictions d'application :
  - [ ] Android : Package name `com.yukpomnang.mobile` + SHA-1 debug
  - [ ] iOS : Bundle ID `com.yukpomnang.mobile`
- [ ] Vérifier les restrictions d'API : Places API (New) uniquement

**Si pas encore fait** : Suivre le guide `GUIDE_CREER_NOUVELLE_CLE_API_RESTRICTIONS.md`

---

### 2. ✅ Mettre à jour le code avec la nouvelle clé API

**Statut** : ✅ **FAIT**

**Fichiers mis à jour** :
- ✅ `mobile/eas.json` (lignes 22-23, 58-59) - Preview et Production
- ✅ `mobile/src/config/environment.ts` (ligne 7) - Clé en dur retirée
- ✅ `mobile/app.config.js` (lignes 118, 193-194) - Utilise variables d'environnement
- ✅ `mobile/android/app/src/main/AndroidManifest.xml` (ligne 27) - Nouvelle clé
- ✅ `mobile/production (7).json` (lignes 6-7) - Nouvelle clé

**Vérification** :
```bash
# Vérifier que la nouvelle clé est présente
grep -r "AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo" mobile/
```

---

### 3. ⚠️ Tester la nouvelle clé API

**Statut** : ⚠️ **À FAIRE**

**Actions requises** :
1. **Tester localement** :
   ```bash
   cd mobile
   npm start
   ```
2. **Tester l'autocomplete** :
   - Ouvrir l'application
   - Tester la recherche de lieu (autocomplete)
   - Vérifier qu'il n'y a pas d'erreurs "API key not valid"
   - Vérifier qu'il n'y a pas d'erreurs "API key restricted"

**Résultat attendu** : L'autocomplete fonctionne normalement sans erreurs

---

### 4. ⚠️ Supprimer l'ancienne clé API compromise

**Statut** : ⚠️ **À FAIRE** (dans Google Cloud Console)

**Actions requises** :
1. **Aller sur** : https://console.cloud.google.com/apis/credentials?project=738929393617
2. **Trouver** la clé : `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ`
3. **Cliquer sur** l'icône "Delete" (poubelle) à côté de la clé
4. **Confirmer** la suppression

**⚠️ IMPORTANT** : Ne supprimer l'ancienne clé QUE APRÈS avoir testé la nouvelle !

---

### 5. ⚠️ Configurer les quotas et caps quotidiens

**Statut** : ⚠️ **À FAIRE** (voir guide ci-dessous)

**Actions requises** : Voir le guide détaillé dans la section suivante

---

## 🔧 Guide : Configurer les Quotas Places API

### URL Directe

```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

### Étapes Détaillées

#### Étape 1 : Accéder à la page des Quotas

**Option A : URL Directe (RECOMMANDÉ)**
1. Cliquez sur ce lien : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617

**Option B : Navigation Manuelle**
1. Aller dans Google Cloud Console
2. Menu ☰ → **APIs & Services** → **Enabled APIs**
3. Chercher **"Places API (New)"** ou **"places-backend.googleapis.com"**
4. Cliquer sur **"Places API (New)"**
5. Cliquer sur l'onglet **"Quotas"**

#### Étape 2 : Configurer "Requests per day" (Requêtes par jour)

1. **Chercher** dans la liste : **"Requests per day"** ou **"Requêtes par jour"**
2. **Cocher la case** à gauche de "Requests per day"
3. **Cliquer sur** **"EDIT QUOTAS"** (en haut de la page) ou **"Modifier les quotas"**
4. **Dans le formulaire** :
   - **Nouvelle limite** : `50000` (50,000)
   - **Justification** :
     ```
     Limitation pour éviter les coûts excessifs suite à un bug de code.
     Application en développement avec un seul testeur.
     ```
5. **Cliquer sur** **"SUBMIT REQUEST"** ou **"Soumettre la demande"**

**⚠️ Note** : La demande peut nécessiter une approbation de Google (quelques jours)

#### Étape 3 : Configurer "Requests per minute" (Requêtes par minute)

1. **Chercher** : **"Requests per minute"** ou **"Requêtes par minute"**
2. **Cocher la case** à gauche
3. **Cliquer sur** **"EDIT QUOTAS"**
4. **Dans le formulaire** :
   - **Nouvelle limite** : `100` (100)
   - **Justification** : Même que ci-dessus
5. **Cliquer sur** **"SUBMIT REQUEST"**

#### Étape 4 : Configurer "Requests per 100 seconds" (Optionnel mais recommandé)

1. **Chercher** : **"Requests per 100 seconds"**
2. **Cocher la case** à gauche
3. **Cliquer sur** **"EDIT QUOTAS"**
4. **Dans le formulaire** :
   - **Nouvelle limite** : `200` (200)
   - **Justification** : Même que ci-dessus
5. **Cliquer sur** **"SUBMIT REQUEST"**

#### Étape 5 : Activer le Cap Quotidien (Daily Usage Cap)

**⚠️ IMPORTANT** : Le "Daily Usage Cap" est différent des quotas. Il limite les coûts.

1. **Aller sur** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
2. **Chercher** : **"Daily usage cap"** ou **"Cap d'utilisation quotidien"**
3. **Si disponible** : Activer et configurer

**OU** via Budgets (méthode alternative) :
- Aller sur : https://console.cloud.google.com/billing/budgets?project=738929393617
- Créer un budget avec limite quotidienne

---

## 📊 Résumé des Quotas à Configurer

| Quota | Limite Recommandée | Statut |
|-------|-------------------|--------|
| Requests per day | 50,000 | ⚠️ À configurer |
| Requests per minute | 100 | ⚠️ À configurer |
| Requests per 100 seconds | 200 | ⚠️ Optionnel |
| Daily usage cap | Activer | ⚠️ À vérifier |

---

## ✅ Actions Immédiates

1. **Tester la nouvelle clé** (étape 3)
2. **Configurer les quotas** (étape 5) - Guide ci-dessus
3. **Supprimer l'ancienne clé** (étape 4) - APRÈS avoir testé
4. **Envoyer la réponse à Andrew** - Une fois tout terminé

---

## 📧 Message Final à Envoyer

Une fois toutes les étapes terminées, vous pouvez envoyer le message dans `REPONSE_ANDREW_CLE_API_CREEE.txt` à Andrew.

**Vérification avant envoi** :
- [ ] Nouvelle clé créée avec restrictions ✅
- [ ] Code mis à jour ✅
- [ ] Nouvelle clé testée ⚠️
- [ ] Ancienne clé supprimée ⚠️
- [ ] Quotas configurés ⚠️

---

**Date de mise à jour** : 2026-02-19

