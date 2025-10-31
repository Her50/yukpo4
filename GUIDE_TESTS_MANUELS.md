# ✅ Guide de Tests Manuels - Formulaires Yukpomnang

## 🎯 Objectif

Vérifier que tous les objectifs d'amélioration UX fonctionnent correctement dans l'application mobile.

**Durée estimée** : 10-15 minutes

---

## 📱 Test 1 : Champ nom auto-rempli (Services)

### Catégories à tester
- Plombier
- Électricien
- Peintre en bâtiment
- Staffeur

### Procédure

1. **Ouvrir l'app** → Aller dans "Mes Services" ou "Créer un service"

2. **Créer un nouveau service**
   - Cliquer sur "+ Ajouter un produit"
   - Choisir le type : **"Plombier"**

3. **Vérifier le formulaire**
   - ✅ **SUCCÈS** : Le champ "Nom du produit" n'est PAS visible
   - ❌ **ÉCHEC** : Le champ "Nom du produit" est affiché vide

4. **Remplir le formulaire**
   - Sélectionner un "Type de prestation" (ex: "Installation sanitaire")
   - Sélectionner des "Spécialités"

5. **Vérifier l'auto-remplissage**
   - Enregistrer le service
   - Regarder le service créé
   - ✅ **SUCCÈS** : Le nom est rempli automatiquement avec le type de prestation
   - ❌ **ÉCHEC** : Le nom est vide ou "Sans nom"

6. **Répéter** pour Électricien, Peintre, Staffeur

### Résultat attendu
✅ Le champ nom n'est jamais affiché, et se remplit automatiquement

---

## 📋 Test 2 : Ajout inline de modalités

### Catégories à tester
- Toutes (mais tester principalement : Plombier, Téléphone, Vêtement)

### Procédure

1. **Créer un nouveau produit**
   - Type : **"Plombier"**

2. **Ouvrir un champ liste**
   - Cliquer sur "Spécialités *"
   - La modale de sélection s'ouvre

3. **Taper une modalité inexistante**
   - Dans la barre de recherche, taper : `Réparation tuyaux cuivre spécialisé`
   - Attendre 1 seconde

4. **Vérifier l'ajout inline**
   - ✅ **SUCCÈS** : Un message "Aucun résultat" + bouton "➕ Ajouter [modalité]" apparaît
   - ❌ **ÉCHEC** : Rien ne se passe ou message "Aucun résultat" sans bouton

5. **Cliquer sur le bouton d'ajout**
   - ✅ **SUCCÈS** : Une modale s'ouvre pour confirmer l'ajout
   - Confirmer → La modalité est ajoutée et sélectionnée
   - ❌ **ÉCHEC** : Rien ne se passe

6. **Vérifier qu'il n'y a PAS de bouton externe**
   - ❌ **ÉCHEC** : Si vous voyez un bouton "+ Ajouter une spécialité" EN DEHORS du champ liste
   - ✅ **SUCCÈS** : Aucun bouton externe, tout se fait via le lien inline

### Résultat attendu
✅ L'ajout se fait via un lien inline dans le champ, pas de bouton externe

---

## 💰 Test 3 : Devises compactes et correctes

### Produits à tester
- Téléphone (XAF)
- Automobile (EUR ou USD)
- Vêtement (XAF)

### Procédure

1. **Créer un produit en XAF**
   - Type : "Téléphone"
   - Prix : 150000
   - Devise : **XAF**
   - Enregistrer

2. **Vérifier l'affichage**
   - Sur la carte produit
   - ✅ **SUCCÈS** : Affichage "150 000 FCFA" ou "150 000 XAF"
   - ❌ **ÉCHEC** : Affichage "150 000 $"

3. **Créer un produit en EUR**
   - Type : "Automobile"
   - Prix : 15000
   - Devise : **EUR**
   - Enregistrer

4. **Vérifier l'affichage**
   - Sur la carte produit
   - ✅ **SUCCÈS** : Affichage "15 000,00 €" ou "15 000 EUR"
   - ❌ **ÉCHEC** : Affichage "15 000 $"

5. **Vérifier le sélecteur de devise**
   - Dans le formulaire d'ajout
   - ✅ **SUCCÈS** : Les devises s'affichent sur une seule ligne ("XAF", "EUR", "USD")
   - ❌ **ÉCHEC** : Les devises passent à la ligne ("Franc CFA (XAF)" sur 2 lignes)

### Résultat attendu
✅ Les devises sont affichées correctement (pas de $ hardcodé) et compactes

---

## ⌨️ Test 4 : Clavier et boutons accessibles

### Procédure

1. **Créer un nouveau produit**
   - N'importe quel type

2. **Ouvrir un champ texte**
   - Cliquer sur "Description"
   - Le clavier s'ouvre

3. **Vérifier la visibilité des boutons**
   - ✅ **SUCCÈS** : Les boutons "Annuler" et "Ajouter produit" restent visibles en bas
   - ❌ **ÉCHEC** : Les boutons sont masqués par le clavier

4. **Faire défiler le formulaire**
   - Remplir plusieurs champs
   - Faire défiler vers le haut et vers le bas
   - ✅ **SUCCÈS** : Les boutons restent toujours accessibles/cliquables
   - ❌ **ÉCHEC** : Les boutons disparaissent ou deviennent inaccessibles

5. **Fermer le clavier**
   - Taper en dehors d'un champ ou fermer manuellement
   - ✅ **SUCCÈS** : Le formulaire se repositionne correctement
   - ❌ **ÉCHEC** : Le formulaire reste décalé

### Résultat attendu
✅ Les boutons Annuler/Ajouter sont toujours accessibles, même avec le clavier ouvert

---

## 📊 Test 5 : Modalités compactes

### Procédure

1. **Créer un service avec beaucoup de modalités**
   - Type : "Plombier"
   - Spécialités : Sélectionner 5-6 spécialités différentes

2. **Vérifier l'affichage**
   - Observer les "tags" de spécialités sélectionnées
   - ✅ **SUCCÈS** : Les tags sont compacts, plusieurs sur une même ligne
   - ❌ **ÉCHEC** : Les tags sont gros, un par ligne ou trop espacés

3. **Vérifier l'espacement**
   - ✅ **SUCCÈS** : Les tags ont un petit espacement entre eux (4-8px)
   - ❌ **ÉCHEC** : Les tags ont un grand espacement (12px+)

### Résultat attendu
✅ Les modalités sélectionnées s'affichent de manière compacte

---

## 🔍 Test 6 : Keywords riches (Recherche)

### Procédure

1. **Aller dans la recherche de services**
   - Fonction de recherche globale

2. **Chercher "plombier"**
   - Taper : `fuite eau`
   - ✅ **SUCCÈS** : Des services de plomberie apparaissent
   - ❌ **ÉCHEC** : Aucun résultat

3. **Chercher avec synonymes**
   - Taper : `WC bouché`
   - ✅ **SUCCÈS** : Des services de plomberie/débouchage apparaissent
   - ❌ **ÉCHEC** : Aucun résultat

4. **Chercher "électricien"**
   - Taper : `panne courant`
   - ✅ **SUCCÈS** : Des services d'électricité apparaissent
   - ❌ **ÉCHEC** : Aucun résultat

5. **Chercher avec marques**
   - Taper : `iPhone` (pour téléphone)
   - ✅ **SUCCÈS** : Des téléphones apparaissent
   - ❌ **ÉCHEC** : Aucun résultat

### Résultat attendu
✅ La recherche trouve des résultats avec synonymes, termes techniques, marques

---

## 📝 Formulaire de Résultats

### Test 1 : Champ nom auto-rempli
- [ ] ✅ SUCCÈS - Le champ nom est masqué et auto-rempli
- [ ] ❌ ÉCHEC - Le champ nom est visible
- [ ] ⚠️ PARTIELLEMENT - Fonctionne pour certaines catégories seulement

**Notes** :
```
[Vos observations ici]
```

### Test 2 : Ajout inline modalités
- [ ] ✅ SUCCÈS - Bouton inline fonctionne, pas de bouton externe
- [ ] ❌ ÉCHEC - Pas de bouton inline ou boutons externes présents
- [ ] ⚠️ PARTIELLEMENT - Fonctionne pour certains champs seulement

**Notes** :
```
[Vos observations ici]
```

### Test 3 : Devises compactes et correctes
- [ ] ✅ SUCCÈS - Devises affichées correctement, labels compacts
- [ ] ❌ ÉCHEC - $ hardcodé ou labels trop longs
- [ ] ⚠️ PARTIELLEMENT - Problème sur certains produits seulement

**Notes** :
```
[Vos observations ici]
```

### Test 4 : Clavier et boutons
- [ ] ✅ SUCCÈS - Boutons toujours accessibles
- [ ] ❌ ÉCHEC - Boutons masqués par le clavier
- [ ] ⚠️ PARTIELLEMENT - Problème sur certains écrans seulement

**Notes** :
```
[Vos observations ici]
```

### Test 5 : Modalités compactes
- [ ] ✅ SUCCÈS - Tags compacts et bien espacés
- [ ] ❌ ÉCHEC - Tags trop gros ou trop espacés
- [ ] ⚠️ PARTIELLEMENT - Variable selon les catégories

**Notes** :
```
[Vos observations ici]
```

### Test 6 : Keywords riches
- [ ] ✅ SUCCÈS - Recherche fonctionne avec synonymes et variantes
- [ ] ❌ ÉCHEC - Recherche ne trouve que les mots exacts
- [ ] ⚠️ PARTIELLEMENT - Fonctionne pour certaines catégories seulement

**Notes** :
```
[Vos observations ici]
```

---

## 🎯 Conclusion

### Si TOUS les tests sont ✅ SUCCÈS
→ **PARFAIT !** Tous les objectifs UX sont atteints. Aucune modification de code nécessaire.

### Si certains tests sont ❌ ÉCHEC
→ Consulter le rapport détaillé `AMELIORATIONS_UX_FORMULAIRES.md` pour les corrections à apporter.

### Si tests ⚠️ PARTIELLEMENT
→ Noter les catégories problématiques et consulter le rapport détaillé pour des modifications ciblées.

---

**Guide créé le** : 2025-01-31  
**Version** : 1.0  
**Durée estimée** : 10-15 minutes

