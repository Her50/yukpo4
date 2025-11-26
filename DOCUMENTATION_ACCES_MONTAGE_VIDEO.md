# 📹 Documentation : Accès aux pages de configuration et montage vidéo

*Date: 2025-11-25*

## 🎯 Structure du VideoCreationWizardScreen

Le `VideoCreationWizardScreen` comporte **3 étapes** pour créer une vidéo :

### Étape 1 : Configuration initiale
**Contenu** :
- ✅ Contexte (Service et Produit)
- ✅ Description/Brief du produit
- ✅ Style de vidéo (IntroPulse, ProductShowcase, ARHighlight, GlowCTA)
- ✅ Templates narratifs (Blog, Tutoriel, Témoignage, Comparatif)
- ✅ Storyboard IA (génération automatique de scènes)
- ✅ Mode (Standard ou Expert)

**Navigation** :
- Bouton "Suivant" → Passe à l'étape 2

### Étape 2 : Montage par scène ⭐
**Contenu** :
- ✅ Sélection des médias (images/vidéos)
- ✅ **Montage par scène** (Timeline) :
  - Chips horizontaux pour chaque scène (S1, S2, S3...)
  - Panel de configuration par scène :
    - Scène optionnelle (switch)
    - Assignation d'un média spécifique à chaque scène
    - Option "Laisser Yukpo choisir automatiquement"
- ✅ Configuration audio :
  - Voiceover (on/off)
  - Langue du voiceover (FR/EN)
  - Profils vocaux (création/sélection)
  - Mode musique (Background, Mix, None)

**Navigation** :
- Bouton "Précédent" → Retour à l'étape 1
- Bouton "Prévisualiser Timeline" → Passe à l'étape 3

### Étape 3 : Résumé et publication
**Contenu** :
- ✅ Résumé de la configuration
- ✅ Estimation du coût
- ✅ Prévisualisation rapide (3 secondes)
- ✅ Options de publication (Chat, Carte produit, Shorts sociaux)
- ✅ Bouton "Lancer le rendu"

**Navigation** :
- Bouton "Précédent" → Retour à l'étape 2
- Bouton "Lancer le rendu" → Génère la vidéo

---

## 🚀 Comment accéder au montage vidéo

### Depuis MesServicesScreen
1. Ouvrir un service
2. Cliquer sur le bouton "🎬 Créer la vidéo" d'un produit
3. L'écran `VideoCreationWizardScreen` s'ouvre à l'**étape 1**
4. Cliquer sur "Suivant" pour accéder à l'**étape 2** (Montage)

### Depuis MesProduitsScreen
1. Cliquer sur le bouton "🎬 Créer la vidéo" d'un produit
2. L'écran `VideoCreationWizardScreen` s'ouvre à l'**étape 1**
3. Cliquer sur "Suivant" pour accéder à l'**étape 2** (Montage)

---

## ⚠️ Problème potentiel identifié

**Symptôme** : L'utilisateur ne voit pas les formulaires de configuration des montages.

**Causes possibles** :
1. **L'étape 2 ne s'affiche pas** : Problème de navigation entre les étapes
2. **Les scènes ne sont pas générées** : Le storyboard IA n'a pas été généré à l'étape 1
3. **Les médias ne sont pas chargés** : Problème de chargement des médias du service/produit
4. **L'écran est vide** : Problème de rendu conditionnel (comme corrigé précédemment)

---

## ✅ Vérifications à faire

1. **Vérifier que l'étape 2 est accessible** :
   - Depuis l'étape 1, cliquer sur "Suivant"
   - L'étape 2 doit afficher :
     - Section "Médias sélectionnés"
     - Section "Montage par scène" (si des scènes existent)
     - Section "Configuration audio"

2. **Vérifier que les scènes sont générées** :
   - À l'étape 1, générer le storyboard IA
   - Les scènes doivent apparaître à l'étape 2 sous forme de chips horizontaux

3. **Vérifier que les médias sont chargés** :
   - Les médias du service/produit doivent être visibles à l'étape 2
   - Si aucun média, l'utilisateur doit pouvoir en ajouter

---

## 📝 Fichiers concernés

- `mobile/src/screens/video/VideoCreationWizardScreen.tsx` - Écran principal avec 3 étapes
- `mobile/src/utils/videoNavigation.ts` - Navigation vers le wizard
- `mobile/src/screens/MesServicesScreen.tsx` - Accès depuis les services
- `mobile/src/screens/MesProduitsScreen.tsx` - Accès depuis les produits

---

*Documentation créée le 2025-11-25*

