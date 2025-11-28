# Analyse en Profondeur - Navigation et Affichage des Étapes de Création Vidéo

## 🎯 Objectif
Analyser tous les composants de navigation vidéo, les pages utilisées, et détecter les anomalies d'affichage des étapes de création vidéo dans toutes les pages.

## 📋 Composants et Pages Identifiés

### 1. **Écran d'Introduction - `VideoCreationIntroScreen.tsx`**
- **Rôle** : Point d'entrée pour la création vidéo
- **Navigation** : Vers `VideoCreationWizardScreen`

### 2. **Wizard de Création - `VideoCreationWizardScreen.tsx`**
- **Rôle** : Assistant en 3 étapes pour configurer la vidéo
- **Étapes** : 
  - Step 1 : Brief, Style, Templates, Storyboard
  - Step 2 : Médias, Timeline (scènes), Audio
  - Step 3 : Résumé, Distribution, Prévisualisation

### 3. **Modal de Création - `ProductVideoCreationModal.tsx`**
- **Rôle** : Modal alternatif pour créer une vidéo depuis la liste de produits
- **Navigation** : Utilise directement l'API sans passer par le wizard

### 4. **Modal de Progression - `VideoProgressModal.tsx`**
- **Rôle** : Affiche les étapes de génération en temps réel
- **Étapes** : cost_estimation, broll_selection, timeline_generation, audio_mix, video_mux

### 5. **Écran de Résultat - `VideoGenerationResultScreen.tsx`**
- **Rôle** : Affiche le résultat de la génération avec les étapes complétées

## 🔍 Anomalies Détectées

### ❌ PROBLÈME 1 : Absence d'Indicateur Visuel des Étapes dans le Wizard

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 2054-2072)

**Problème** :
- Le header affiche seulement le nom du service et "Étape X"
- Pas d'indicateur visuel de progression (barre, points, pourcentage)
- L'utilisateur ne voit pas clairement où il se trouve dans le processus

**Code actuel** :
```tsx
<View style={styles.stepHeader}>
    <Text style={styles.stepTitle}>
        {format('videoWizard.meta.stepCountShort', { step })}
    </Text>
</View>
```

**Impact** : Mauvaise UX, pas de visibilité sur la progression globale

---

### ❌ PROBLÈME 2 : Synchronisation des Étapes de Progression

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 1045-1048)

**Problème** :
- Les `progress_steps` du serveur sont mappés et appliqués
- Mais il n'y a pas de vérification que toutes les étapes sont présentes
- Pas de gestion si les étapes serveur diffèrent des étapes locales

**Code actuel** :
```tsx
const mappedSteps = mapJobSteps(job.progress_steps);
if (mappedSteps) {
    applyServerSteps(mappedSteps);
}
```

**Impact** : Si le serveur envoie des étapes différentes, l'affichage peut être incohérent

---

### ❌ PROBLÈME 3 : États des Étapes Non Affichés dans le Wizard

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx`

**Problème** :
- Le wizard a 3 étapes (1, 2, 3) mais n'affiche pas leur statut
- Pas de visualisation si une étape est complétée, en cours, ou en attente
- Pas de possibilité de naviguer directement vers une étape complétée

**Impact** : L'utilisateur ne peut pas voir quelles étapes sont terminées

---

### ❌ PROBLÈME 4 : Modal de Progression Affiche des Étapes Différentes

**Fichier** : `mobile/src/components/VideoProgressModal.tsx` vs `mobile/src/hooks/useVideoGenerationProgress.ts`

**Problème** :
- `VideoProgressModal` affiche les étapes de génération (cost_estimation, broll_selection, etc.)
- `VideoCreationWizardScreen` a des étapes différentes (1, 2, 3 pour la configuration)
- Il n'y a pas de correspondance claire entre les deux systèmes d'étapes

**Impact** : Confusion pour l'utilisateur sur quelle progression suivre

---

### ❌ PROBLÈME 5 : ProductVideoCreationModal N'Utilise Pas le Système d'Étapes

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**Problème** :
- `ProductVideoCreationModal` génère directement la vidéo sans passer par le wizard
- N'affiche pas les étapes de configuration
- N'affiche pas non plus les étapes de progression pendant la génération
- Pas de `VideoProgressModal` affiché

**Impact** : Incohérence UX - deux chemins différents sans indication claire

---

### ❌ PROBLÈME 6 : Navigation Entre Étapes Sans Validation

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 790, 1838, 2018)

**Problème** :
- Passage à l'étape 2 sans valider que l'étape 1 est complète
- Pas de validation des champs requis avant de continuer
- L'utilisateur peut passer d'une étape à l'autre même si des informations manquent

**Code actuel** :
```tsx
setStep(2); // Pas de validation avant
```

**Impact** : L'utilisateur peut avoir des erreurs plus tard sans savoir pourquoi

---

### ❌ PROBLÈME 7 : Écran de Résultat N'Affiche Pas Toutes les Étapes

**Fichier** : `mobile/src/screens/video/VideoGenerationResultScreen.tsx` (ligne 98-115)

**Problème** :
- Affiche les `progress_steps` mais seulement avec `completed` ou non
- N'affiche pas les étapes `running` ou `pending`
- Utilise des valeurs par défaut si `progress_steps` est vide

**Code actuel** :
```tsx
{progressSteps.map((item) => (
    <View key={item.key} style={styles.progressRow}>
        <SafeIcon
            name={item.status === 'completed' ? 'check-circle' : 'circle'}
            // ...
        />
    </View>
))}
```

**Impact** : Perte d'information sur l'état réel des étapes

---

### ❌ PROBLÈME 8 : Hook useVideoGenerationProgress a des Étapes Par Défaut

**Fichier** : `mobile/src/hooks/useVideoGenerationProgress.ts` (ligne 5-11)

**Problème** :
- Les étapes par défaut sont codées en dur
- Si le serveur envoie des étapes différentes, il y a un décalage
- La simulation utilise ces étapes par défaut

**Code actuel** :
```tsx
export const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
    { key: 'cost_estimation', label: 'Budget validé', status: 'completed' },
    { key: 'broll_selection', label: 'B-roll & assets', status: 'pending' },
    // ...
];
```

**Impact** : Si le serveur change les étapes, l'affichage ne correspond pas

---

### ❌ PROBLÈME 9 : Pas d'Indicateur de Progression Globale

**Problème** :
- Le wizard affiche l'étape actuelle (1, 2, ou 3)
- Mais ne montre pas combien d'étapes sont complétées sur le total
- Pas de barre de progression globale

**Impact** : L'utilisateur ne sait pas où il en est dans le processus global

---

### ❌ PROBLÈME 10 : Deux Chemins de Navigation Différents

**Problème** :
1. **Chemin 1** : `VideoCreationIntroScreen` → `VideoCreationWizardScreen` (3 étapes) → Génération → `VideoProgressModal` → `VideoGenerationResultScreen`
2. **Chemin 2** : `ProductVideoCreationModal` → Génération directe (sans étapes visibles) → Résultat ?

**Impact** : UX incohérente, confusion pour l'utilisateur

---

### ❌ PROBLÈME 11 : VideoProgressModal Utilise des Props Différentes

**Fichier** : `mobile/src/components/VideoProgressModal.tsx` (ligne 2040-2044)

**Problème** :
- Le modal reçoit `steps` et `startTime`
- Mais il n'a pas accès au `job_id` pour suivre la progression réelle
- Il dépend du polling dans `VideoCreationWizardScreen`

**Impact** : Si le polling échoue, le modal affiche des informations obsolètes

---

### ❌ PROBLÈME 12 : Pas de Gestion d'État Persistant des Étapes

**Problème** :
- Si l'utilisateur ferme l'app pendant la génération, l'état des étapes est perdu
- Pas de sauvegarde locale de la progression
- Pas de récupération de l'état au retour

**Impact** : Mauvaise expérience si l'app crash ou se ferme

---

## 📊 Résumé des Anomalies

| # | Problème | Fichier | Gravité | Impact UX |
|---|----------|---------|---------|-----------|
| 1 | Pas d'indicateur visuel des étapes | VideoCreationWizardScreen.tsx | 🔴 Haute | Mauvaise navigation |
| 2 | Synchronisation étapes serveur | VideoCreationWizardScreen.tsx | 🟡 Moyenne | Incohérence |
| 3 | États des étapes non affichés | VideoCreationWizardScreen.tsx | 🔴 Haute | Pas de feedback |
| 4 | Deux systèmes d'étapes différents | Multiple | 🔴 Haute | Confusion |
| 5 | ProductVideoCreationModal sans étapes | ProductVideoCreationModal.tsx | 🟡 Moyenne | Incohérence |
| 6 | Navigation sans validation | VideoCreationWizardScreen.tsx | 🟠 Moyenne-Haute | Erreurs tardives |
| 7 | Résultat n'affiche pas tous les statuts | VideoGenerationResultScreen.tsx | 🟡 Moyenne | Perte d'info |
| 8 | Étapes par défaut codées en dur | useVideoGenerationProgress.ts | 🟡 Moyenne | Rigidité |
| 9 | Pas de progression globale | VideoCreationWizardScreen.tsx | 🔴 Haute | Mauvaise UX |
| 10 | Deux chemins de navigation | Multiple | 🔴 Haute | Confusion |
| 11 | Modal dépend du polling | VideoProgressModal.tsx | 🟠 Moyenne-Haute | Obsolescence |
| 12 | Pas de persistance d'état | Multiple | 🟡 Moyenne | Perte de progression |

## 🎯 Priorités de Correction

### 🔴 Priorité 1 - Haute Urgence
1. Ajouter un indicateur visuel des étapes dans le wizard
2. Unifier les deux systèmes d'étapes (wizard vs génération)
3. Afficher les états des étapes dans le wizard
4. Ajouter une barre de progression globale

### 🟠 Priorité 2 - Moyenne-Haute
5. Ajouter validation avant navigation entre étapes
6. Améliorer la synchronisation avec le serveur
7. Ajouter gestion d'état persistant

### 🟡 Priorité 3 - Moyenne
8. Unifier les deux chemins de navigation
9. Afficher toutes les étapes dans le résultat
10. Rendre les étapes dynamiques

