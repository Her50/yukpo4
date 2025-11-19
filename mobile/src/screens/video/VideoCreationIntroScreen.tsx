import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';

interface VideoCreationIntroParams {
    serviceId?: number;
    productId?: number;
    productIndex?: number;
    productName?: string;
}

type Navigation = ReturnType<typeof useNavigation>;

const VideoCreationIntroScreen: React.FC = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute();
    const params = (route.params || {}) as VideoCreationIntroParams;
    const { t } = useLanguageSafe();
    const headerAnim = useRef(new Animated.Value(0)).current;
    const heroAnim = useRef(new Animated.Value(0)).current;
    const contentAnim = useRef(new Animated.Value(0)).current;
    const actionsAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(120, [
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 420,
                useNativeDriver: true,
            }),
            Animated.spring(heroAnim, {
                toValue: 1,
                damping: 12,
                stiffness: 120,
                useNativeDriver: true,
            }),
            Animated.timing(contentAnim, {
                toValue: 1,
                duration: 420,
                useNativeDriver: true,
            }),
            Animated.timing(actionsAnim, {
                toValue: 1,
                duration: 360,
                useNativeDriver: true,
            }),
        ]).start();
    }, [headerAnim, heroAnim, contentAnim, actionsAnim]);

    const fadeUp = (anim: Animated.Value, offset = 16) => ({
        opacity: anim,
        transform: [
            {
                translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [offset, 0],
                }),
            },
        ],
    });

    const handleStart = () => {
        console.log('[VideoCreationIntroScreen] 🎬 Navigation vers VideoCreationWizard', params);
        try {
            // ✅ CORRIGÉ: Utiliser getParent() pour naviguer depuis Tab Navigator vers Stack Navigator
            const parentNavigation = (navigation as any).getParent();
            if (parentNavigation) {
                parentNavigation.navigate('VideoCreationWizard', params);
                console.log('[VideoCreationIntroScreen] ✅ Navigation réussie via parent');
            } else {
                navigation.navigate('VideoCreationWizard' as never, params as never);
                console.log('[VideoCreationIntroScreen] ✅ Navigation réussie (directe)');
            }
        } catch (error) {
            console.error('[VideoCreationIntroScreen] ❌ Erreur navigation vers VideoCreationWizard:', error);
            // Fallback: essayer navigation directe
            try {
                navigation.navigate('VideoCreationWizard' as never, params as never);
            } catch (fallbackError) {
                console.error('[VideoCreationIntroScreen] ❌ Erreur navigation fallback:', fallbackError);
            }
        }
    };

    const handleShowExample = () => {
        console.log('[VideoCreationIntroScreen] 📺 Affichage d\'un exemple de vidéo');
        // ✅ CORRIGÉ: Afficher un exemple réel en ouvrant une vidéo exemple ou en naviguant vers une vidéo spécifique
        try {
            const parentNavigation = (navigation as any).getParent();
            if (parentNavigation) {
                // Naviguer vers VideoFeed avec un paramètre pour afficher un exemple
                parentNavigation.navigate('VideoFeed', {
                    showExample: true,
                    exampleVideoId: 'example' // Indicateur pour afficher un exemple
                });
            } else {
                navigation.navigate('VideoFeed' as never, {
                    showExample: true,
                    exampleVideoId: 'example'
                } as never);
            }
        } catch (error) {
            console.error('[VideoCreationIntroScreen] ❌ Erreur navigation vers VideoFeed:', error);
            // Fallback: Afficher une alerte avec un lien vers un exemple
            Alert.alert(
                'Exemple de vidéo',
                'Pour voir un exemple de vidéo immersive créée avec Yukpo, consultez la section Vidéo dans l\'application.',
                [{ text: 'OK' }]
            );
        }
    };

    return (
        <SafeNativeView style={styles.container} edges={['top', 'bottom']}>
            <Animated.View style={[styles.header, fadeUp(headerAnim, 18)]}>
                <SafeIcon name="sparkles" size={32} color={modernColors.primary} />
                <Text style={styles.title}>{t('video.intro.title')}</Text>
                <Text style={styles.subtitle}>{t('video.intro.subtitle')}</Text>
            </Animated.View>

            <Animated.View style={[fadeUp(heroAnim, 20)]}>
                <NativeCard style={styles.heroCard}>
                    <Image
                        source={{
                            uri: 'https://cdn.yukpo.com/illustrations/video-immersive-hero.png',
                        }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <View style={styles.heroOverlay}>
                        <Text style={styles.heroTitle}>{t('video.intro.heroTitle')}</Text>
                        <Text style={styles.heroDescription}>{t('video.intro.heroDescription')}</Text>
                    </View>
                </NativeCard>
            </Animated.View>

            <Animated.View style={[styles.benefits, fadeUp(contentAnim, 14)]}>
                <View style={styles.benefitItem}>
                    <SafeIcon name="film" size={28} color={modernColors.primary} />
                    <Text style={styles.benefitText}>{t('video.intro.benefit.timeline')}</Text>
                </View>
                <View style={styles.benefitItem}>
                    <SafeIcon name="sparkle" size={28} color={modernColors.primary} />
                    <Text style={styles.benefitText}>{t('video.intro.benefit.broll')}</Text>
                </View>
                <View style={styles.benefitItem}>
                    <SafeIcon name="volume" size={28} color={modernColors.primary} />
                    <Text style={styles.benefitText}>{t('video.intro.benefit.audio')}</Text>
                </View>
            </Animated.View>

            <Animated.View style={[styles.actions, fadeUp(actionsAnim, 10)]}>
                <NativeButton
                    title={t('video.intro.createButton')}
                    size="large"
                    variant="primary"
                    onPress={handleStart}
                />
                <NativeButton
                    title={t('video.intro.exampleButton')}
                    size="large"
                    variant="secondary"
                    onPress={handleShowExample}
                />
            </Animated.View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: modernColors.background,
    },
    header: {
        marginBottom: 16,
        gap: 12,
        paddingHorizontal: 4, // ✅ Ajout de padding pour éviter le débordement
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        paddingRight: 8, // ✅ Ajout de padding à droite pour éviter le débordement
    },
    subtitle: {
        fontSize: 15,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    heroCard: {
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        padding: 20,
        justifyContent: 'flex-end',
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 6,
    },
    heroDescription: {
        fontSize: 15,
        color: '#F8FAFC',
        lineHeight: 20,
    },
    benefits: {
        marginBottom: 32,
        gap: 18,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    benefitText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    actions: {
        marginTop: 'auto',
        gap: 12,
    },
});

export default VideoCreationIntroScreen;
