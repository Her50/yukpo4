import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width } = Dimensions.get('window');
const PREVIEW_WIDTH = width * 0.4;

interface AdPreviewCardProps {
    titre: string;
    description: string;
    thumbnail?: string;
    videoCount: number;
    productCount: number;
    zone: string;
    duree: number;
}

export const AdPreviewCard: React.FC<AdPreviewCardProps> = ({
    titre,
    description,
    thumbnail,
    videoCount,
    productCount,
    zone,
    duree,
}) => {
    const getZoneIcon = (zone: string) => {
        switch (zone) {
            case 'local':
                return 'map-pin';
            case 'regional':
                return 'globe';
            case 'international':
                return 'globe';
            default:
                return 'map-pin';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.previewTitle}>{t('adPreviewCard.apercu')}</Text>
            <View style={styles.card}>
                {/* Media Section */}
                <View style={styles.mediaSection}>
                    {thumbnail ? (
                        <Image
                            source={{ uri: thumbnail }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholderMedia}>
                            <SafeIcon name="video" size={32} color={modernColors.textTertiary} />
                        </View>
                    )}
                    {videoCount > 0 && (
                        <View style={styles.videoBadge}>
                            <SafeIcon name="play" size={12} color="#fff" />
                            <Text style={styles.videoBadgeText}>{videoCount}</Text>
                        </View>
                    )}
                </View>

                {/* Content Section */}
                <View style={styles.contentSection}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {titre || t('adPreviewCard.titreDeVotrePublicite')}
                    </Text>
                    {description ? (
                        <Text style={styles.cardDescription} numberOfLines={2}>
                            {description}
                        </Text>
                    ) : null}

                    <View style={styles.metricsRow}>
                        <View style={styles.metric}>
                            <SafeIcon name="package" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.metricText}>{productCount}</Text>
                        </View>
                        <View style={styles.metric}>
                            <SafeIcon name="calendar" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.metricText}>{duree}j</Text>
                        </View>
                    </View>

                    <View style={styles.footerRow}>
                        <View style={styles.zoneBadge}>
                            <SafeIcon
                                name={getZoneIcon(zone)}
                                size={10}
                                color="#fff"
                            />
                            <Text style={styles.zoneText}>
                                {zone === 'local'
                                    ? 'Local'
                                    : zone === 'regional'
                                        ? t('adPreviewCard.regional')
                                        : 'International'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    card: {
        width: PREVIEW_WIDTH,
        borderRadius: 16,
        backgroundColor: modernColors.surface,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    mediaSection: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: modernColors.surfaceVariant,
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    placeholderMedia: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surfaceVariant,
    },
    videoBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    videoBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    contentSection: {
        padding: 12,
        gap: 8,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
    },
    cardDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
        lineHeight: 14,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metric: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    zoneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    zoneText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
    },
});

