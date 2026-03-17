// ✅ NOUVEAU Phase 2: Composant de clip pour timeline multi-pistes

import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { TimelineClip, TrackType } from '../types/AdvancedTimeline';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ClipComponentProps {
    clip: TimelineClip;
    trackType: TrackType;
    pixelsPerSecond: number; // Conversion temps -> pixels
    isSelected?: boolean;
    onPress?: (clipId: string) => void;
    onLongPress?: (clipId: string) => void;
    onTrimStart?: (clipId: string, newTime: number) => void;
    onTrimEnd?: (clipId: string, newTime: number) => void;
}

export const ClipComponent: React.FC<ClipComponentProps> = ({
    clip,
    trackType,
    pixelsPerSecond,
    isSelected = false,
    onPress,
    onLongPress,
    onTrimStart,
    onTrimEnd,
}) => {
    const clipWidth = clip.duration * pixelsPerSecond;
    const clipLeft = clip.startTime * pixelsPerSecond;

    const getClipColor = (type: TrackType): string => {
    const { t } = useLanguageSafe();
        switch (type) {
            case 'video':
                return modernColors.primary;
            case 'audio':
                return modernColors.success;
            case 'text':
                return modernColors.warning;
            case 'effect':
                return modernColors.error;
            case 'graphic':
                return modernColors.info;
            case 'image':
                return modernColors.secondary;
            default:
                return modernColors.textSecondary;
        }
    };

    const getClipIcon = (type: TrackType): string => {
        switch (type) {
            case 'video':
                return 'video';
            case 'audio':
                return 'volume-2';
            case 'text':
                return 'type';
            case 'effect':
                return 'sparkles';
            case 'graphic':
                return 'layers';
            case 'image':
                return 'image';
            default:
                return 'square';
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const clipColor = getClipColor(trackType);

    return (
        <View
            style={[
                styles.container,
                {
                    left: clipLeft,
                    width: Math.max(clipWidth, 60), // Minimum 60px pour visibilité
                    backgroundColor: clipColor + (isSelected ? 'FF' : '80'),
                    borderColor: isSelected ? modernColors.primary : 'transparent',
                },
            ]}
        >
            <TouchableOpacity
                style={styles.touchable}
                onPress={() => onPress?.(clip.id)}
                onLongPress={() => onLongPress?.(clip.id)}
                activeOpacity={0.7}
            >
                {/* Icône du clip */}
                <View style={styles.iconContainer}>
                    <SafeIcon
                        name={getClipIcon(trackType)}
                        size={16}
                        color={modernColors.surface}
                    />
                </View>

                {/* Informations du clip */}
                <View style={styles.infoContainer}>
                    <Text style={styles.clipDuration} numberOfLines={1}>
                        {formatTime(clip.duration)}
                    </Text>
                    {clip.muted && (
                        <SafeIcon
                            name="volume-x"
                            size={12}
                            color={modernColors.surface}
                        />
                    )}
                    {clip.locked && (
                        <SafeIcon
                            name="lock"
                            size={12}
                            color={modernColors.surface}
                        />
                    )}
                </View>

                {/* Indicateurs de trim */}
                {onTrimStart && clipWidth > 100 && (
                    <View style={[styles.trimHandle, styles.trimStart]} />
                )}
                {onTrimEnd && clipWidth > 100 && (
                    <View style={[styles.trimHandle, styles.trimEnd]} />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        borderRadius: 8,
        borderWidth: 2,
        overflow: 'hidden',
        minHeight: 40,
    },
    touchable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    iconContainer: {
        marginRight: 6,
    },
    infoContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    clipDuration: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.surface,
    },
    trimHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: modernColors.surface,
        opacity: 0.8,
    },
    trimStart: {
        left: 0,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    trimEnd: {
        right: 0,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
    },
});

