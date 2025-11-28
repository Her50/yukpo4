# Anomalies Corrigées - Analyse logbackend2.md

## Date: 2025-11-28

### 🔴 Problème Principal : Formulaire d'ajout de produit s'ouvre au lieu du formulaire simple

**Symptôme** : Lorsqu'on veut ajouter un nouveau produit alors qu'un service existe déjà, c'est le formulaire complet (FormulaireYukpoIntelligentScreen) qui s'ouvre au lieu du formulaire simple d'ajout de produit.

**Cause identifiée** :
- Le code dans `HomeScreen.tsx` utilisait `/api/services/my-services` pour vérifier l'existence d'un service
- Cette vérification échouait silencieusement (catch sans logs détaillés)
- Les logs montrent que `/api/services/last` fonctionne et retourne bien un service (ligne 257: `rows_returned:1`)
- Mais le code ne détectait pas ce service car il utilisait un autre endpoint

**Correction appliquée** :
- ✅ Modification de `mobile/src/screens/HomeScreen.tsx` (lignes 497-514)
- ✅ Utilisation de `/api/services/last` en premier (plus fiable selon les logs)
- ✅ Fallback vers `/api/services/my-services` si nécessaire
- ✅ Amélioration des logs pour déboguer la détection de service
- ✅ Gestion correcte de la structure de réponse (peut être `data.id` ou `data.service_id`)

**Fichier modifié** : `mobile/src/screens/HomeScreen.tsx`

---

### ⚠️ Autres Anomalies Détectées

#### 1. Erreurs Redis répétées
**Symptôme** : Nombreuses erreurs Redis dans les logs :
```
⚠️ [Redis] Toutes les tentatives (1) ont échoué. Dernière erreur: failed to lookup address information: Name or service not known
```

**Impact** : 
- Le cache Redis n'est pas disponible
- Les performances peuvent être affectées
- Les tentatives de reconnexion échouent

**Recommandation** :
- Vérifier la configuration Redis (variable d'environnement `REDIS_URL`)
- S'assurer que Redis est accessible depuis le backend
- Implémenter un mode dégradé sans cache si Redis n'est pas disponible

**Fichiers concernés** : `backend/src/utils/redis_helper.rs`

---

#### 2. Requête très lente - POST /api/ia/creation-service
**Symptôme** : Une requête a pris 21304 ms (21 secondes) :
```
🚨 [VerySlowRequest] POST /api/ia/creation-service -> 200 (21304 ms) - Requête très lente, investigation nécessaire
```

**Impact** :
- Mauvaise expérience utilisateur
- Timeout possible sur mobile
- Coûts IA élevés

**Recommandation** :
- Optimiser l'appel IA (peut-être réduire le contexte envoyé)
- Implémenter un timeout plus court
- Ajouter un indicateur de progression pour l'utilisateur
- Considérer une réponse asynchrone pour les requêtes longues

**Fichiers concernés** : `backend/src/controllers/ia_controller.rs`

---

#### 3. Erreur chargement suggestions catégories
**Symptôme** : Erreur lors du chargement des suggestions de catégories (ligne 340) :
```
[FormulaireYukpoIntelligentScreen] Erreur chargement suggestions catégories: {}
```

**Impact** :
- Les suggestions de catégories ne s'affichent pas
- L'utilisateur doit saisir manuellement la catégorie

**Recommandation** :
- Vérifier l'endpoint de suggestions de catégories
- Améliorer la gestion d'erreur pour afficher un message clair
- Implémenter un fallback vers une liste de catégories statiques

**Fichiers concernés** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

---

## Résumé des Corrections

✅ **Corrigé** : Détection de service existant pour afficher le bon formulaire
⚠️ **À corriger** : Configuration Redis
⚠️ **À optimiser** : Performance de l'endpoint IA creation-service
⚠️ **À corriger** : Chargement des suggestions de catégories

---

## Prochaines Étapes

1. Tester la correction du formulaire d'ajout de produit
2. Configurer Redis correctement ou désactiver le cache
3. Optimiser l'endpoint IA pour réduire le temps de réponse
4. Corriger le chargement des suggestions de catégories

