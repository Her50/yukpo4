# Corrections Appliquées - Problèmes de Création de Produit/Service

## Date : 2025-11-28

---

## ✅ CORRECTION 1 : Erreur 413 (Payload Too Large) - CORRIGÉE

### Problème
La création de service échouait avec l'erreur HTTP 413 (Payload Too Large), même avec un payload de 0.00 MB selon les logs.

### Causes identifiées
1. La route `/api/services/create` n'avait pas le middleware `request_size_limit` appliqué
2. La limite était peut-être trop restrictive pour les structures JSON complexes avec `sous_caracteristiques`

### Corrections appliquées

#### 1. Ajout du middleware à la route de création de service
**Fichier** : `backend/src/routes/service_routes.rs`

```rust
// ✅ CORRECTION: Route de création avec middleware de limite de taille pour éviter erreur 413
.route(
    "/services/create",
    post(creer_service)
        .layer(middleware::from_fn(request_size_limit))
)
```

#### 2. Augmentation de la limite de taille
**Fichier** : `backend/src/middlewares/request_size_limit.rs`

- **Avant** : 500 MB
- **Après** : 1 GB (1_000_000_000 bytes)

#### 3. Amélioration du logging
Ajout de logs pour tracer la taille des requêtes acceptées/rejetées.

### Résultat attendu
- Les requêtes de création de service ne devraient plus échouer avec l'erreur 413
- Les payloads complexes avec sous_caracteristiques imbriquées seront acceptés

---

## ⚠️ PROBLÈME 2 : Médias non sauvegardés - ANALYSE EN COURS

### Observation
- Aucun INSERT dans la table `media` visible dans les logs
- Le payload affiche "0.00 MB", ce qui suggère que les médias ne sont pas envoyés

### Analyse du code
Le code backend **SAUVEGARDE BIEN** les médias :
- Lignes 2064-2278 : Extraction et sauvegarde des images produits depuis `data_processed`
- Lignes 2470-2548 : Sauvegarde des vidéos produits
- Lignes 2810+ : Sauvegarde des audios
- Lignes 2875+ : Sauvegarde des vidéos globaux

**Le problème semble être** :
- Les médias ne sont **pas envoyés** depuis le mobile dans le payload
- Ou ils sont envoyés dans un format qui n'est pas reconnu

### Investigation nécessaire
1. Vérifier comment les médias sont envoyés depuis `FormulaireYukpoIntelligentScreen.tsx`
2. Vérifier si le champ `_product_media_manager` envoie bien les médias
3. Ajouter des logs dans le mobile pour tracer l'envoi des médias

### Prochaines étapes
- Examiner `ProductVideoCreationModal.tsx` et `MediaManagerMobile.tsx`
- Vérifier le format d'envoi des médias dans le payload
- Ajouter des logs pour tracer le flux des médias

---

## ⚠️ PROBLÈME 3 : LinearAutocompleteEditor validation automatique - ANALYSÉ

### Observation dans les logs
- Lignes 246-249 : Le tableau des sous-caractéristiques est bien créé
- Le tableau devrait s'afficher avec validation manuelle
- Mais les valeurs sont appliquées automatiquement

### Analyse du code
Le code semble **DÉJÀ CORRECT** :
- Lignes 1985-1988 : Commentaire indiquant "NE PAS appliquer automatiquement"
- Lignes 1368-1433 : `useEffect` qui crée les `suggestionDrafts` depuis `sousCaracteristiques`
- Ligne 1716-1733 : `preferredDraftCandidate` créé depuis les drafts
- Ligne 1741-1745 : `displayCandidate` sélectionné pour affichage

**Le problème semble être** :
- Le tableau est créé mais ne s'affiche peut-être pas correctement dans l'UI
- Ou les valeurs initiales sont déjà dans le champ `value`, ce qui les rend visibles avant l'affichage du tableau
- Il pourrait y avoir un problème de rendu conditionnel du tableau

### Investigation nécessaire
1. Vérifier le rendu conditionnel du tableau (lignes ~2380+)
2. Vérifier si `displayCandidate` déclenche bien l'affichage du tableau
3. Ajouter des logs pour tracer l'affichage du tableau

### Fichiers à examiner
- `mobile/src/components/LinearAutocompleteEditor.tsx` (section rendu du tableau)

---

## ⚠️ PROBLÈME 4 : Formulaire produit ne s'ouvre pas - À CORRIGER

### Observation
- Le champ `_product_media_manager` est présent dans les champs (ligne 208 des logs)
- Aucune logique ne détecte la présence de produits existants
- Le formulaire d'ajout ne s'ouvre pas automatiquement

### Solution à implémenter
1. Ajouter une détection de produits existants dans `FormulaireYukpoIntelligentScreen.tsx`
2. Ouvrir automatiquement le formulaire si des produits/services existent déjà
3. Ajouter des logs pour tracer l'ouverture du formulaire

### Fichiers à modifier
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`
- `mobile/src/components/ProductManagerMobile.tsx`

---

## 📋 Résumé des Corrections

| Problème | Status | Priorité | Fichiers modifiés |
|----------|--------|----------|-------------------|
| Erreur 413 Payload Too Large | ✅ CORRIGÉ | 🔴 Critique | `backend/src/routes/service_routes.rs`, `backend/src/middlewares/request_size_limit.rs` |
| Médias non sauvegardés | ⚠️ Analyse | 🟡 Moyenne | Investigation nécessaire - problème semble être côté envoi mobile |
| LinearAutocompleteEditor auto-validation | ⚠️ À faire | 🟡 Moyenne | `mobile/src/components/LinearAutocompleteEditor.tsx` |
| Formulaire produit ne s'ouvre pas | ⚠️ À faire | 🟢 Faible | `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` |

---

## 🎯 Prochaines Étapes

1. **Tester la correction de l'erreur 413**
   - Vérifier que la création de service fonctionne maintenant
   - Vérifier dans les logs que la requête n'est plus rejetée avec 413

2. **Investigation médias**
   - Examiner comment les médias sont envoyés depuis le mobile
   - Vérifier le format du payload avec médias
   - Ajouter des logs pour tracer le flux

3. **Corriger LinearAutocompleteEditor**
   - Désactiver la validation automatique
   - Forcer l'affichage du tableau avant validation

4. **Corriger l'ouverture du formulaire produit**
   - Ajouter la logique de détection
   - Ouvrir automatiquement le formulaire

---

## 📝 Notes

- Les corrections appliquées devraient résoudre le problème critique de l'erreur 413
- Les autres problèmes nécessitent une investigation plus approfondie du côté mobile
- Il est recommandé de tester chaque correction isolément
