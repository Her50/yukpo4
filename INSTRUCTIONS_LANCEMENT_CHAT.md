# 📝 INSTRUCTIONS - Comment lancer le nouveau chat

## 🎯 ÉTAPES À SUIVRE

### 1️⃣ Ouvrir un nouveau chat Cursor

- **Option 1** : Cliquer sur l'icône "+" dans la barre latérale Cursor
- **Option 2** : Raccourci clavier `Ctrl + L` (Windows) ou `Cmd + L` (Mac)

---

### 2️⃣ Copier-coller le prompt de démarrage

1. Ouvrir le fichier **`PROMPT_DEMARRAGE_NOUVEAU_CHAT.md`**
2. Sélectionner **TOUT LE CONTENU** du fichier
3. Copier (`Ctrl+C` ou `Cmd+C`)
4. Coller dans le nouveau chat Cursor
5. Appuyer sur **Entrée**

---

### 3️⃣ L'assistant va automatiquement :

1. ✅ Lire les 4 documents de référence :
   - `TODO_COMPLET_REFONTE_YUKPO.md`
   - `ALGORITHMES_IMPLEMENTATION.md`
   - `PROMPT_IMPLEMENTATION_COMPLET.md`
   - `RECAPITULATIF_FINAL_TOUS_PROBLEMES.md`

2. ✅ Vous demander confirmation de compréhension

3. ✅ Vous demander votre **username GeoNames** (à créer sur http://www.geonames.org/login si pas encore fait)

4. ✅ Commencer **Phase 1** : Migrations automatiques

---

### 4️⃣ Pendant l'implémentation

**Vous devez** :
- ✅ Répondre aux questions bloquantes (username GeoNames, validations)
- ✅ Tester après chaque phase critique
- ✅ Approuver/rejeter les modifications proposées

**L'assistant va** :
- ✅ Suivre strictement les priorités P0 → P1 → P2
- ✅ Vous tenir informé de la progression (% complété)
- ✅ Créer les tables via `auto_migrate.rs` (pas `.sql`)
- ✅ Implémenter les algorithmes GeoNames
- ✅ Refondre les composants UI

---

### 5️⃣ Création compte GeoNames (si pas encore fait)

**AVANT de lancer le chat**, créer votre compte :

1. Aller sur http://www.geonames.org/login
2. Cliquer "create a new user account"
3. Remplir le formulaire
4. **Activer les web services** dans votre profil (gratuit)
5. Noter votre **username** (vous en aurez besoin)

**Limite gratuite** : 30 000 requêtes/jour (largement suffisant)

---

### 6️⃣ Structure des documents

```
yukpomnang2/
│
├── TODO_COMPLET_REFONTE_YUKPO.md          ← Liste problèmes + solutions
├── ALGORITHMES_IMPLEMENTATION.md           ← Code algorithmes détaillés
├── PROMPT_IMPLEMENTATION_COMPLET.md        ← Instructions techniques
├── RECAPITULATIF_FINAL_TOUS_PROBLEMES.md  ← Vue d'ensemble 30 problèmes
├── PROMPT_DEMARRAGE_NOUVEAU_CHAT.md       ← À copier-coller (CE FICHIER)
└── INSTRUCTIONS_LANCEMENT_CHAT.md         ← Ce guide
```

---

## ⚠️ IMPORTANT À SAVOIR

### SQLx Offline Mode

Le backend utilise **SQLx en mode offline**. Cela signifie :

- ❌ Les fichiers `backend/migrations/*.sql` ne s'exécutent PAS automatiquement
- ✅ Toutes les migrations doivent être dans `backend/src/migrations/auto_migrate.rs`
- ✅ Format : Fonction `ensure_nom_table()` qui vérifie si table existe avant création

**L'assistant sait cela**, mais bon à garder en tête.

---

### Variables d'environnement

À ajouter dans `backend/.env` (l'assistant le fera) :

```env
GEONAMES_USERNAME=votre_username_ici
MAX_GEO_DEPTH=7
GEOCODING_CACHE_TTL=2592000
```

---

### Temps estimé

- **Phase 1-3 (P0)** : ~9 heures (bloquant)
- **Phase 4-8 (P1)** : ~15 heures (important)
- **Phase 9-13 (P2)** : ~15 heures (UX)

**TOTAL** : ~39 heures de travail

L'assistant peut travailler en continu sur plusieurs sessions si nécessaire.

---

## ✅ CHECKLIST AVANT DE COMMENCER

- [ ] Compte GeoNames créé
- [ ] Username GeoNames noté
- [ ] Web services activés sur GeoNames
- [ ] Les 4 documents présents dans le workspace
- [ ] Nouveau chat Cursor ouvert
- [ ] Prompt copié-collé

---

## 🚀 C'EST PARTI !

Une fois tout coché ci-dessus :

1. **Ouvrir nouveau chat**
2. **Coller le contenu de** `PROMPT_DEMARRAGE_NOUVEAU_CHAT.md`
3. **Appuyer sur Entrée**
4. **Suivre les instructions de l'assistant**

---

## 💡 CONSEILS

- **Sauvegarder régulièrement** : Git commit après chaque phase réussie
- **Tester après chaque phase** : Suivre les tests proposés par l'assistant
- **Poser des questions** : Si quelque chose n'est pas clair
- **Faire confiance** : L'assistant a TOUS les détails dans les 4 documents

---

**Bonne chance ! 🎉**


