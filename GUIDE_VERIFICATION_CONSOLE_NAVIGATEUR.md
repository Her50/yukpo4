# 🔍 Guide : Vérification Console Navigateur & Logs Temps Réel

**Date**: 2026-02-20  
**Objectif**: Identifier pourquoi la création de prestation ne fonctionne pas

---

## 📋 Étapes de Vérification

### 1. Ouvrir la Console du Navigateur (F12)

1. **Ouvrir les outils de développement** :
   - Appuyer sur **F12** ou **Ctrl+Shift+I** (Windows/Linux)
   - Ou **Cmd+Option+I** (Mac)
   - Ou clic droit → **Inspecter**

2. **Vérifier l'onglet Console** :
   - Chercher les erreurs JavaScript (en rouge)
   - Chercher les messages de log de l'application
   - Noter toutes les erreurs affichées

3. **Vérifier l'onglet Network (Réseau)** :
   - Cliquer sur l'onglet **Network** ou **Réseau**
   - **Vider les logs** (icône 🚫 ou Ctrl+R)
   - **Réessayer de créer une prestation**
   - Chercher une requête vers `/api/services/create`

---

## 🔍 Vérifications dans l'Onglet Network

### A. Vérifier si la Requête Est Envoyée

**Chercher** :
- Une requête vers `/api/services/create`
- Méthode : **POST**
- Status : **200** (succès), **400** (erreur client), **401** (non autorisé), **403** (interdit), **500** (erreur serveur), etc.

### B. Si la Requête Apparaît

1. **Cliquer sur la requête** pour voir les détails
2. **Onglet Headers** :
   - Vérifier l'URL complète : `https://yukpo-backend-376093909298.europe-west1.run.app/api/services/create`
   - Vérifier les headers :
     - `Content-Type: application/json`
     - `Authorization: Bearer ...` (token JWT)
3. **Onglet Payload** :
   - Vérifier les données envoyées
   - Vérifier que `user_id` est présent
   - Vérifier que `data` contient les informations du service
4. **Onglet Response** :
   - Vérifier la réponse du serveur
   - Si erreur, noter le message d'erreur

### C. Si la Requête N'Apparaît Pas

**Causes possibles** :
1. **Erreur JavaScript** empêche l'envoi
2. **Validation côté frontend** bloque l'envoi
3. **Problème CORS** bloque la requête
4. **Timeout** avant l'envoi

**Actions** :
- Vérifier l'onglet Console pour les erreurs
- Vérifier les logs de l'application dans la console

---

## 🔍 Vérifications dans l'Onglet Console

### A. Erreurs JavaScript

**Chercher** :
- Messages en **rouge** (erreurs)
- Messages en **jaune** (avertissements)
- Messages contenant :
  - `Error`
  - `Failed`
  - `Network`
  - `CORS`
  - `401`
  - `403`
  - `500`

### B. Logs de l'Application

**Chercher** les logs de création de service :
- `[FormulaireYukpoIntelligent]`
- `[creerService]`
- `[Mobile API]`
- Messages de succès ou d'erreur

---

## 📊 Endpoint Utilisé par le Frontend

D'après le code source :

### Frontend Web
- **Fichier**: `frontend/src/lib/yukpoaclient.ts`
- **Fonction**: `creerService()`
- **Endpoint**: `/api/services/create`
- **Méthode**: POST
- **URL complète**: `${API_BASE_URL}/api/services/create`

### Configuration API
- **Fichier**: `frontend/src/config/api.config.ts`
- **Endpoint configuré**: `/api/services/create`
- **Base URL**: Vérifier dans `api.config.ts`

---

## 🔧 Vérification de l'URL de l'API

### 1. Vérifier la Configuration

**Fichier**: `frontend/src/config/api.config.ts`

```typescript
// Vérifier que API_BASE_URL pointe vers :
// https://yukpo-backend-376093909298.europe-west1.run.app
```

### 2. Vérifier dans le Code

**Fichier**: `frontend/src/lib/yukpoaclient.ts` (ligne 235)

```typescript
const response = await fetch(`${API_BASE_URL}/api/services/create`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    user_id: user.id,
    data: donneesStructurees,
    tokens_ia_externe: tokensIAExterne,
  }),
});
```

---

## 📝 Checklist de Vérification

### Console Navigateur
- [ ] Console ouverte (F12)
- [ ] Onglet Console vérifié (erreurs JavaScript)
- [ ] Onglet Network vérifié (requêtes HTTP)
- [ ] Requête `/api/services/create` trouvée ou non
- [ ] Status HTTP de la requête noté
- [ ] Réponse du serveur vérifiée

### Logs Temps Réel
- [ ] Commande `gcloud logging tail` lancée
- [ ] Logs observés pendant la tentative
- [ ] Requête HTTP détectée dans les logs
- [ ] Erreurs backend détectées

### Configuration
- [ ] URL de l'API vérifiée
- [ ] Token JWT présent
- [ ] Données envoyées correctes

---

## 🚨 Problèmes Courants

### Problème 1: Requête N'Apparaît Pas dans Network

**Causes** :
- Erreur JavaScript avant l'envoi
- Validation côté frontend bloque
- Problème de routage

**Solution** :
- Vérifier la console pour les erreurs
- Vérifier les validations du formulaire
- Vérifier les logs de l'application

### Problème 2: Erreur 401 (Unauthorized)

**Causes** :
- Token JWT manquant
- Token JWT expiré
- Token JWT invalide

**Solution** :
- Vérifier que l'utilisateur est connecté
- Se reconnecter si nécessaire
- Vérifier le token dans les headers

### Problème 3: Erreur 400 (Bad Request)

**Causes** :
- Données invalides
- Format incorrect
- Champs manquants

**Solution** :
- Vérifier les données envoyées (onglet Payload)
- Vérifier les validations backend
- Vérifier le format attendu

### Problème 4: Erreur 500 (Internal Server Error)

**Causes** :
- Erreur backend
- Problème de base de données
- Problème OpenAI (si utilisé)

**Solution** :
- Vérifier les logs backend
- Vérifier la réponse du serveur
- Vérifier les logs en temps réel

### Problème 5: Erreur CORS

**Causes** :
- Configuration CORS incorrecte
- Origine non autorisée

**Solution** :
- Vérifier la configuration CORS dans le backend
- Vérifier l'origine de la requête
- Vérifier les headers CORS

---

## 🔧 Commandes Utiles

### Voir les logs en temps réel
```powershell
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --project=yukpo-project
```

### Filtrer les requêtes POST
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND httpRequest.requestMethod=POST" --limit=50 --project=yukpo-project --format=json --freshness=10m
```

### Filtrer les requêtes vers /api/services/create
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND httpRequest.requestUrl=~'/api/services/create'" --limit=20 --project=yukpo-project --format=json --freshness=10m
```

---

## 📝 Prochaines Étapes

1. **Ouvrir la console du navigateur** (F12)
2. **Vérifier l'onglet Network** pendant une tentative de création
3. **Noter** :
   - Si la requête apparaît
   - Le status HTTP
   - La réponse du serveur
   - Les erreurs dans la console
4. **Lancer les logs en temps réel** et réessayer
5. **Partager les résultats** pour analyse

---

**Généré le**: 2026-02-20  
**Action requise**: Ouvrir la console et réessayer la création

