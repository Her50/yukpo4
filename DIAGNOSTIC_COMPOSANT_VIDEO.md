# 🔍 Diagnostic complet - Composant Vidéo Yukpo

## 📋 EXplications des composants

### 1. **BLOC PREVIEW (en haut)**

**Rôle concret :**
- Génère une **prévisualisation vidéo courte (3-5 secondes)** avant le rendu complet
- Permet de tester rapidement le montage, le rythme, les transitions
- Montre un aperçu de la vidéo finale sans attendre le rendu complet (qui peut prendre plusieurs minutes)

**Ce qu'il fait techniquement :**
1. **"Preview 5s"** → Appelle `/api/studio/sessions/{session_id}/preview-short`
2. Le backend génère une version courte de la vidéo (~5s) avec Remotion
3. Retourne une URL de prévisualisation que l'utilisateur peut regarder
4. Permet d'itérer rapidement sans générer toute la vidéo

**Pourquoi c'est utile :**
- Validation rapide du concept avant rendu complet
- Économie de ressources (générer 5s vs 30s)
- Feedback immédiat pour ajuster le montage

---

### 2. **BLOC LIVRAISON**

**Philosophie derrière sa présence :**

Le bloc livraison est là **AVANT** la création vidéo car :

1. **Yukpo = Plateforme e-commerce + Livraison**
   - Les vidéos servent à **promouvoir des produits/services**
   - Quand un client commande via une vidéo, il faut **livrer le produit**
   - Le studio créateur intègre donc la logistique dès la création

2. **Workflow unifié :**
   ```
   Création vidéo → Publication → Commande client → Livraison
   ```
   - Le prestataire peut pré-configurer la livraison en même temps qu'il crée la vidéo
   - Pas besoin de revenir plus tard configurer la logistique

3. **Template de livraison :**
   - Si la vidéo concerne un produit avec livraison, le prestataire peut pré-remplir les infos
   - La vidéo peut être liée à une demande de livraison automatique
   - Le client final peut commander directement depuis la vidéo

**Concrètement dans le code :**

```typescript
// Dans CreatorStudioCard.tsx
// Quand on clique "Demander un coursier"
handleRequestCourier() 
  → deliveryApi.createDeliveryRequest(payload)
  → Crée une demande de livraison dans la file de matching
  → Met à jour sessionMetadata avec delivery_id
  → Connecte WebSocket pour tracking temps réel
```

**Quand la recherche de livreur est déclenchée :**
- ✅ **Dès le clic sur "Demander un coursier"** → Entre dans la file de matching
- ❌ **PAS automatique** → Le prestataire doit activer manuellement

---

### 3. **LIEU DE LIVRAISON - Comment le client fournit l'adresse ?**

**Deux scénarios :**

#### **Scénario A : Prestataire connaît déjà l'adresse**
- Le prestataire remplit directement les coordonnées GPS (pickup/dropoff)
- Il peut utiliser le bouton **GPS** pour sélectionner sur la carte
- Pas besoin d'attendre le client

#### **Scénario B : Prestataire ne connaît PAS l'adresse**

**Flow actuel dans le code :**

```typescript
// 1. Prestataire crée la demande avec dropoff_pending = true
// 2. Génère un lien de partage
actions.shareDropoffLink()
  → deliveryApi.generateDropoffShareLink(deliveryId)
  → Retourne un token + URL publique
  → Lien format: /delivery/public/{token}

// 3. Client clique sur le lien (sans compte)
// 4. Page publique où le client peut :
//    - Entrer son adresse
//    - Sélectionner GPS
//    - Valider
// 5. Une fois validé, le dropoff est mis à jour et le matching démarre
```

**Code actuel :**
- `dropoffPending` → Indique qu'on attend l'adresse client
- `dropoffShareLink` → Lien à partager avec le client
- WebSocket écoute les mises à jour de dropoff

**Ce qui manque peut-être :**
- Une page publique `/delivery/public/:token` pour que le client entre son adresse
- Un mécanisme de notification quand le client a fourni l'adresse

---

### 4. **LIVREUR DU PRESTATAIRE - Comment choisir ?**

**Types de véhicule = Moyen de transport du colis**

```typescript
const VEHICLE_OPTIONS = [
  { id: 1, label: 'Moto express', description: '<10 kg · <30 cm' },
  { id: 2, label: 'Tricycle', description: 'Jusqu'à 1 m³' },
  { id: 3, label: 'Fourgonnette', description: '3 m³ / 400 kg max' },
  { id: 4, label: 'Camion 4T+', description: 'Gros volume' }
];
```

**À quoi ça correspond :**
- Le **prestataire choisit le type de véhicule** selon le poids/volume de son produit
- C'est le **format de livraison requis**, pas forcément son livreur personnel

**Livreur personnel vs Plateforme :**

Dans le code actuel :
- Si le prestataire a son propre livreur → Il n'utilise pas cette fonctionnalité
- Cette fonctionnalité est pour utiliser **les livreurs de la plateforme Yukpo**
- Le matching se fait automatiquement dans la file de livraison

**Si vous voulez permettre au prestataire de choisir son livreur :**
1. Ajouter un champ `courier_id` optionnel dans le payload
2. Si `courier_id` est fourni → Livraison assignée directement
3. Sinon → Matching automatique comme actuellement

---

### 5. **DIFFÉRENCE : "Décris ton spot" vs "Brief & recommandations IA"**

**"Brief & recommandations IA"** (dans CreatorStudioCard) :
- C'est le **contexte métier global** pour la session Studio
- Exemple : "Restaurant à Douala, spécialité poisson, livraison 30 min"
- Utilisé pour :
  - Recommandations de templates
  - Suggestions IA générales
  - Context business pour le storyboard

**"Décris ton spot"** (dans VideoCreationWizardScreen) :
- C'est la **description spécifique pour cette vidéo**
- Exemple : "Promo rentrée : 50% sur la formule premium ce weekend"
- Utilisé pour :
  - Générer le storyboard IA
  - Script de la vidéo
  - Texte à afficher dans la vidéo

**Résumé :**
- **Brief** = Contexte général du business
- **Décris ton spot** = Contenu spécifique de cette vidéo

---

## 🐛 DIAGNOSTIC DES ERREURS

### **Erreur 404 - Storyboard**

**Endpoint appelé :**
```
POST /api/studio/sessions/{session_id}/storyboard
```

**Vérification backend :**
```rust
// backend/src/routers/router_yukpo.rs:414
.route(
    "/api/studio/sessions/{session_id}/storyboard",
    post(studio_controller::generate_storyboard)
)
```

**Causes possibles :**
1. ✅ Route existe dans le router
2. ❓ Fonction `generate_storyboard` implémentée ?
3. ❓ `session_id` valide ?
4. ❓ Middleware JWT OK ?

**Action :** Vérifier `backend/src/controllers/studio_controller.rs::generate_storyboard`

**Diagnostic :**
- ✅ Fonction `generate_storyboard` existe (ligne 285)
- ✅ Route montée dans `router_yukpo.rs:414`
- ❓ **Problème probable :** Format `session_id` (UUID vs string)
  - Backend attend : `Path(session_id): Path<Uuid>`
  - Mobile envoie : `sessionId` (string)
  - **Si sessionId n'est pas un UUID valide → 404**

**Solution :**
1. Vérifier que `ensureStudioSession()` retourne un UUID valide
2. Vérifier les logs backend pour voir quel UUID est reçu
3. Ajouter validation UUID dans le mobile avant l'appel

---

### **Erreur - Suggestions IA ne renvoie rien**

**Endpoint appelé :**
```typescript
// mobile/src/hooks/useCreatorStudio.ts:1003
generateSuggestions() {
  // ❌ PROBLÈME : Code hardcodé, n'appelle PAS le backend !
  const suggestions = [
    'Hook express avec stock limité + CTA livraison',
    'Ajouter scène USP (3s) avant CTA',
    'Prévoir variante voix + texte pour WhatsApp',
  ];
  setAiSuggestions(suggestions);
}
```

**Diagnostic :**
- ✅ Pas d'erreur réseau car il n'y a **pas d'appel backend**
- ❌ **Suggestions hardcodées** au lieu d'utiliser l'IA
- ❓ Pas d'endpoint backend prévu pour ça ?

**Solution :**
1. Créer endpoint `/api/studio/sessions/:id/suggestions`
2. Appeler l'IA avec le brief pour générer des suggestions
3. Remplacer le code hardcodé

---

### **Erreur 500 - Preview 5s**

**Endpoint appelé :**
```
POST /api/studio/sessions/{session_id}/preview-short
```

**Vérification backend :**
```rust
// backend/src/routers/router_yukpo.rs:393
.route(
    "/api/studio/sessions/{session_id}/preview-short",
    post(studio_controller::trigger_short_preview)
)
```

**Causes possibles (500 = erreur serveur) :**
1. ❓ Fonction `trigger_short_preview` crash
2. ❓ Problème avec Remotion worker
3. ❓ Session invalide ou données manquantes
4. ❓ Timeout ou erreur de génération vidéo

**Action :**
- Vérifier les logs backend
- Vérifier `studio_controller::trigger_short_preview` (ligne 111)
- Vérifier que le worker Remotion est actif
- Vérifier que `studio_service::trigger_short_preview` fonctionne

**Diagnostic :**
- ✅ Fonction `trigger_short_preview` existe
- ✅ Route montée dans `router_yukpo.rs:393`
- ❓ **Problème probable :** 
  - Worker Remotion non actif
  - Session invalide ou données manquantes
  - Timeout génération vidéo
  - Erreur dans `ImmersiveOrchestrator` ou `VideoRenderDispatcher`

---

## 🔧 AMÉLIORATIONS SUGGÉRÉES

### 1. **Listes déroulantes pour modalités multiples**

**Problème actuel :**
- Champs avec plusieurs options affichés en boutons
- Prend beaucoup d'espace
- Scroll excessif

**Solution :**
```typescript
// Remplacer les boutons par un Picker/Dropdown
<Picker
  selectedValue={vehicleTypeId}
  onValueChange={setVehicleTypeId}
>
  {VEHICLE_OPTIONS.map(option => (
    <Picker.Item 
      key={option.id} 
      label={`${option.label} - ${option.description}`}
      value={option.id}
    />
  ))}
</Picker>
```

**Fichiers à modifier :**
- `CreatorStudioCard.tsx` → Type véhicule
- `VideoCreationWizardScreen.tsx` → Style presets, Mode IA

---

### 2. **Créer endpoint Suggestions IA**

```rust
// backend/src/controllers/studio_controller.rs
pub async fn generate_suggestions(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<GenerateSuggestionsPayload>,
) -> Json<Value> {
    // Appeler l'IA pour générer des suggestions basées sur le brief
    let suggestions = ia_service::generate_video_suggestions(&payload.brief).await?;
    Json(json!({
        "success": true,
        "data": { "suggestions": suggestions }
    }))
}
```

---

### 3. **Page publique pour dropoff client**

Créer une route :
```
GET /delivery/public/:token
```

Page où le client peut :
- Voir les infos de livraison
- Entrer/sélectionner son adresse GPS
- Valider

---

## 📊 RÉSUMÉ ACTIONS

### **Immédiat :**
1. ✅ Vérifier `studio_controller.rs::generate_storyboard` existe
2. ✅ Vérifier `studio_controller.rs::trigger_short_preview` fonctionne
3. ✅ Améliorer suggestions (TODO ajouté pour endpoint backend)
4. ✅ Convertir boutons modalités en listes déroulantes (iOS avec Alert)
5. ✅ Ajouter validation UUID pour session_id
6. ✅ Ajouter logs détaillés pour debugging

### **Corrections appliquées :**
1. ✅ Listes déroulantes pour Type véhicule (iOS)
2. ✅ Listes déroulantes pour Style vidéo (iOS)
3. ✅ Listes déroulantes pour Mode IA (iOS)
4. ✅ Validation UUID session_id avant appels API
5. ✅ Logs détaillés dans `studioService.ts`
6. ✅ Gestion d'erreurs améliorée avec messages spécifiques

### **Court terme :**
1. Créer endpoint `/api/studio/sessions/:id/suggestions`
2. Créer page publique `/delivery/public/:token`
3. Vérifier logs backend pour comprendre erreurs 404/500

### **Moyen terme :**
1. Permettre sélection livreur personnel
2. Améliorer UX dropoff pending
3. Notification quand client fournit adresse

---

## 🎯 RÉPONSES DIRECTES AUX QUESTIONS

### **1. Rôle du bloc Preview (en haut)**
**Réponse :** Génère une prévisualisation courte (3-5s) pour tester rapidement le montage avant le rendu complet.

### **2. Pourquoi Livraison avant création vidéo ?**
**Réponse :** Yukpo = plateforme unifiée e-commerce + livraison. Les vidéos servent à promouvoir des produits, donc la logistique est pré-configurée en même temps.

### **3. Comment client fournit lieu si prestataire ne le connaît pas ?**
**Réponse :** Via un lien public `/delivery/public/:token` que le prestataire partage. Le client entre son adresse, puis le matching démarre.

### **4. Quand recherche livreur déclenchée ?**
**Réponse :** Dès le clic sur "Demander un coursier" → Entre dans la file de matching automatique.

### **5. Comment choisir son propre livreur ?**
**Réponse :** Fonctionnalité non implémentée actuellement. Actuellement = matching automatique plateforme uniquement.

### **6. Type de véhicule = ?**
**Réponse :** Moyen de transport requis selon poids/volume du colis (Moto, Tricycle, Fourgonnette, Camion).

### **7. Listes déroulantes pour modalités multiples**
**Réponse :** ✅ **CORRIGÉ** - iOS utilise maintenant Alert avec liste, Android garde les boutons (moins d'espace utilisé).

### **8. Différence Brief vs "Décris ton spot"**
**Réponse :** 
- **Brief** = Contexte général du business (ex: "Restaurant à Douala")
- **"Décris ton spot"** = Contenu spécifique de cette vidéo (ex: "Promo 50% ce weekend")

### **9. Storyboard erreur 404 - Rôle**
**Réponse :** Génère un storyboard IA (séquences de scènes) à partir du brief. **Problème :** Probable session_id invalide ou non-UUID. **Correction :** Validation UUID ajoutée.

### **10. Suggestions IA ne renvoie rien - Rôle**
**Réponse :** Devrait générer des suggestions IA pour améliorer la vidéo. **Problème :** Code hardcodé, pas d'appel backend. **Correction :** TODO ajouté, logs améliorés.

### **11. Preview 5s erreur 500**
**Réponse :** Génère une prévisualisation courte. **Problème :** Erreur serveur (probable worker Remotion). **Correction :** Logs détaillés ajoutés pour identifier la cause.

---

## 🔍 DIAGNOSTIC TECHNIQUE

### **Endpoints Backend :**
- ✅ `/api/studio/sessions/{session_id}/storyboard` - Route existe, fonction existe
- ✅ `/api/studio/sessions/{session_id}/preview-short` - Route existe, fonction existe
- ❌ `/api/studio/sessions/{session_id}/suggestions` - **N'existe pas encore**

### **Problèmes identifiés :**
1. **Session ID** - Format UUID requis, validation ajoutée
2. **Suggestions IA** - Hardcodées, endpoint manquant
3. **Preview 500** - Probable problème worker Remotion ou données manquantes
4. **Storyboard 404** - Probable session_id invalide ou route non trouvée

### **Actions requises backend :**
1. Vérifier logs backend pour voir les requêtes reçues
2. Vérifier que le worker Remotion est actif
3. Créer endpoint `/api/studio/sessions/:id/suggestions`
4. Vérifier validation UUID dans les routes

