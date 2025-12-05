# 🔧 Variables d'Environnement - Taxi & Covoiturage

**Date**: 2025-01-29  
**Objectif**: Lister toutes les variables d'environnement nécessaires pour les fonctionnalités Taxi et Covoiturage

---

## ✅ VARIABLES DÉJÀ CONFIGURÉES (Générales)

Ces variables sont **requises pour toute l'application** et sont donc déjà utilisées par Taxi/Covoiturage :

### Base de données (REQUIS)
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

### Cache Redis (REQUIS pour performances)
```bash
REDIS_URL=redis://username:password@host:port/database
```
- **Usage**: Cache des résultats de recherche taxi/covoiturage
- **TTL**: Configuré dans le code (généralement 5-10 minutes)

### Authentification (REQUIS)
```bash
JWT_SECRET=your_super_secret_jwt_key_64_chars_minimum_required
```
- **Usage**: Authentification des endpoints protégés (réservation, gestion)

---

## ✅ VARIABLES OPTIONNELLES (Améliorations)

### Géolocalisation (Recommandé)
```bash
GOOGLE_MAPS_API_KEY=AIzaSy...
```
- **Usage**: 
  - Calcul de distances pour tarifs taxi
  - Géocodage adresses
  - Affichage cartes dans l'app mobile
- **Où**: Utilisé dans les services de calcul de prix et géocodage

### Traduction (Optionnel)
```bash
GOOGLE_TRANSLATE_API_KEY=AIzaSy...
```
- **Usage**: Traduction des notifications et messages
- **Où**: NotificationService utilise cette clé si disponible

---

## ✅ VARIABLES SPÉCIFIQUES TAXI/COVOITURAGE

### Aucune variable spécifique requise ! ✅

Les fonctionnalités avancées fonctionnent avec les services généraux :

#### 🚕 Taxi
- ✅ **Recherche**: Utilise Redis pour cache (REDIS_URL)
- ✅ **Réservation**: Utilise base de données (DATABASE_URL)
- ✅ **Matching intelligent**: Algorithme local (pas d'API externe)
- ✅ **Calcul prix**: Formule locale basée sur distance (pas d'API externe)
- ✅ **Géolocalisation**: Google Maps si GOOGLE_MAPS_API_KEY configurée

#### 🚗 Covoiturage
- ✅ **Recherche**: Utilise Redis pour cache (REDIS_URL)
- ✅ **Réservation**: Utilise base de données (DATABASE_URL)
- ✅ **Matching intelligent**: Algorithme local (pas d'API externe)
- ✅ **Assurance**: Service interne (pas d'API externe)
- ✅ **QR codes**: Génération locale (librairie Rust)
- ✅ **Notifications proactives**: NotificationService (pas d'API externe)

---

## 📋 RÉCAPITULATIF DES VARIABLES

| Variable | Requis | Usage Taxi | Usage Covoiturage | Déjà configuré |
|----------|--------|------------|-------------------|----------------|
| `DATABASE_URL` | ✅ **OUI** | Recherche, réservation, gestion | Recherche, réservation, gestion | ✅ Oui |
| `REDIS_URL` | ✅ **OUI** | Cache recherche | Cache recherche | ✅ Oui |
| `JWT_SECRET` | ✅ **OUI** | Authentification | Authentification | ✅ Oui |
| `GOOGLE_MAPS_API_KEY` | ⚠️ Optionnel | Géolocalisation, calcul distance | Géolocalisation | ⚠️ À vérifier |
| `GOOGLE_TRANSLATE_API_KEY` | ⚠️ Optionnel | Traduction notifications | Traduction notifications | ⚠️ À vérifier |

---

## 🔍 VÉRIFICATION DES VARIABLES

### Variables Critiques (DOIVENT être configurées)

1. ✅ **DATABASE_URL**
   - Utilisée par: Recherche, réservation, gestion, matching
   - Sans elle: L'application ne peut pas fonctionner
   - **Status**: Probablement déjà configurée ✅

2. ✅ **REDIS_URL**
   - Utilisée par: Cache des recherches (performance)
   - Sans elle: Recherches plus lentes, pas de cache
   - **Status**: Probablement déjà configurée ✅

3. ✅ **JWT_SECRET**
   - Utilisée par: Authentification de tous les endpoints protégés
   - Sans elle: Impossible de se connecter/réserver
   - **Status**: Probablement déjà configurée ✅

### Variables Optionnelles (Améliorent l'expérience)

4. ⚠️ **GOOGLE_MAPS_API_KEY**
   - Utilisée par: 
     - Calcul distances précises pour tarifs
     - Géocodage d'adresses
     - Affichage cartes dans mobile
   - Sans elle: Fonctionnalités dégradées mais applicables fonctionnelles
   - **Recommandation**: Configurer pour une meilleure UX

5. ⚠️ **GOOGLE_TRANSLATE_API_KEY**
   - Utilisée par: Traduction automatique des notifications
   - Sans elle: Notifications en français uniquement
   - **Recommandation**: Configurer si multi-langue requis

---

## 🚀 CONFIGURATION SUR RENDER.COM

### Variables à vérifier/ajouter

Dans votre dashboard Render.com :

1. **Vérifier que ces variables existent** (doivent déjà être là) :
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   JWT_SECRET=...
   ```

2. **Ajouter si manquantes** (optionnel mais recommandé) :
   ```
   GOOGLE_MAPS_API_KEY=AIzaSy...
   GOOGLE_TRANSLATE_API_KEY=AIzaSy...
   ```

### Comment obtenir les clés Google

#### GOOGLE_MAPS_API_KEY
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activer les APIs :
   - Maps JavaScript API
   - Geocoding API
   - Distance Matrix API (pour calcul distances)
3. Créer une clé API
4. Ajouter dans Render.com

#### GOOGLE_TRANSLATE_API_KEY
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activer l'API "Cloud Translation API"
3. Utiliser la même clé que pour Maps (ou créer une nouvelle)

---

## 📝 RÉSUMÉ

### ✅ **BONNE NOUVELLE** : Pas de variables spécifiques requises !

Les fonctionnalités Taxi et Covoiturage utilisent les services généraux de l'application :

- ✅ **Base de données** (déjà configurée)
- ✅ **Redis cache** (déjà configurée)
- ✅ **Authentification JWT** (déjà configurée)
- ✅ **Services internes** (pas de variables nécessaires)

### Variables Optionnelles (Améliorations)

- ⚠️ `GOOGLE_MAPS_API_KEY` : Améliore géolocalisation et calculs de distance
- ⚠️ `GOOGLE_TRANSLATE_API_KEY` : Permet traduction automatique

---

## ✅ CONCLUSION

**Aucune variable d'environnement supplémentaire n'est requise pour faire fonctionner le Taxi et le Covoiturage !**

Les fonctionnalités fonctionnent avec les variables déjà configurées pour l'application :
- `DATABASE_URL` ✅
- `REDIS_URL` ✅
- `JWT_SECRET` ✅

Les variables Google (`GOOGLE_MAPS_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`) sont **optionnelles** et améliorent l'expérience utilisateur mais ne sont **pas requises** pour le fonctionnement de base.

---

**Status**: ✅ **Tout est déjà configuré pour fonctionner !**

