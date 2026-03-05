import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeButton, NativeCard } from './SafeNativeDesign';

interface TutorialStep {
    id: string;
    title: string;
    description: string;
    icon: string;
    highlight?: string; // Texte à mettre en surbrillance
}

interface VideoCreationTutorialProps {
    visible: boolean;
    onClose: () => void;
    onSkip: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenue dans la création vidéo',
        description: 'Créez des vidéos promotionnelles professionnelles en quelques clics avec l\'intelligence artificielle de Yukpo.',
        icon: 'sparkles',
    },
    {
        id: 'select-product',
        title: 'Sélectionnez votre produit',
        description: 'Choisissez le produit ou service pour lequel vous souhaitez créer une vidéo. Vous pouvez sélectionner parmi vos produits existants.',
        icon: 'package',
    },
    {
        id: 'brief',
        title: 'Rédigez votre brief',
        description: 'Décrivez votre produit, votre message clé et votre objectif. L\'IA générera automatiquement un script adapté.',
        icon: 'edit',
    },
    {
        id: 'media',
        title: 'Ajoutez vos médias',
        description: 'Sélectionnez les images et vidéos que vous souhaitez utiliser. L\'IA les intégrera intelligemment dans votre vidéo.',
        icon: 'image',
    },
    {
        id: 'style',
        title: 'Personnalisez le style',
        description: 'Choisissez le style visuel, la musique et les effets qui correspondent à votre marque.',
        icon: 'palette',
    },
    {
        id: 'generate',
        title: 'Générez votre vidéo',
        description: 'Lancez la génération et suivez la progression en temps réel. Votre vidéo sera prête en quelques minutes !',
        icon: 'play-circle',
    },
];

const { width } = Dimensions.get('window');

const VideoCreationTutorial: React.FC<VideoCreationTutorialProps> = ({
    visible,
    onClose,
    onSkip,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            setCurrentStep(0);
        }
    }, [visible, fadeAnim, slideAnim]);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
            // Animation de transition
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            onClose();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    };

    const step = TUTORIAL_STEPS[currentStep];
    const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onSkip}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <NativeCard style={styles.card}>
                        {/* Header avec progression */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                                <Text style={styles.skipText}>Passer</Text>
                            </TouchableOpacity>
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBarBackground}>
                                    <Animated.View
                                        style={[
                                            styles.progressBarFill,
                                            {
                                                width: `${progress}%`,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressText}>
                                    {currentStep + 1} / {TUTORIAL_STEPS.length}
                                </Text>
                            </View>
                        </View>

                        {/* Contenu de l'étape */}
                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.contentContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.stepContent}>
                                <Animated.View
                                    style={[
                                        {
                                            opacity: fadeAnim,
                                            transform: [{ translateX: slideAnim }],
                                            alignItems: 'center',
                                            gap: 20,
                                        },
                                    ]}
                                >
                                    <View style={styles.iconContainer}>
                                        <SafeIcon name={step.icon as any} size={64} color={modernColors.primary} />
                                    </View>
                                    <Text style={styles.title}>{step.title}</Text>
                                    <Text style={styles.description}>{step.description}</Text>
                                </Animated.View>
                            </View>
                        </ScrollView>

                        {/* Indicateurs de pages */}
                        <View style={styles.dotsContainer}>
                            {TUTORIAL_STEPS.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        index === currentStep && styles.dotActive,
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Actions */}
                        <View style={styles.footer}>
                            {currentStep > 0 && (
                                <NativeButton
                                    title="Précédent"
                                    variant="outline"
                                    size="medium"
                                    onPress={handlePrevious}
                                    style={styles.button}
                                />
                            )}
                            <View style={{ flex: 1 }} />
                            <NativeButton
                                title={currentStep === TUTORIAL_STEPS.length - 1 ? 'Commencer' : 'Suivant'}
                                variant="primary"
                                size="medium"
                                onPress={handleNext}
                                style={styles.button}
                            />
                        </View>
                    </NativeCard>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 500,
    },
    card: {
        backgroundColor: modernColors.background,
        borderRadius: 24,
        padding: 24,
        maxHeight: '90%',
        minHeight: 450, // ✅ AUGMENTÉ: Hauteur minimale pour s'assurer que le contenu est visible
        maxWidth: '95%', // ✅ AJOUTÉ: S'assurer que le card ne dépasse pas l'écran
    },
    header: {
        marginBottom: 24,
    },
    skipButton: {
        alignSelf: 'flex-end',
        padding: 8,
        marginBottom: 12,
    },
    skipText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    progressContainer: {
        gap: 8,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    content: {
        flex: 1,
        minHeight: 250, // ✅ AUGMENTÉ: Hauteur minimale pour s'assurer que le contenu est visible
    },
    contentContainer: {
        paddingVertical: 16, // ✅ AUGMENTÉ: Plus de padding vertical
        flexGrow: 1,
        justifyContent: 'center', // ✅ CORRIGÉ: Centrer le contenu verticalement
        paddingHorizontal: 8, // ✅ AJOUTÉ: Padding horizontal pour éviter les coupures
    },
    stepContent: {
        alignItems: 'center',
        gap: 24, // ✅ AUGMENTÉ: Plus d'espace entre les éléments
        paddingVertical: 20, // ✅ AUGMENTÉ: Plus de padding vertical
        paddingHorizontal: 12, // ✅ AJOUTÉ: Padding horizontal pour éviter les coupures de texte
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: modernColors.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 26, // ✅ AUGMENTÉ: Police plus grande pour meilleure lisibilité
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
        marginBottom: 16, // ✅ AUGMENTÉ: Plus d'espace avec la description
        lineHeight: 32, // ✅ AJOUTÉ: Line height pour éviter les coupures
    },
    description: {
        fontSize: 18, // ✅ AUGMENTÉ: Police plus grande pour meilleure lisibilité
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 26, // ✅ AUGMENTÉ: Line height pour meilleure lisibilité
        paddingHorizontal: 8, // ✅ AJOUTÉ: Padding horizontal pour éviter les coupures
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        marginBottom: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.border,
    },
    dotActive: {
        backgroundColor: modernColors.primary,
        width: 24,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    button: {
        minWidth: 100,
    },
});

export default VideoCreationTutorial;

