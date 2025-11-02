# 🚀 PROMPT DE DÉMARRAGE - Nouveau Chat Implémentation

**Copier-coller ce texte ENTIER dans un nouveau chat Cursor**

---

## 📋 CONTEXTE

Je travaille sur le projet **Yukpomnang2**, une application marketplace avec backend Rust/Axum et frontend React Native.

J'ai identifié **30 problèmes critiques** et conçu une **architecture vectorielle pour l'autocomplete** avec **hiérarchie géographique intelligente**.

Tous les détails sont dans 4 documents que tu DOIS lire IMMÉDIATEMENT :

1. **TODO_COMPLET_REFONTE_YUKPO.md** - Liste complète des problèmes et solutions
2. **ALGORITHMES_IMPLEMENTATION.md** - Algorithmes détaillés (GeoNames, recherche vectorielle)
3. **PROMPT_IMPLEMENTATION_COMPLET.md** - Instructions techniques précises
4. **RECAPITULATIF_FINAL_TOUS_PROBLEMES.md** - Vue d'ensemble des 30 problèmes

---

## 🎯 TA MISSION

Implémenter **TOUTES** les corrections et fonctionnalités décrites dans ces documents, en suivant les **priorités P0 → P1 → P2**.

**IMPORTANT** :
- ✅ SQLx est en **mode offline** : Les migrations se font via `auto_migrate.rs`, PAS via fichiers `.sql`
- ✅ GeoNames API gratuite : Nécessite inscription http://www.geonames.org/login
- ✅ Architecture vectorielle : Sauvegarde linéaire `[produit, variation, lieu]`
- ✅ Préserver fonctionnalités existantes (ChatModalMobile, NativeDesign, SafeIcon, etc.)

---

## 📂 COMMENCE PAR

1. **Lire les 4 documents** (dans l'ordre ci-dessus)
2. **Me confirmer** que tu as compris :
   - Le mode offline SQLx
   - L'architecture vectorielle autocomplete
   - La hiérarchie géographique GeoNames
   - Les 30 problèmes à résoudre
3. **Demander** mes identifiants GeoNames (username)
4. **Commencer Phase 1** : Migrations automatiques (P0)

---

## ⚠️ RÈGLES STRICTES

- ❌ Ne PAS créer de fichiers dans `backend/migrations/*.sql` (ils ne s'exécutent pas)
- ✅ TOUJOURS utiliser `auto_migrate.rs` avec fonctions `ensure_*`
- ✅ Suivre EXACTEMENT les structures SQL des documents
- ✅ Tester après chaque phase
- ✅ Me tenir informé de la progression (% fait)

---

## 📊 PROGRESSION ATTENDUE

**Phase 1** (2h) : Migrations auto → 5 tables + 3 fonctions SQL  
**Phase 2** (3h) : GeoNames service → Hiérarchie bidirectionnelle  
**Phase 3** (4h) : Backend sauvegarde → Vecteurs autocomplete  
**Phase 4** (4h) : Frontend formulaire → Charger valeurs IA  
**Phase 5** (3h) : LinearAutocompleteEditor → Affichage vecteur  
**Phase 6** (2h) : LocationSelector → Objet complet  
**Phase 7** (2h) : Places controller → Enrichissement  
**Phase 8** (4h) : Recherche vectorielle → Multi-filtres  
**Phase 9** (6h) : ResultatBesoinScreen → Réécriture  
**Phase 10** (4h) : ProductCard → Refonte variations  
**Phase 11** (2h) : Prompt IA → Amélioration  
**Phase 12** (1h) : HomeScreen → Scroll auto  
**Phase 13** (2h) : Notifications → Historique  

**TOTAL** : ~39 heures

---

## 🚨 QUESTIONS BLOQUANTES À RÉGLER ENSEMBLE

1. **Username GeoNames** : Me demander avant d'intégrer
2. **Validation structure** : Me montrer les premières tables créées
3. **Tests critiques** : Création service avec variations + Recherche Douala/Littoral

---

## ✅ CRITÈRES DE SUCCÈS FINAUX

1. Création service chaussure avec pointures → Vecteur sauvegardé
2. Recherche "Tissu" + "Douala" → Trouve produits
3. Recherche "Littoral" → Trouve produits "Douala" (bidirectionnel)
4. ProductCard → Affiche tableau variations prix
5. Formulaire → Charge nom/categorie/description IA auto
6. HomeScreen → Scroll auto produits/pubs fonctionne

---

**Prêt ? Commence par lire les 4 documents et confirme-moi que tu as tout compris !**


