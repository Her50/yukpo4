// ✅ NOUVEAU: Preview de template vidéo avec détails et application

import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { VideoTemplate } from '../services/templateService';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './NativeDesign';
import { SafeIcon } from './SafeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_WIDTH = SCREEN_WIDTH - 64; // Padding
const PREVIEW_HEIGHT = (PREVIEW_WIDTH * 9) / 16; // 16:9 aspect ratio

interface TemplatePreviewProps {
    template: VideoTemplate;
    visible: boolean;
    onClose: () => void;
    onApply?: (template: VideoTemplate) => void;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
    template,
    visible,
    onClose,
    onApply,
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleApply = async () => {
        setIsLoading(true);
        try {
            // TODO: Convertir le template en VideoTimeline et appliquer
            // const timeline = convertTemplateToTimeline(template);
            onApply?.(template);
            onClose();
        } catch (error) {
            console.error('[TemplatePreview] Erreur application template:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                {template.is_premium && (
                                    <SafeIcon name="star" size={20} color={modernColors.warning} />
                                )}
                                <View>
                                    <Text style={styles.templateName}>{template.name}</Text>
                                    {template.subcategory && (
                                        <Text style={styles.templateSubcategory}>
                                            {template.subcategory}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Thumbnail/Preview */}
                        {template.thumbnail_url ? (
                            <Image
                                source={{ uri: template.thumbnail_url }}
                                style={styles.thumbnail}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                                <SafeIcon name="video" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.thumbnailPlaceholderText}>Aperçu</Text>
                            </View>
                        )}

                        {/* Description */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <Text style={styles.description}>{template.description}</Text>
                        </View>

                        {/* Métadonnées */}
                        <View style={styles.metadata}>
                            <View style={styles.metadataItem}>
                                <SafeIcon name="clock" size={16} color={modernColors.primary} />
                                <Text style={styles.metadataLabel}>Durée</Text>
                                <Text style={styles.metadataValue}>{template.duration}s</Text>
                            </View>
                            <View style={styles.metadataItem}>
                                <SafeIcon name="maximize" size={16} color={modernColors.primary} />
                                <Text style={styles.metadataLabel}>Format</Text>
                                <Text style={styles.metadataValue}>{template.format}</Text>
                            </View>
                            <View style={styles.metadataItem}>
                                <SafeIcon name="film" size={16} color={modernColors.primary} />
                                <Text style={styles.metadataLabel}>Industrie</Text>
                                <Text style={styles.metadataValue} numberOfLines={1}>
                                    {template.industry}
                                </Text>
                            </View>
                        </View>

                        {/* Effets */}
                        {template.effects && Array.isArray(template.effects) && template.effects.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Effets inclus</Text>
                                <View style={styles.tagsContainer}>
                                    {template.effects.slice(0, 10).map((effect, index) => (
                                        <View key={index} style={styles.tag}>
                                            <Text style={styles.tagText}>{effect}</Text>
                                        </View>
                                    ))}
                                    {template.effects.length > 10 && (
                                        <Text style={styles.moreTagsText}>
                                            +{String(template.effects.length - 10)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Transitions */}
                        {template.transitions && Array.isArray(template.transitions) && template.transitions.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Transitions incluses</Text>
                                <View style={styles.tagsContainer}>
                                    {template.transitions.map((transition, index) => (
                                        <View key={index} style={styles.tag}>
                                            <Text style={styles.tagText}>{transition}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Tags */}
                        {template.tags.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Tags</Text>
                                <View style={styles.tagsContainer}>
                                    {template.tags.map((tag, index) => (
                                        <View key={index} style={styles.tag}>
                                            <Text style={styles.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Stats */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Statistiques</Text>
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Utilisations</Text>
                                    <Text style={styles.statValue}>{template.usage_count}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Popularité</Text>
                                    <Text style={styles.statValue}>
                                        {template.popularity_score.toFixed(1)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <NativeButton
                            variant="secondary"
                            label="Fermer"
                            onPress={onClose}
                            style={styles.footerButton}
                        />
                        {onApply && (
                            <NativeButton
                                variant="primary"
                                label={isLoading ? "Application..." : "Appliquer"}
                                onPress={handleApply}
                                disabled={isLoading}
                                style={styles.footerButton}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 0,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    templateName: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    templateSubcategory: {
        fontSize: 14,
        color: modernColors.primary,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    closeButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnail: {
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        alignSelf: 'center',
        marginVertical: 20,
        borderRadius: 12,
    },
    thumbnailPlaceholder: {
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    thumbnailPlaceholderText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    metadata: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: modernColors.background,
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 24,
    },
    metadataItem: {
        alignItems: 'center',
        gap: 4,
    },
    metadataLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    metadataValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textTransform: 'capitalize',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 6,
    },
    tagText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    moreTagsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        alignSelf: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 24,
    },
    statItem: {
        gap: 4,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    footerButton: {
        flex: 1,
    },
});

