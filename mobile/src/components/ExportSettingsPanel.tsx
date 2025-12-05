// ✅ NOUVEAU Phase 2.3: Panel de configuration d'export vidéo

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import {
    AspectRatio,
    ExportCodec,
    ExportFormat,
    ExportQuality,
    ExportResolution,
    ExportSettings,
    FORMAT_CODECS,
} from '../types/ExportSettings';
import { NativeButton } from './NativeDesign';
import { SafeIcon } from './SafeIcon';

interface ExportSettingsPanelProps {
    visible: boolean;
    initialSettings?: Partial<ExportSettings>;
    onClose: () => void;
    onExport: (settings: ExportSettings) => void;
    timelineId?: string;
}

const RESOLUTIONS: ExportResolution[] = ['720p', '1080p', '2K', '4K', '8K'];
const FORMATS: ExportFormat[] = ['mp4', 'mov', 'webm', 'gif'];
const QUALITIES: ExportQuality[] = ['low', 'medium', 'high', 'ultra'];
const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5', '21:9'];

export const ExportSettingsPanel: React.FC<ExportSettingsPanelProps> = ({
    visible,
    initialSettings,
    onClose,
    onExport,
}) => {
    const [settings, setSettings] = useState<ExportSettings>({
        resolution: initialSettings?.resolution || '1080p',
        format: initialSettings?.format || 'mp4',
        codec: initialSettings?.codec || 'h264',
        quality: initialSettings?.quality || 'high',
        aspectRatio: initialSettings?.aspectRatio || '16:9',
        fps: initialSettings?.fps || 30,
        watermark: initialSettings?.watermark !== undefined ? initialSettings.watermark : true,
        bitrate: initialSettings?.bitrate,
        audioBitrate: initialSettings?.audioBitrate,
    });

    const handleFormatChange = (format: ExportFormat) => {
        setSettings((prev) => {
            const availableCodecs = FORMAT_CODECS[format];
            const newCodec = availableCodecs.includes(prev.codec as ExportCodec)
                ? prev.codec
                : availableCodecs[0];
            return {
                ...prev,
                format,
                codec: newCodec,
            };
        });
    };

    const handleExport = () => {
        onExport(settings);
    };

    const renderOptionGroup = <T extends string>(
        title: string,
        options: T[],
        selected: T,
        onSelect: (value: T) => void,
        getLabel?: (value: T) => string
    ) => (
        <View style={styles.optionGroup}>
            <Text style={styles.optionGroupTitle}>{title}</Text>
            <View style={styles.optionsRow}>
                {options.map((option) => {
                    const label = getLabel ? getLabel(option) : option.toUpperCase();
                    const isSelected = selected === option;
                    return (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.optionChip,
                                isSelected && styles.optionChipActive,
                            ]}
                            onPress={() => onSelect(option)}
                        >
                            <Text
                                style={[
                                    styles.optionChipText,
                                    isSelected && styles.optionChipTextActive,
                                ]}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Paramètres d'Export</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Settings */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {renderOptionGroup(
                            'Résolution',
                            RESOLUTIONS,
                            settings.resolution,
                            (resolution) => setSettings((prev) => ({ ...prev, resolution }))
                        )}

                        {renderOptionGroup(
                            'Format',
                            FORMATS,
                            settings.format,
                            handleFormatChange
                        )}

                        {renderOptionGroup(
                            'Codec',
                            FORMAT_CODECS[settings.format],
                            settings.codec,
                            (codec) => setSettings((prev) => ({ ...prev, codec }))
                        )}

                        {renderOptionGroup(
                            'Qualité',
                            QUALITIES,
                            settings.quality,
                            (quality) => setSettings((prev) => ({ ...prev, quality })),
                            (q) => {
                                const labels: Record<ExportQuality, string> = {
                                    low: 'Basse',
                                    medium: 'Moyenne',
                                    high: 'Haute',
                                    ultra: 'Ultra',
                                };
                                return labels[q];
                            }
                        )}

                        {renderOptionGroup(
                            'Ratio d\'Aspect',
                            ASPECT_RATIOS,
                            settings.aspectRatio,
                            (aspectRatio) => setSettings((prev) => ({ ...prev, aspectRatio }))
                        )}

                        {/* Watermark Toggle */}
                        <View style={styles.optionGroup}>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>Watermark Yukpo</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.toggle,
                                        settings.watermark && styles.toggleActive,
                                    ]}
                                    onPress={() =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            watermark: !prev.watermark,
                                        }))
                                    }
                                >
                                    <View
                                        style={[
                                            styles.toggleThumb,
                                            settings.watermark && styles.toggleThumbActive,
                                        ]}
                                    />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.toggleDescription}>
                                Ajouter le logo Yukpo à la fin de la vidéo
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <NativeButton
                            title="Annuler"
                            onPress={onClose}
                            variant="outline"
                            style={styles.cancelButton}
                        />
                        <NativeButton
                            title="Exporter"
                            onPress={handleExport}
                            variant="primary"
                            style={styles.exportButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    optionGroup: {
        marginBottom: 24,
    },
    optionGroupTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    optionChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionChipText: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '500',
    },
    optionChipTextActive: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    toggle: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    toggleActive: {
        backgroundColor: modernColors.primary,
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        alignSelf: 'flex-start',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    toggleDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
    },
    exportButton: {
        flex: 1,
    },
});

