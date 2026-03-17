// ✅ NOUVEAU Phase 2: En-tête de piste pour timeline multi-pistes

import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { TrackType } from '../types/AdvancedTimeline';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TrackHeaderProps {
    trackId: string;
    type: TrackType;
    name: string;
    locked?: boolean;
    muted?: boolean;
    visible?: boolean;
    onLock?: (trackId: string) => void;
    onMute?: (trackId: string) => void;
    onVisibility?: (trackId: string) => void;
    onRename?: (trackId: string, name: string) => void;
    height?: number;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
    trackId,
    type,
    name,
    locked = false,
    muted = false,
    visible = true,
    onLock,
    onMute,
    onVisibility,
    onRename,
    height = 60,
}) => {
    const getTrackIcon = (trackType: TrackType): string => {
    const { t } = useLanguageSafe();
        switch (trackType) {
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

    const getTrackColor = (trackType: TrackType): string => {
        switch (trackType) {
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

    return (
        <View style={[styles.container, { height }]}>
            {/* Icône du type de piste */}
            <View style={[styles.iconContainer, { backgroundColor: getTrackColor(type) + '20' }]}>
                <SafeIcon
                    name={getTrackIcon(type)}
                    size={20}
                    color={getTrackColor(type)}
                />
            </View>

            {/* Nom de la piste */}
            <View style={styles.nameContainer}>
                <Text style={styles.trackName} numberOfLines={1}>
                    {name}
                </Text>
                <Text style={styles.trackType} numberOfLines={1}>
                    {type}
                </Text>
            </View>

            {/* Contrôles */}
            <View style={styles.controlsContainer}>
                {/* Visibilité */}
                {onVisibility && (
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => onVisibility(trackId)}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                        <SafeIcon
                            name={visible ? 'eye' : 'eye-off'}
                            size={18}
                            color={visible ? modernColors.text : modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                )}

                {/* Mute */}
                {onMute && (
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => onMute(trackId)}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                        <SafeIcon
                            name={muted ? 'volume-x' : 'volume-2'}
                            size={18}
                            color={muted ? modernColors.error : modernColors.text}
                        />
                    </TouchableOpacity>
                )}

                {/* Lock */}
                {onLock && (
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => onLock(trackId)}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                        <SafeIcon
                            name={locked ? 'lock' : 'unlock'}
                            size={18}
                            color={locked ? modernColors.warning : modernColors.text}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        minHeight: 60,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    nameContainer: {
        flex: 1,
        marginRight: 8,
    },
    trackName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    trackType: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textTransform: 'capitalize',
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    controlButton: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: modernColors.background,
    },
});

