# 🔍 ANALYSE DÉTAILLÉE DES LOGS - PROBLÈMES CRITIQUES

**Date** : 6 novembre 2025, 14h15-14h18  
**Utilisateur** : ID 17 (siaka@yahoo.fr)  
**Build APK** : 1fcf881c-a5d7-49c7-b4c6-35b981f67c7f

---

## ❌ PROBLÈME #1: ENDPOINTS MANQUANTS (CRITIQUE)

### 1.1 `/api/content/mixed` - 499 Client Cancelled
```
[GET] 499 /api/content/mixed?user_id=17&session_id=session_1762438545468_17
responseTimeMS=4
```

**Impact** : La page d'accueil ne peut PAS charger le carousel de produits/publicités  
**Cause** : Route non implémentée ou timeout  
**Localisation mobile** : `MixedContentCarousel.tsx:107`

### 1.2 `/api/services/recent` - 400 Bad Request
```
[GET] 400 /api/services/recent?limit=20&include_products=true
responseTimeMS=2-4
```

**Impact** : Fallback #1 échoue, aucun produit récent affiché  
**Cause** : Endpoint non implémenté côté backend  
**Localisation mobile** : `MixedContentCarousel.tsx:135`

### 1.3 `/api/services?limit=20` - 404 Not Found
```
[GET] 404 /api/services?limit=20
responseTimeMS=0-3
```

**Impact** : Fallback #2 échoue, **AUCUN produit affiché sur la page d'accueil**  
**Cause** : Route GET /api/services non définie  
**Localisation mobile** : `MixedContentCarousel.tsx:140`

### 1.4 `/api/services/my-services` - 400 Bad Request
```
[GET] 400 /api/services/my-services
responseTimeMS=2
```

**Impact** : L'utilisateur ne peut PAS voir ses propres services  
**Cause** : Validation échoue ou endpoint mal configuré  
**Localisation mobile** : `MesServicesScreen.tsx`

### 1.5 `/api/places/autocomplete?query=` - 400 Bad Request
```
[GET] 400 /api/places/autocomplete?query=
responseTimeMS=1
```

**Impact** : Crash de l'autocomplete si query vide  
**Cause** : Validation trop stricte, devrait retourner suggestions par défaut

---

## ⚠️ PROBLÈME #2: ERREUR BASE DE DONNÉES (RÉCURRENTE)

### 2.1 `token_usage_logs` - Contrainte NOT NULL violée

**Erreur répétée 5+ fois** :
```rust
WARN: null value in column "tokens_before" of relation "token_usage_logs" 
violates not-null constraint
```

**Localisation** : `backend/src/middlewares/check_tokens.rs:346`

**Analyse du code** :
```rust
// ❌ PROBLÈME: balance_before n'est jamais récupéré
INSERT INTO token_usage_logs 
    (user_id, intention, tokens_ia_consumed, tokens_cost_xaf, 
     tokens_deducted, balance_before, balance_after, ...)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ia_request')
// $6 (balance_before) est NULL !
```

**Solution requise** :
```rust
// ✅ AVANT l'UPDATE, récupérer le solde actuel
let balance_before = sqlx::query_scalar::<_, i64>(
    "SELECT tokens_balance FROM users WHERE id = $1"
)
.bind(user_id)
.fetch_one(&pool)
.await?;

// Puis faire l'UPDATE
let balance_after = balance_before - tokens_deducted;

// Enfin l'INSERT avec balance_before
```

---

## 🔥 PROBLÈME #3: RECHERCHE INEFFICACE

### 3.1 Produits Populaires - 0 résultats
```
[PopularProductsService] Recherche: 'Plo' (limit: 8)
✅ 0 produits populaires trouvés
elapsed: 2.661091ms
rows_returned: 0
```

**Requêtes testées** :
- "Plo" → 0 résultats
- "Pl" → 0 résultats  
- "Souris" → 1 résultat (après 191ms de recherche full-text)
- "Restaurant" → 2 résultats (après 102ms)

**Problème** : 
- La table `autocomplete_combinations` nécessite `usage_count >= 2`
- Produits neufs jamais trouvés dans suggestions populaires
- Pas de fallback vers produits récents

### 3.2 Autocomplete - 0 suggestions
```
[AutocompleteSearchService] Recherche: ["Souris"] (limit: 10)
✅ 0 résultats trouvés
elapsed: 1.526369ms
```

**Causes possibles** :
1. Base de données vide (aucun produit avec `is_real_product = TRUE`)
2. Vecteurs mal indexés
3. Recherche trop stricte

---

## 💥 PROBLÈME #4: LINEAR GRADIENT CRASH

### Analyse des imports
**Problème détecté** : **2 bibliothèques LinearGradient importées !**

```typescript
// ❌ CONFLIT: Certains fichiers utilisent expo-linear-gradient
import { LinearGradient } from 'expo-linear-gradient';

// ❌ CONFLIT: D'autres utilisent react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
```

**Fichiers affectés** : 34 fichiers !
- `FormulaireYukpoIntelligentScreen.tsx` → expo-linear-gradient
- `ModernCard.tsx` → react-native-linear-gradient ❌
- `LoginScreen.tsx` → react-native-linear-gradient ❌

**Package.json** :
```json
"expo-linear-gradient": "~14.0.2",  // ✅ Compatible Expo
"react-native-linear-gradient": "^2.8.3",  // ❌ Conflit !
```

**Solution** :
1. **Supprimer** `react-native-linear-gradient`
2. **Standardiser** tous les imports vers `expo-linear-gradient`
3. Remplacer dans 2 fichiers :
   - `mobile/src/components/ModernCard.tsx`
   - `mobile/src/screens/auth/LoginScreen.tsx`

---

## 🛠️ PROBLÈME #5: CRÉATION PRODUIT SANS FORMULAIRE SERVICE

### Comportement actuel (INCORRECT)
```
Utilisateur a déjà un service "Plomberie" → 
Veut ajouter nouveau produit "Robinets" →
❌ IA ouvre le formulaire COMPLET de création service
```

### Comportement attendu (CORRECT)
```
Utilisateur a déjà un service "Plomberie" → 
Veut ajouter nouveau produit "Robinets" →
✅ IA détecte service existant →
✅ Ouvre UNIQUEMENT formulaire produit →
✅ Attache produit au service existant
```

### Localisation du problème
`FormulaireYukpoIntelligentScreen.tsx` :
- Ligne ~540-560 : Logique de détection service existant
- Devrait vérifier si `titre_service` match un service existant
- Si match → Formulaire produit seul
- Si pas match → Formulaire service complet

---

## 📊 RÉSUMÉ PRIORISATION

### 🔴 URGENCE MAXIMALE (Bloque l'application)
1. **Implémenter `/api/content/mixed`** → Page d'accueil vide
2. **Implémenter `/api/services/recent`** → Fallback échoue
3. **Implémenter `/api/services?limit=20`** → Dernier fallback échoue
4. **Fix LinearGradient** → App crash au lancement

### 🟠 URGENCE ÉLEVÉE (Bloque fonctionnalités)
5. **Implémenter `/api/services/my-services`** → Prestataire ne voit pas ses services
6. **Fix `token_usage_logs`** → Logs historiques incorrects
7. **Fix création produit service existant** → UX cassée

### 🟡 URGENCE MOYENNE (Optimisations)
8. **Fix autocomplete query vide** → 400 au lieu de suggestions
9. **Améliorer recherche produits populaires** → 0 résultats
10. **Optimiser timeouts IA** → GPT-4 timeout 15s

---

## 🎯 ACTIONS IMMÉDIATES REQUISES

### Action #1: Implémenter les 3 endpoints manquants
```bash
backend/src/routes/recommendation_routes.rs  # /api/content/mixed
backend/src/controllers/services_controller.rs  # Créer
backend/src/routers/router_services.rs  # Créer
```

### Action #2: Fix LinearGradient (5 minutes)
```bash
# 1. Supprimer le package conflictuel
cd mobile && npm uninstall react-native-linear-gradient

# 2. Remplacer dans 2 fichiers
- ModernCard.tsx
- LoginScreen.tsx
```

### Action #3: Fix token_usage_logs (10 minutes)
```bash
backend/src/middlewares/check_tokens.rs:~340
# Ajouter récupération balance_before
```

### Action #4: Améliorer création produit (30 minutes)
```bash
mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx
# Détecter service existant et skip formulaire service
```

---

## 📈 IMPACT BUSINESS

**Sans ces corrections** :
- ❌ Page d'accueil vide → Taux de rebond 100%
- ❌ Crash au démarrage → App inutilisable
- ❌ Prestataires ne voient pas leurs services → Abandon
- ❌ UX création produit cassée → Frustration

**Avec ces corrections** :
- ✅ Carousel produits/pubs fonctionnel
- ✅ App stable sans crash
- ✅ Prestataires autonomes
- ✅ UX fluide et intuitive

**Temps estimé total** : **2-3 heures de développement**

