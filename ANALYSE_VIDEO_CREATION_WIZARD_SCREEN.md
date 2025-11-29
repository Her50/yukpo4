# 📋 Analyse : VideoCreationWizardScreen.tsx

## 🎯 Rôle principal

`VideoCreationWizardScreen` était un **écran de création vidéo en 3 étapes (wizard)** utilisé avant l'unification. Il offrait une interface guidée pour créer des vidéos produits avec un workflow étape par étape.

## 📐 Architecture

### **Structure en 3 étapes**

```typescript
type WizardStep = 1 | 2 | 3;
```

1. **Étape 1** : Configuration de base
   - Brief marketing
   - Headline
   - Call-to-action
   - Sélection de template de story
   - Mode (standard/expert)

2. **Étape 2** : Style et médias
   - Sélection de style (IntroPulse, ProductShowcase, etc.)
   - Sélection de médias (images/vidéos)
   - Assignation de médias aux scènes
   - Configuration audio (musique, voiceover)
   - Storyboard automatique ou manuel

3. **Étape 3** : Finalisation et publication
   - Chaînage de vidéos (dépendances)
   - Options de publication (chat, carte produit, réseaux sociaux)
   - Estimation de coût
   - Génération et suivi de progression

## 🔧 Fonctionnalités principales

### **1. Gestion de brouillons**
- ✅ Sauvegarde automatique du brouillon avec debounce
- ✅ Restauration du brouillon au démarrage
- ✅ Stockage local des préférences utilisateur

### **2. Storyboard automatique**
- ✅ Génération automatique de storyboard via IA
- ✅ Templates de story prédéfinis (blog, tutorial, testimonial, comparison)
- ✅ Assignation automatique de médias aux scènes
- ✅ Mode manuel pour personnaliser les scènes

### **3. Gestion des médias**
- ✅ Chargement des médias du produit
- ✅ Chargement des médias du service (fallback)
- ✅ Sélection multiple de médias
- ✅ Assignation de médias aux scènes individuelles

### **4. Configuration audio**
- ✅ Mode musique (pulse, lofi, ambient, cinematic, none)
- ✅ Voiceover avec sélection de langue
- ✅ Profils de voix personnalisés
- ✅ Volume de musique configurable

### **5. Styles et templates**
- ✅ Packs de style (pulse, story, corporate)
- ✅ Styles individuels (IntroPulse, ProductShowcase, ARHighlight, GlowCTA)
- ✅ Templates de story avec scènes suggérées

### **6. Chaînage de vidéos**
- ✅ Création de dépendances entre vidéos
- ✅ Liens vers sessions précédentes
- ✅ Gestion des séquences vidéo

### **7. Suivi de progression**
- ✅ Polling du statut de génération
- ✅ Modal de progression en temps réel
- ✅ Notifications de complétion

## ⚠️ Limitations (par rapport à ProductVideoCreationModal)

| Fonctionnalité | VideoCreationWizardScreen | ProductVideoCreationModal |
|----------------|---------------------------|---------------------------|
| **Champ script obligatoire** | ❌ Non (seulement brief optionnel) | ✅ Oui avec validation |
| **Prévisualisation timeline** | ❌ Non | ✅ Oui (TimelinePreview) |
| **Édition manuelle timeline** | ❌ Non | ✅ Oui (TimelineEditor) |
| **Génération timeline IA** | ❌ Non (storyboard texte) | ✅ Oui (generateVideoTimeline) |
| **Conversion ImmersiveTimeline** | ❌ Non | ✅ Oui (timeline_converter.rs) |
| **Interface** | Écran complet (3 étapes) | Modal (sections) |
| **Brouillons** | ✅ Oui | ❌ Non (mais peut être ajouté) |
| **Chaînage vidéos** | ✅ Oui | ❌ Non (mais peut être ajouté) |
| **Estimation coût** | ✅ Oui | ❌ Non (mais peut être ajouté) |

## 🔄 Workflow du wizard

```
1. Chargement service/produit
   ↓
2. Étape 1 : Brief & Template
   - Brief marketing
   - Headline
   - CTA
   - Template story
   ↓
3. Étape 2 : Style & Médias
   - Style pack
   - Sélection médias
   - Assignation scènes
   - Audio (musique, voiceover)
   - Storyboard auto/manuel
   ↓
4. Étape 3 : Finalisation
   - Chaînage vidéos
   - Options publication
   - Estimation coût
   ↓
5. Génération vidéo
   - Soumission
   - Polling statut
   - Suivi progression
```

## 💡 Points forts du wizard

1. **Workflow guidé** : Interface étape par étape claire
2. **Brouillons** : Sauvegarde automatique pour reprendre plus tard
3. **Chaînage** : Création de séquences vidéo liées
4. **Estimation** : Calcul du coût avant génération
5. **Storyboard manuel** : Contrôle fin sur les scènes

## ⚠️ Points faibles du wizard

1. **Pas de script obligatoire** : Le brief est optionnel
2. **Pas de timeline structurée** : Utilise storyboard texte
3. **Pas de prévisualisation** : Impossible de voir la timeline avant génération
4. **Pas d'édition** : Impossible de modifier la timeline après génération
5. **Interface lourde** : 3 écrans séparés au lieu d'un modal

## 🎯 Pourquoi l'unification ?

Le wizard avait des fonctionnalités intéressantes (brouillons, chaînage, estimation), mais manquait les **fonctionnalités critiques** récemment ajoutées :
- Script obligatoire pour l'IA
- Timeline structurée avec prévisualisation
- Édition manuelle de timeline

**Solution** : Unifier vers `ProductVideoCreationModal` qui a toutes les fonctionnalités modernes, et **migrer les fonctionnalités utiles** du wizard (brouillons, chaînage, estimation) si nécessaire.

## 📝 Recommandations

### **Option 1 : Garder le wizard pour cas avancés**
- Utiliser `ProductVideoCreationModal` pour le cas standard
- Garder `VideoCreationWizardScreen` pour les utilisateurs avancés qui veulent :
  - Chaînage de vidéos
  - Estimation de coût détaillée
  - Workflow en étapes séparées

### **Option 2 : Migrer les fonctionnalités utiles**
- Ajouter les brouillons à `ProductVideoCreationModal`
- Ajouter le chaînage de vidéos
- Ajouter l'estimation de coût
- Supprimer le wizard une fois migré

### **Option 3 : Déprécier le wizard**
- Marquer comme deprecated
- Rediriger vers `ProductVideoCreationModal`
- Supprimer après période de transition

## 🔍 Code clé

### **États principaux**
```typescript
const [step, setStep] = useState<WizardStep>(1);
const [brief, setBrief] = useState('');
const [headline, setHeadline] = useState('');
const [callToAction, setCallToAction] = useState('');
const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
const [sceneAssignments, setSceneAssignments] = useState<Record<string, number | null>>({});
```

### **Fonctionnalités uniques**
- `saveVideoDraft()` / `loadVideoDraft()` : Gestion brouillons
- `studioService.listSessions()` : Chaînage vidéos
- `estimateVideoCost()` : Estimation coût
- `validateStepCompletion()` : Validation étape par étape

## ✅ Conclusion

`VideoCreationWizardScreen` était un **wizard complet** avec des fonctionnalités avancées (brouillons, chaînage, estimation), mais manquait les **fonctionnalités critiques modernes** (script obligatoire, timeline structurée, prévisualisation).

L'unification vers `ProductVideoCreationModal` garantit que **tous les utilisateurs** ont accès aux fonctionnalités modernes, peu importe le chemin emprunté.

