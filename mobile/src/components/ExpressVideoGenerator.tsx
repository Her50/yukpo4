// ✅ NOUVEAU: Mode Express 1-Click - Raccourci intelligent vers les fonctionnalités existantes
// NE SUPPRIME AUCUN ÉCRAN - Utilise les composants existants avec une UX simplifiée

import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiPost } from '../services/api';
import { trackUxEvent } from '../services/uxMetrics';
import { modernColors } from '../theme/modernTheme';
import type { ManagedProduct } from '../types/ManagedProduct';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ExpressVideoGeneratorProps {
    product: ManagedProduct;
    onSuccess?: (videoUrl: string) => void;
    onError?: (error: string) => void;
}

// ✅ Styles prédéfinis optimisés pour 1-click
const EXPRESS_STYLES = {
    tiktok_viral: {
        name: 'TikTok Viral',
        style: 'tiktok',
        music_mode: 'pulse',
        duration_seconds: 15,
        auto_storyboard: true,
        generate_square_variant: true,
        generate_landscape_variant: false,
        enable_watermark: false,
        description: 'Format vertical 9:16 avec transitions rapides et musique tendance'
    },
    story_premium: {
        name: 'Story Premium',
        style: 'story',
        music_mode: 'lofi',
        duration_seconds: 20,
        auto_storyboard: true,
        generate_square_variant: false,
        generate_landscape_variant: false,
        enable_watermark: true,
        description: t('expressVideoGenerator.narrationEleganteAvecAmbiancePremium')
    },
    cinema_demo: {
        name: t('expressVideoGenerator.cinemaDemo'),
        style: 'cinematic',
        music_mode: 'cinematic',
        duration_seconds: 30,
        auto_storyboard: true,
        generate_square_variant: false,
        generate_landscape_variant: true,
        enable_watermark: true,
        description: t('expressVideoGenerator.productionCinematographiqueImmersive')
    }
};

export const ExpressVideoGenerator: React.FC<ExpressVideoGeneratorProps> = ({
    product,
    onSuccess,
    onError
}) => {
    const [loading, setLoading] = useState(false);

    const { t } = useLanguageSafe();    const [selectedStyle, setSelectedStyle] = useState<keyof typeof EXPRESS_STYLES>('tiktok_viral');
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, []);

    const generateExpressVideo = useCallback(async () => {
        setLoading(true);

        try {
            trackUxEvent('express_video_generate_started' as any, {
                productId: product.id,
                style: selectedStyle
            } as any);

            const config = EXPRESS_STYLES[selectedStyle];

            // ✅ Payload optimisé pour génération rapide
            const payload = {
                style: config.style,
                duration_seconds: config.duration_seconds,
                music_mode: config.music_mode,
                auto_storyboard: config.auto_storyboard,
                generate_square_variant: config.generate_square_variant,
                generate_landscape_variant: config.generate_landscape_variant,
                enable_watermark: config.enable_watermark,
                use_product_gallery: true,
                use_service_mediatech: true,
                auto_generate_images: true,
                generate_subtitles: true,
                subtitle_lang: 'fr',
                voiceover_lang: 'fr',
                // ✅ Optimisations IA
                use_ai_templates: true,
                style_effects: ['fade_in', 'slide_up', 'zoom_mild'],
                style_transitions: ['smooth_cut', 'cross_dissolve'],
                style_color_palette: 'vibrant',
                creation_source: 'media'
            };

            // ✅ Appel API optimisé
            const response = await apiPost(`/video/generate-express/${product.serviceId}/${product.productIndex}`, payload);

            const rd: any = response.data;
            if (response.success && rd?.video_url) {
                trackUxEvent('express_video_generate_success' as any, {
                    productId: product.id,
                    style: selectedStyle,
                    duration: rd.duration_seconds
                } as any);

                onSuccess?.(rd.video_url);

                // ✅ Feedback positif
                Alert.alert(
                    t('expressVideoGenerator.videoGeneree'),
                    t('expressVideoGenerator.votreVideoEstPretendureeSnstyle', { config_name: config.name, config_duration_seconds: config.duration_seconds, config_description: config.description }),
                    [{ text: 'OK', onPress: () => onSuccess?.(rd.video_url) }]
                );
            } else {
                throw new Error(response.error || t('expressVideoGenerator.erreurGenerationVideo'));
            }

        } catch (error: any) {
            console.error('[ExpressVideoGenerator] Erreur génération:', error);

            trackUxEvent('express_video_generate_error' as any, {
                productId: product.id,
                style: selectedStyle,
                error: error.message
            } as any);

            const errorMsg = error.message || t('expressVideoGenerator.erreurLorsDeLaGeneration');

            // ✅ Option de retry avec fallback
            Alert.alert(
                t('expressVideoGenerator.erreurDeGeneration'),
                t('expressVideoGenerator.nnvoulezvousEssayerAvecLeModeAvance', { errorMsg: errorMsg }),
                [
                    { text: t('common.retry'), onPress: () => generateExpressVideo() },
                    {
                        text: t('expressVideoGenerator.modeAvance'), onPress: () => {
                            // ✅ Rediriger vers l'interface complète existante
                            // Navigation vers ProductVideoCreationModal avec les mêmes params
                            onError?.('redirect_to_advanced');
                        }
                    },
                    { text: t('common.cancel'), style: 'cancel' }
                ]
            );

            onError?.(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [product, selectedStyle, onSuccess, onError]);

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <View style={styles.header}>
                <SafeIcon name="zap" size={24} color={modernColors.primary} />
                <Text style={styles.title}>{t('expressVideoGenerator.generationExpress')}</Text>
                <Text style={styles.subtitle}>{t('expressVideoGenerator.videoProfessionnelleEn1Clic')}</Text>
            </View>

            <View style={styles.stylesContainer}>
                {Object.entries(EXPRESS_STYLES).map(([key, config]) => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.styleCard,
                            selectedStyle === key && styles.styleCardSelected
                        ]}
                        onPress={() => setSelectedStyle(key as keyof typeof EXPRESS_STYLES)}
                        disabled={loading}
                    >
                        <View style={styles.styleHeader}>
                            <Text style={styles.styleName}>{config.name}</Text>
                            {selectedStyle === key && (
                                <SafeIcon name="check-circle" size={20} color={modernColors.primary} />
                            )}
                        </View>
                        <Text style={styles.styleDescription}>{config.description}</Text>
                        <View style={styles.styleMeta}>
                            <Text style={styles.styleDuration}>{config.duration_seconds}s</Text>
                            <Text style={styles.styleFormat}>
                                {config.generate_square_variant ? '9:16' : '16:9'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                onPress={generateExpressVideo}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <View style={styles.generateButtonContent}>
                        <SafeIcon name="play" size={20} color="whitet('expressVideoGenerator.textStylestylesgeneratebuttontextGenerer'){EXPRESS_STYLES[selectedStyle].name}"
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.advancedButton}
                onPress={() => onError?.('redirect_to_advanced')}
                disabled={loading}
            >
                <SafeIcon name="settings" size={16} color={modernColors.primary} />
                <Text style={styles.advancedButtonText}>{t('expressVideoGenerator.modeAvance')}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        margin: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        marginTop: 8,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    stylesContainer: {
        marginBottom: 20,
    },
    styleCard: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    styleCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}10`,
    },
    styleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    styleName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textPrimary,
    },
    styleDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 18,
    },
    styleMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    styleDuration: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    styleFormat: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    generateButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    generateButtonDisabled: {
        backgroundColor: modernColors.textLight,
        opacity: 0.6,
    },
    generateButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    generateButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    advancedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
    },
    advancedButtonText: {
        color: modernColors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
});

export default ExpressVideoGenerator;
