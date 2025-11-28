# Corrections des Anomalies de Navigation et Affichage des Étapes Vidéo

## 🎯 Vue d'Ensemble

Ce document détaille toutes les corrections à apporter pour résoudre les anomalies d'affichage et de navigation dans les pages de création vidéo.

## 📊 Anomalies Détectées et Corrections

### ❌ ANOMALIE 1 : Absence d'Indicateur Visuel des Étapes dans le Wizard

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 2054-2072)

**Problème Actuel** :
- Header affiche seulement "Étape X/3" en texte
- Pas de barre de progression visuelle
- Pas d'indicateurs de points pour chaque étape
- Pas de feedback visuel sur les étapes complétées

**Solution Proposée** :
Ajouter un indicateur visuel similaire à `CreateServiceScreen.tsx` avec :
- Points cliquables pour chaque étape (1, 2, 3)
- Barre de progression linéaire
- États visuels : complété (vert), actif (bleu), à venir (gris)
- Labels clairs pour chaque étape

**Code à Ajouter** :
```tsx
// Dans le header, remplacer le simple texte par un indicateur visuel
<View style={styles.stepHeader}>
    <TouchableOpacity onPress={() => navigation.goBack()}>
        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
    </TouchableOpacity>
    <View style={styles.stepHeaderContent}>
        <Text style={styles.stepService}>{serviceName}</Text>
        
        {/* ✅ NOUVEAU: Indicateur visuel des étapes */}
        <View style={styles.stepsIndicator}>
            {[1, 2, 3].map((stepNum) => {
                const isCompleted = step > stepNum;
                const isActive = step === stepNum;
                const stepLabels = [
                    t('videoWizard.steps.step1') || 'Configuration',
                    t('videoWizard.steps.step2') || 'Médias',
                    t('videoWizard.steps.step3') || 'Résumé'
                ];
                
                return (
                    <React.Fragment key={stepNum}>
                        <TouchableOpacity
                            style={[
                                styles.stepDot,
                                isCompleted && styles.stepDotCompleted,
                                isActive && styles.stepDotActive
                            ]}
                            onPress={() => {
                                // ✅ Validation avant navigation
                                if (stepNum < step || validateStepCompletion(stepNum)) {
                                    setStep(stepNum as WizardStep);
                                }
                            }}
                            disabled={!isCompleted && stepNum !== step}
                        >
                            {isCompleted ? (
                                <SafeIcon name="check" size={16} color="#FFF" />
                            ) : (
                                <Text style={[
                                    styles.stepNumber,
                                    isActive && styles.stepNumberActive
                                ]}>
                                    {stepNum}
                                </Text>
                            )}
                        </TouchableOpacity>
                        {stepNum < 3 && (
                            <View style={[
                                styles.stepConnector,
                                isCompleted && styles.stepConnectorCompleted
                            ]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
        <Text style={styles.stepTitle}>
            {stepLabels[step - 1]} ({step}/3)
        </Text>
    </View>
    <View style={{ width: 24 }} />
</View>
```

---

### ❌ ANOMALIE 2 : Synchronisation des Étapes de Progression

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 1020-1030)

**Problème Actuel** :
- Les étapes serveur sont mappées directement sans validation
- Pas de gestion si les clés ne correspondent pas
- Pas de fallback si des étapes manquent

**Solution Proposée** :
- Valider les clés des étapes avant de les appliquer
- Fusionner les étapes serveur avec les étapes par défaut
- Logger les différences pour debugging

**Code à Corriger** :
```tsx
const mapJobSteps = useCallback((jobSteps?: VideoJobStatus['progress_steps']) => {
    if (!jobSteps || jobSteps.length === 0) {
        log::warn("[VideoCreationWizard] Aucune étape serveur reçue");
        return undefined;
    }
    
    // ✅ NOUVEAU: Valider et normaliser les étapes serveur
    const validSteps = jobSteps
        .filter((step) => {
            // Valider que l'étape a les champs requis
            if (!step.key || !step.label) {
                log::warn("[VideoCreationWizard] Étape serveur invalide ignorée: {:?}", step);
                return false;
            }
            return true;
        })
        .map((step) => ({
            key: step.key,
            label: step.label || step.key,
            status: step.status || 'pending',
            detail: step.detail || null,
        }));
    
    // ✅ NOUVEAU: Fusionner avec les étapes par défaut si nécessaire
    if (validSteps.length === 0) {
        log::warn("[VideoCreationWizard] Toutes les étapes serveur invalides, utilisation par défaut");
        return undefined;
    }
    
    log::info("[VideoCreationWizard] ✅ {} étapes serveur validées", validSteps.len());
    return validSteps;
}, []);
```

---

### ❌ ANOMALIE 3 : États des Étapes Non Affichés dans le Wizard

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx`

**Problème Actuel** :
- Les 3 étapes du wizard n'ont pas de statut (complété/en cours/en attente)
- Pas de suivi de la progression dans le wizard
- Pas de possibilité de savoir quelles étapes sont terminées

**Solution Proposée** :
- Ajouter un système de tracking des étapes complétées
- Stocker l'état dans le state local
- Afficher visuellement les étapes complétées dans l'indicateur

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: État pour tracker les étapes complétées
const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

// ✅ NOUVEAU: Fonction pour marquer une étape comme complétée
const markStepCompleted = useCallback((stepNum: WizardStep) => {
    setCompletedSteps((prev) => new Set([...prev, stepNum]));
}, []);

// ✅ NOUVEAU: Validation avant navigation vers étape suivante
const validateStepCompletion = useCallback((stepNum: WizardStep): boolean => {
    switch (stepNum) {
        case 1:
            // Valider que le brief ou les templates sont définis
            return brief.trim().length > 0 || storyTemplateId !== null;
        case 2:
            // Valider que des médias sont sélectionnés ou disponibles
            return selectedMediaIds.length > 0 || mediaItems.length > 0;
        case 3:
            // Validation finale avant génération
            return true;
        default:
            return false;
    }
}, [brief, storyTemplateId, selectedMediaIds, mediaItems]);

// ✅ NOUVEAU: Vérifier lors de la navigation
const handleStepChange = useCallback((newStep: WizardStep) => {
    const currentStepNum = step;
    
    // Si on revient en arrière, c'est toujours OK
    if (newStep < currentStepNum) {
        setStep(newStep);
        return;
    }
    
    // Si on avance, valider l'étape actuelle
    if (validateStepCompletion(currentStepNum)) {
        markStepCompleted(currentStepNum);
        setStep(newStep);
    } else {
        Alert.alert(
            'Étape incomplète',
            'Veuillez compléter les informations requises avant de continuer.'
        );
    }
}, [step, validateStepCompletion, markStepCompleted]);
```

---

### ❌ ANOMALIE 4 : Deux Systèmes d'Étapes Différents

**Problème Actuel** :
- Wizard a 3 étapes (configuration)
- Génération a 5 étapes différentes (cost_estimation, broll_selection, etc.)
- Pas de correspondance claire

**Solution Proposée** :
- Séparer clairement : "Étapes de Configuration" vs "Étapes de Génération"
- Afficher les deux systèmes dans des sections distinctes
- Ajouter une transition visuelle entre les deux phases

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: États distincts
const [configurationPhase, setConfigurationPhase] = useState(true);
const [generationPhase, setGenerationPhase] = useState(false);

// Dans le header, afficher selon la phase
{configurationPhase && (
    <View style={styles.phaseIndicator}>
        <Text style={styles.phaseLabel}>Configuration</Text>
        <View style={styles.stepsIndicator}>
            {/* Indicateur des 3 étapes du wizard */}
        </View>
    </View>
)}

{generationPhase && (
    <View style={styles.phaseIndicator}>
        <Text style={styles.phaseLabel}>Génération en cours</Text>
        <VideoProgressModal
            visible={isGenerating}
            steps={progressSteps}
            startTime={generationStartTime}
        />
    </View>
)}
```

---

### ❌ ANOMALIE 5 : ProductVideoCreationModal Sans Étapes Visibles

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**Problème Actuel** :
- Modal génère directement sans afficher d'étapes
- Pas de `VideoProgressModal` pendant la génération
- Pas de feedback visuel sur la progression

**Solution Proposée** :
- Ajouter un système d'étapes simplifié dans le modal
- Afficher `VideoProgressModal` pendant la génération
- Suivre le job_id pour afficher la progression

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: Ajouter les étapes dans ProductVideoCreationModal
const [generationSteps, setGenerationSteps] = useState<ProgressStep[]>([]);
const [isGenerating, setIsGenerating] = useState(false);
const [generationJobId, setGenerationJobId] = useState<string | null>(null);

// ✅ NOUVEAU: Hook pour suivre la progression
const {
    steps: progressSteps,
    applyServerSteps,
    reset: resetProgress,
} = useVideoGenerationProgress();

// ✅ NOUVEAU: Afficher le modal de progression
{isGenerating && (
    <VideoProgressModal
        visible={isGenerating}
        steps={progressSteps}
        startTime={generationStartTime}
    />
)}

// ✅ NOUVEAU: Polling pour suivre la progression
useEffect(() => {
    if (!generationJobId || !isGenerating) return;
    
    const interval = setInterval(async () => {
        const status = await mediaApi.getVideoJobStatus(generationJobId);
        if (status.success && status.data) {
            const mappedSteps = mapJobSteps(status.data.progress_steps);
            if (mappedSteps) {
                applyServerSteps(mappedSteps);
            }
            
            if (status.data.status === 'completed') {
                setIsGenerating(false);
                clearInterval(interval);
            }
        }
    }, 2000);
    
    return () => clearInterval(interval);
}, [generationJobId, isGenerating]);
```

---

### ❌ ANOMALIE 6 : Navigation Entre Étapes Sans Validation

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 790, 1838, 2018)

**Problème Actuel** :
- `setStep(2)` appelé directement sans validation
- Pas de vérification des champs requis
- Erreurs découvertes tardivement

**Solution Proposée** :
- Créer une fonction de validation pour chaque étape
- Valider avant de permettre la navigation
- Afficher des messages d'erreur clairs

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: Validation avant navigation
const canProceedToStep = useCallback((targetStep: WizardStep): { canProceed: boolean; error?: string } => {
    if (targetStep === 2 && step === 1) {
        // Valider étape 1
        if (!brief.trim() && !storyTemplateId) {
            return {
                canProceed: false,
                error: 'Veuillez renseigner un brief ou sélectionner un template narratif.'
            };
        }
        if (!selectedStyle) {
            return {
                canProceed: false,
                error: 'Veuillez sélectionner un style de vidéo.'
            };
        }
    }
    
    if (targetStep === 3 && step === 2) {
        // Valider étape 2 (optionnel - médias peuvent être auto-sélectionnés)
        // Pas de validation stricte ici
    }
    
    return { canProceed: true };
}, [step, brief, storyTemplateId, selectedStyle]);

// ✅ NOUVEAU: Utiliser cette validation dans les boutons
const handleNextStep = useCallback(() => {
    const nextStep = (step + 1) as WizardStep;
    const validation = canProceedToStep(nextStep);
    
    if (!validation.canProceed) {
        Alert.alert('Étape incomplète', validation.error || 'Veuillez compléter les champs requis.');
        return;
    }
    
    markStepCompleted(step);
    setStep(nextStep);
}, [step, canProceedToStep, markStepCompleted]);
```

---

### ❌ ANOMALIE 7 : Écran de Résultat N'Affiche Pas Tous les Statuts

**Fichier** : `mobile/src/screens/video/VideoGenerationResultScreen.tsx` (ligne 100-114)

**Problème Actuel** :
- Affiche seulement `completed` ou `circle` (non complété)
- Pas de distinction entre `running`, `pending`, `failed`
- Perte d'information sur l'état réel

**Solution Proposée** :
- Afficher tous les statuts possibles avec des icônes appropriées
- Ajouter des couleurs distinctes pour chaque statut
- Afficher les détails si disponibles

**Code à Corriger** :
```tsx
{progressSteps.map((item) => {
    const isCompleted = item.status === 'completed';
    const isRunning = item.status === 'running';
    const isFailed = item.status === 'failed';
    const isPending = item.status === 'pending';
    
    return (
        <View key={item.key} style={styles.progressRow}>
            <SafeIcon
                name={
                    isCompleted ? 'check-circle' :
                    isFailed ? 'x-circle' :
                    isRunning ? 'loader' :
                    'circle'
                }
                size={20}
                color={
                    isCompleted ? modernColors.success :
                    isFailed ? modernColors.error :
                    isRunning ? modernColors.primary :
                    modernColors.textSecondary
                }
            />
            <View style={{ flex: 1 }}>
                <Text style={[
                    styles.progressLabel,
                    isCompleted && styles.progressLabelCompleted,
                    isFailed && styles.progressLabelFailed,
                    isRunning && styles.progressLabelRunning,
                ]}>
                    {item.label}
                </Text>
                {item.detail && (
                    <Text style={styles.progressDetail}>{item.detail}</Text>
                )}
            </View>
        </View>
    );
})}
```

---

### ❌ ANOMALIE 8 : Étapes Par Défaut Codées en Dur

**Fichier** : `mobile/src/hooks/useVideoGenerationProgress.ts` (ligne 5-11)

**Problème Actuel** :
- Étapes hardcodées dans le hook
- Pas de flexibilité si le serveur change les étapes
- Simulation utilise toujours les mêmes étapes

**Solution Proposée** :
- Rendre les étapes par défaut configurables
- Permettre au serveur de définir les étapes
- Garder les étapes par défaut comme fallback uniquement

**Code à Corriger** :
```tsx
// ✅ NOUVEAU: Étapes par défaut comme fallback uniquement
export const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
    { key: 'cost_estimation', label: 'Budget validé', status: 'pending' },
    { key: 'broll_selection', label: 'B-roll & assets', status: 'pending' },
    { key: 'timeline_generation', label: 'Timeline immersive', status: 'pending' },
    { key: 'audio_mix', label: 'Mix audio premium', status: 'pending' },
    { key: 'video_mux', label: 'Master vidéo', status: 'pending' },
];

// ✅ NOUVEAU: Fonction pour fusionner les étapes serveur avec les défaut
const mergeStepsWithDefaults = (
    serverSteps?: ProgressStep[],
    defaults: ProgressStep[] = DEFAULT_PROGRESS_STEPS
): ProgressStep[] => {
    if (!serverSteps || serverSteps.length === 0) {
        return defaults;
    }
    
    // Créer un map des étapes serveur par clé
    const serverMap = new Map(serverSteps.map(s => [s.key, s]));
    
    // Fusionner : serveur prioritaire, défaut en fallback
    return defaults.map(defaultStep => {
        const serverStep = serverMap.get(defaultStep.key);
        return serverStep || defaultStep;
    });
};

// ✅ NOUVEAU: Utiliser la fusion dans applyServerSteps
const applyServerSteps = useCallback(
    (serverSteps?: ProgressStep[] | null) => {
        clearSimulation();
        const merged = mergeStepsWithDefaults(serverSteps, DEFAULT_PROGRESS_STEPS);
        setSteps(merged);
        log::info("[useVideoGenerationProgress] {} étapes appliquées", merged.len());
    },
    [clearSimulation],
);
```

---

### ❌ ANOMALIE 9 : Pas d'Indicateur de Progression Globale

**Problème Actuel** :
- Pas de barre de progression globale dans le wizard
- Pas de pourcentage de complétion
- L'utilisateur ne voit pas sa progression

**Solution Proposée** :
- Ajouter une barre de progression en haut du wizard
- Calculer le pourcentage basé sur les étapes complétées
- Afficher un résumé de progression

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: Calculer la progression globale
const globalProgress = useMemo(() => {
    const totalSteps = 3;
    const completed = completedSteps.size;
    return Math.round((completed / totalSteps) * 100);
}, [completedSteps]);

// ✅ NOUVEAU: Afficher la barre de progression
<View style={styles.globalProgressContainer}>
    <View style={styles.globalProgressBar}>
        <Animated.View
            style={[
                styles.globalProgressFill,
                { width: `${globalProgress}%` }
            ]}
        />
    </View>
    <Text style={styles.globalProgressText}>
        {globalProgress}% complété
    </Text>
</View>
```

---

### ❌ ANOMALIE 10 : Deux Chemins de Navigation Différents

**Problème Actuel** :
- Chemin 1 : Intro → Wizard (3 étapes) → Génération → Résultat
- Chemin 2 : Modal → Génération directe → Résultat
- UX incohérente

**Solution Proposée** :
- Unifier les deux chemins
- Faire en sorte que `ProductVideoCreationModal` utilise aussi le wizard
- Ou ajouter un indicateur clair des étapes dans le modal

**Recommandation** :
Option 1 : Rediriger vers le wizard depuis le modal
Option 2 : Ajouter les mêmes étapes visuelles dans le modal

---

### ❌ ANOMALIE 11 : Modal Dépend du Polling

**Fichier** : `mobile/src/components/VideoProgressModal.tsx`

**Problème Actuel** :
- Le modal n'a pas accès direct au `job_id`
- Dépend du polling dans le parent
- Peut afficher des données obsolètes

**Solution Proposée** :
- Passer le `job_id` au modal
- Implémenter le polling directement dans le modal
- Gérer les erreurs de polling

**Code à Ajouter** :
```tsx
interface VideoProgressModalProps {
    visible: boolean;
    steps: ProgressStep[];
    startTime?: number;
    jobId?: string | null; // ✅ NOUVEAU
    onPollStatus?: (jobId: string) => Promise<void>; // ✅ NOUVEAU
}

// ✅ NOUVEAU: Polling dans le modal si jobId fourni
useEffect(() => {
    if (!visible || !jobId || !onPollStatus) return;
    
    const interval = setInterval(() => {
        onPollStatus(jobId);
    }, 2000);
    
    return () => clearInterval(interval);
}, [visible, jobId, onPollStatus]);
```

---

### ❌ ANOMALIE 12 : Pas de Persistance d'État

**Problème Actuel** :
- Si l'app se ferme, l'état est perdu
- Pas de sauvegarde de la progression
- Pas de récupération au retour

**Solution Proposée** :
- Utiliser `videoDraftStorage.ts` pour sauvegarder l'état
- Sauvegarder après chaque changement d'étape
- Restaurer au retour sur l'écran

**Code à Ajouter** :
```tsx
// ✅ NOUVEAU: Sauvegarder l'état après chaque changement
useEffect(() => {
    if (step && serviceId !== undefined && productIndex !== undefined) {
        saveVideoDraft({
            serviceId,
            productIndex,
            step,
            brief,
            selectedStyle,
            storyTemplateId,
            selectedMediaIds,
            // ... autres champs
        });
    }
}, [step, brief, selectedStyle, storyTemplateId, selectedMediaIds]);

// ✅ NOUVEAU: Restaurer l'état au chargement
useEffect(() => {
    const restoreDraft = async () => {
        if (!serviceId || productIndex === undefined) return;
        
        const draft = await loadVideoDraft(serviceId, productIndex);
        if (draft) {
            setStep(draft.step || 1);
            setBrief(draft.brief || '');
            // ... restaurer les autres champs
        }
    };
    
    restoreDraft();
}, [serviceId, productIndex]);
```

---

## 📝 Styles à Ajouter

```tsx
const styles = StyleSheet.create({
    // ✅ NOUVEAU: Styles pour l'indicateur d'étapes
    stepHeaderContent: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    stepsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotCompleted: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    stepDotActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    stepNumberActive: {
        color: '#FFF',
    },
    stepConnector: {
        width: 24,
        height: 2,
        backgroundColor: modernColors.border,
    },
    stepConnectorCompleted: {
        backgroundColor: modernColors.success,
    },
    
    // ✅ NOUVEAU: Barre de progression globale
    globalProgressContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    globalProgressBar: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    globalProgressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    globalProgressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    
    // ✅ NOUVEAU: Styles pour les statuts d'étapes
    progressLabelCompleted: {
        color: modernColors.success,
    },
    progressLabelFailed: {
        color: modernColors.error,
    },
    progressLabelRunning: {
        color: modernColors.primary,
    },
});
```

---

## 🎯 Plan d'Implémentation

### Phase 1 - Priorité Haute
1. ✅ Ajouter indicateur visuel des étapes dans le wizard
2. ✅ Ajouter validation avant navigation
3. ✅ Ajouter barre de progression globale
4. ✅ Corriger affichage des statuts dans le résultat

### Phase 2 - Priorité Moyenne-Haute
5. ✅ Améliorer synchronisation avec serveur
6. ✅ Ajouter tracking des étapes complétées
7. ✅ Unifier ProductVideoCreationModal avec le wizard

### Phase 3 - Priorité Moyenne
8. ✅ Ajouter persistance d'état
9. ✅ Améliorer VideoProgressModal avec polling intégré
10. ✅ Rendre les étapes dynamiques

